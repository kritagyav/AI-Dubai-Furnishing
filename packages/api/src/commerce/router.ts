import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@dubai/db";
import {
  addToCartInput,
  updateCartItemInput,
  removeCartItemInput,
  createOrderInput,
  processPaymentInput,
  listOrdersInput,
  cancelOrderInput,
  refundOrderInput,
} from "@dubai/validators";
import { trackEvent } from "@dubai/queue";

import { authedProcedure } from "../trpc";
import {
  createPaymentIntent,
  capturePayment,
  refundPayment,
  PaymentError,
} from "./payment-service";

type JsonValue = Prisma.InputJsonValue;

export const commerceRouter = {
  // ─── Cart ───

  getCart: authedProcedure.query(async ({ ctx }) => {
    const cart = await ctx.db.cart.findUnique({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            priceFils: true,
          },
          orderBy: { id: "asc" },
        },
        updatedAt: true,
      },
    });

    if (!cart) {
      return { items: [], totalFils: 0 };
    }

    const totalFils = cart.items.reduce(
      (sum, item) => sum + item.priceFils * item.quantity,
      0,
    );

    return { ...cart, totalFils };
  }),

  addToCart: authedProcedure
    .input(addToCartInput)
    .mutation(async ({ ctx, input }) => {
      // Verify product exists and is active
      const product = await ctx.db.retailerProduct.findUnique({
        where: { id: input.productId },
        select: {
          id: true,
          priceFils: true,
          stockQuantity: true,
          validationStatus: true,
        },
      });

      if (!product || product.validationStatus !== "ACTIVE") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found or not available",
        });
      }

      if (product.stockQuantity < input.quantity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient stock",
        });
      }

      // Upsert cart
      const cart = await ctx.db.cart.upsert({
        where: { userId: ctx.user.id },
        create: { userId: ctx.user.id },
        update: {},
        select: { id: true },
      });

      // Upsert cart item
      const existing = await ctx.db.cartItem.findFirst({
        where: { cartId: cart.id, productId: input.productId },
        select: { id: true, quantity: true },
      });

      if (existing) {
        return ctx.db.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: existing.quantity + input.quantity,
            priceFils: product.priceFils,
          },
          select: { id: true, productId: true, quantity: true, priceFils: true },
        });
      }

      const newItem = await ctx.db.cartItem.create({
        data: {
          cartId: cart.id,
          productId: input.productId,
          quantity: input.quantity,
          priceFils: product.priceFils,
        },
        select: { id: true, productId: true, quantity: true, priceFils: true },
      });

      trackEvent("cart.item_added", ctx.user.id, {
        productId: input.productId,
        quantity: input.quantity,
        priceFils: product.priceFils,
      });

      return newItem;
    }),

  updateCartItem: authedProcedure
    .input(updateCartItemInput)
    .mutation(async ({ ctx, input }) => {
      const cart = await ctx.db.cart.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!cart) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cart not found" });
      }

      const item = await ctx.db.cartItem.findFirst({
        where: { id: input.itemId, cartId: cart.id },
        select: { id: true },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cart item not found",
        });
      }

      if (input.quantity === 0) {
        await ctx.db.cartItem.delete({ where: { id: item.id } });
        return { removed: true };
      }

      return ctx.db.cartItem.update({
        where: { id: item.id },
        data: { quantity: input.quantity },
        select: { id: true, quantity: true, priceFils: true },
      });
    }),

  removeCartItem: authedProcedure
    .input(removeCartItemInput)
    .mutation(async ({ ctx, input }) => {
      const cart = await ctx.db.cart.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!cart) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cart not found" });
      }

      const item = await ctx.db.cartItem.findFirst({
        where: { id: input.itemId, cartId: cart.id },
        select: { id: true },
      });

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cart item not found",
        });
      }

      await ctx.db.cartItem.delete({ where: { id: item.id } });
      return { removed: true };
    }),

  clearCart: authedProcedure.mutation(async ({ ctx }) => {
    const cart = await ctx.db.cart.findUnique({
      where: { userId: ctx.user.id },
      select: { id: true },
    });

    if (cart) {
      await ctx.db.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    trackEvent("cart.cleared", ctx.user.id, {});

    return { cleared: true };
  }),

  // ─── Orders ───

  createOrder: authedProcedure
    .input(createOrderInput)
    .mutation(async ({ ctx, input }) => {
      const cart = await ctx.db.cart.findUnique({
        where: { userId: ctx.user.id },
        select: {
          id: true,
          items: {
            select: {
              productId: true,
              quantity: true,
              priceFils: true,
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cart is empty",
        });
      }

      // Resolve product details for line items
      const productIds = cart.items.map((i) => i.productId);
      const products = await ctx.db.retailerProduct.findMany({
        where: { id: { in: productIds }, validationStatus: "ACTIVE" },
        select: {
          id: true,
          retailerId: true,
          name: true,
          sku: true,
          priceFils: true,
          stockQuantity: true,
        },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      // Verify stock availability
      for (const item of cart.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Product ${item.productId} is no longer available`,
          });
        }
        if (product.stockQuantity < item.quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Insufficient stock for ${product.name}`,
          });
        }
      }

      const subtotalFils = cart.items.reduce((sum, item) => {
        const product = productMap.get(item.productId);
        return sum + (product?.priceFils ?? item.priceFils) * item.quantity;
      }, 0);
      const deliveryFeeFils = 5000; // 50 AED flat fee
      const totalFils = subtotalFils + deliveryFeeFils;

      const order = await ctx.db.$transaction(async (tx) => {
        const o = await tx.order.create({
          data: {
            userId: ctx.user.id,
            status: "PENDING_PAYMENT",
            subtotalFils,
            deliveryFeeFils,
            totalFils,
            shippingAddress: input.shippingAddress as JsonValue,
            notes: input.notes ?? null,
          },
          select: { id: true, orderRef: true },
        });

        // Create line items
        await tx.orderLineItem.createMany({
          data: cart.items.map((item) => {
            const product = productMap.get(item.productId)!;
            return {
              orderId: o.id,
              productId: item.productId,
              retailerId: product.retailerId,
              productName: product.name,
              sku: product.sku,
              quantity: item.quantity,
              unitPriceFils: product.priceFils,
              totalFils: product.priceFils * item.quantity,
            };
          }),
        });

        // Decrement stock
        for (const item of cart.items) {
          await tx.retailerProduct.update({
            where: { id: item.productId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
        }

        // Clear cart
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

        return o;
      });

      trackEvent("order.created", ctx.user.id, {
        orderId: order.id,
        orderRef: order.orderRef,
        totalFils,
        itemCount: cart.items.length,
      });

      return {
        orderId: order.id,
        orderRef: order.orderRef,
        totalFils,
      };
    }),

  processPayment: authedProcedure
    .input(processPaymentInput)
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.order.findFirst({
        where: { id: input.orderId, userId: ctx.user.id },
        select: { id: true, status: true, totalFils: true },
      });

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      if (order.status !== "PENDING_PAYMENT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Order is not awaiting payment",
        });
      }

      // Call Checkout.com to create the payment (authorize + capture)
      let paymentResult;
      try {
        paymentResult = await createPaymentIntent({
          amountFils: order.totalFils,
          currency: "AED",
          token: input.token,
          reference: order.id,
          description: `Order ${order.id}`,
          capture: true,
          method: input.method,
          customerEmail: ctx.user.email || undefined,
          customerName: ctx.user.name || undefined,
        });
      } catch (err) {
        // Record the failed payment attempt
        const failureReason =
          err instanceof PaymentError ? err.message : "Unknown payment error";

        await ctx.db.payment.create({
          data: {
            orderId: order.id,
            method: input.method,
            status: "FAILED",
            amountFils: order.totalFils,
            failureReason,
          },
        });

        if (err instanceof PaymentError) {
          throw new TRPCError({
            code:
              err.code === "DECLINED" ||
              err.code === "INSUFFICIENT_FUNDS" ||
              err.code === "EXPIRED_CARD"
                ? "BAD_REQUEST"
                : "INTERNAL_SERVER_ERROR",
            message: `Payment failed: ${err.message}`,
            cause: err,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Payment processing failed unexpectedly",
        });
      }

      // Determine payment status from Checkout.com response
      const isCaptured = paymentResult.status === "Captured";
      const isAuthorized =
        paymentResult.status === "Authorized" || paymentResult.approved;

      const paymentStatus = isCaptured
        ? "CAPTURED"
        : isAuthorized
          ? "AUTHORIZED"
          : "PENDING";

      const now = new Date();

      const payment = await ctx.db.payment.create({
        data: {
          orderId: order.id,
          method: input.method,
          status: paymentStatus as "PENDING" | "AUTHORIZED" | "CAPTURED",
          amountFils: order.totalFils,
          externalRef: paymentResult.externalId,
          authorizedAt: isAuthorized || isCaptured ? now : null,
          capturedAt: isCaptured ? now : null,
        },
        select: { id: true, externalRef: true, status: true },
      });

      // If only authorized (not captured), attempt capture
      if (isAuthorized && !isCaptured && payment.externalRef) {
        try {
          await capturePayment(payment.externalRef, order.totalFils);
          await ctx.db.payment.update({
            where: { id: payment.id },
            data: { status: "CAPTURED", capturedAt: new Date() },
          });
          payment.status = "CAPTURED";
        } catch (captureErr) {
          // Payment is authorized but capture failed — leave as AUTHORIZED
          // This can be retried later
          console.error(
            "[commerce] Capture failed for payment",
            payment.id,
            captureErr,
          );
        }
      }

      // Update order status
      await ctx.db.order.update({
        where: { id: order.id },
        data: {
          status: payment.status === "CAPTURED" ? "PAID" : "PENDING_PAYMENT",
          paidAt: payment.status === "CAPTURED" ? now : null,
        },
      });

      // Create commissions only after successful capture
      if (payment.status === "CAPTURED") {
        const lineItems = await ctx.db.orderLineItem.findMany({
          where: { orderId: order.id },
          select: { retailerId: true, totalFils: true },
        });

        // Group by retailer
        const retailerTotals = new Map<string, number>();
        for (const li of lineItems) {
          retailerTotals.set(
            li.retailerId,
            (retailerTotals.get(li.retailerId) ?? 0) + li.totalFils,
          );
        }

        for (const [retailerId, total] of retailerTotals) {
          const retailer = await ctx.db.retailer.findUnique({
            where: { id: retailerId },
            select: { commissionRate: true },
          });

          const rateBps = retailer?.commissionRate ?? 1200;
          const commissionAmount = Math.round((total * rateBps) / 10000);

          await ctx.db.commission.create({
            data: {
              retailerId,
              orderId: order.id,
              orderRef: order.id.slice(0, 8),
              amountFils: commissionAmount,
              rateBps,
              netAmountFils: total - commissionAmount,
              status: "PENDING",
            },
          });

          await ctx.db.ledgerEntry.create({
            data: {
              retailerId,
              type: "COMMISSION",
              amountFils: commissionAmount,
              referenceId: order.id,
              description: `Commission for order ${order.id.slice(0, 8)}`,
            },
          });
        }

        trackEvent("order.paid", ctx.user.id, {
          orderId: order.id,
          paymentId: payment.id,
          amountFils: order.totalFils,
          method: input.method,
        });
      }

      return { paymentId: payment.id, status: payment.status };
    }),

  getOrder: authedProcedure
    .input(cancelOrderInput.pick({ orderId: true }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.db.order.findFirst({
        where: { id: input.orderId, userId: ctx.user.id },
        select: {
          id: true,
          orderRef: true,
          status: true,
          subtotalFils: true,
          deliveryFeeFils: true,
          totalFils: true,
          shippingAddress: true,
          notes: true,
          paidAt: true,
          createdAt: true,
          lineItems: {
            select: {
              id: true,
              productName: true,
              sku: true,
              quantity: true,
              unitPriceFils: true,
              totalFils: true,
            },
          },
          payments: {
            select: {
              id: true,
              method: true,
              status: true,
              amountFils: true,
              capturedAt: true,
            },
          },
        },
      });

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      return order;
    }),

  listOrders: authedProcedure
    .input(listOrdersInput)
    .query(async ({ ctx, input }) => {
      const where = {
        userId: ctx.user.id,
        ...(input.status ? { status: input.status } : {}),
      };

      const items = await ctx.db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          orderRef: true,
          status: true,
          totalFils: true,
          createdAt: true,
          _count: { select: { lineItems: true } },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      return { items, nextCursor };
    }),

  cancelOrder: authedProcedure
    .input(cancelOrderInput)
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.order.findFirst({
        where: { id: input.orderId, userId: ctx.user.id },
        select: { id: true, status: true },
      });

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      const cancellable = ["DRAFT", "PENDING_PAYMENT", "PAID", "PROCESSING"];
      if (!cancellable.includes(order.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Order cannot be cancelled in its current status",
        });
      }

      // Restore stock
      const lineItems = await ctx.db.orderLineItem.findMany({
        where: { orderId: order.id },
        select: { productId: true, quantity: true },
      });

      await ctx.db.$transaction(async (tx) => {
        for (const li of lineItems) {
          await tx.retailerProduct.update({
            where: { id: li.productId },
            data: { stockQuantity: { increment: li.quantity } },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
      });

      trackEvent("order.cancelled", ctx.user.id, {
        orderId: order.id,
      });

      return { cancelled: true };
    }),

  refundOrder: authedProcedure
    .input(refundOrderInput)
    .mutation(async ({ ctx, input }) => {
      // Find order — accessible by admin (PLATFORM_ADMIN) or the order owner
      const isAdmin = ctx.user.role === "PLATFORM_ADMIN";

      const order = await ctx.db.order.findFirst({
        where: {
          id: input.orderId,
          ...(isAdmin ? {} : { userId: ctx.user.id }),
        },
        select: { id: true, status: true, userId: true, totalFils: true },
      });

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      // Only paid/processing/shipped/delivered orders can be refunded
      const refundable = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];
      if (!refundable.includes(order.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Order cannot be refunded in its current status (${order.status})`,
        });
      }

      // Find the captured payment for this order
      const payment = await ctx.db.payment.findFirst({
        where: { orderId: order.id, status: "CAPTURED" },
        select: { id: true, externalRef: true, amountFils: true },
      });

      if (!payment) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No captured payment found for this order",
        });
      }

      // Call Checkout.com to initiate refund
      try {
        if (!payment.externalRef) {
          throw new PaymentError(
            "No external payment reference available",
            "NOT_REFUNDABLE",
          );
        }
        await refundPayment(payment.externalRef, payment.amountFils);
      } catch (err) {
        if (err instanceof PaymentError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Refund failed: ${err.message}`,
            cause: err,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Refund processing failed unexpectedly",
        });
      }

      // Update payment and order status within a transaction
      await ctx.db.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "REFUNDED" },
        });

        await tx.order.update({
          where: { id: order.id },
          data: { status: "REFUNDED" },
        });
      });

      trackEvent("order.refunded", ctx.user.id, {
        orderId: order.id,
        paymentId: payment.id,
        amountFils: payment.amountFils,
        reason: input.reason,
      });

      return { refunded: true, orderId: order.id };
    }),

} satisfies TRPCRouterRecord;
