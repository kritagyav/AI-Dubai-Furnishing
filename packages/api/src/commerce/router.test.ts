import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// Mock external dependencies before importing the router
vi.mock("@dubai/queue", () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
  trackEvent: vi.fn(),
}));

vi.mock("./payment-service", () => ({
  createPaymentIntent: vi.fn(),
  capturePayment: vi.fn(),
  refundPayment: vi.fn(),
  PaymentError: class PaymentError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = "PaymentError";
      this.code = code;
    }
  },
}));

import { commerceRouter } from "./router";
import { enqueue, trackEvent } from "@dubai/queue";
import {
  createPaymentIntent,
  capturePayment,
  refundPayment,
  PaymentError,
} from "./payment-service";

// ─── Helpers ───

function createMockTx() {
  return {
    order: { create: vi.fn(), update: vi.fn() },
    orderLineItem: { createMany: vi.fn() },
    retailerProduct: { update: vi.fn() },
    cartItem: { deleteMany: vi.fn() },
    payment: { update: vi.fn() },
    supportTicket: { create: vi.fn(), update: vi.fn() },
    ticketMessage: { create: vi.fn() },
    commission: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    ledgerEntry: { create: vi.fn() },
  };
}

function createMockDb() {
  return {
    cart: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    cartItem: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    retailerProduct: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    orderLineItem: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    supportTicket: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ticketMessage: {
      create: vi.fn(),
    },
    commission: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    ledgerEntry: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

function authedCtx(db: MockDb, overrides?: Record<string, unknown>) {
  return {
    user: {
      id: "user-1",
      supabaseId: "supa-1",
      role: "USER",
      tenantId: null,
      email: "test@example.com",
      name: "Test User",
    },
    db: db as unknown,
    correlationId: "test-corr",
    ...overrides,
  };
}

function adminCtx(db: MockDb) {
  return authedCtx(db, {
    user: {
      id: "admin-1",
      supabaseId: "supa-admin",
      role: "PLATFORM_ADMIN",
      tenantId: null,
      email: "admin@example.com",
      name: "Admin User",
    },
  });
}

// Helper to call a procedure directly, bypassing middleware
async function callProcedure(
  procedure: { _def: { resolver?: unknown } },
  opts: { ctx: unknown; input?: unknown },
) {
  const handler = procedure._def.resolver;
  if (!handler) throw new Error("No handler found");
  return (handler as (opts: { ctx: unknown; input: unknown }) => unknown)(opts);
}

// ═══════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════

describe("commerce router", () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  // ─── getCart ───

  describe("getCart", () => {
    it("returns empty cart when user has no cart", async () => {
      db.cart.findUnique.mockResolvedValue(null);

      const result = await callProcedure(commerceRouter.getCart, {
        ctx: authedCtx(db),
      });

      expect(result).toEqual({ items: [], totalFils: 0 });
      expect(db.cart.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user-1" } }),
      );
    });

    it("returns cart items with total", async () => {
      db.cart.findUnique.mockResolvedValue({
        id: "cart-1",
        items: [
          { id: "item-1", productId: "prod-1", quantity: 2, priceFils: 10000 },
          { id: "item-2", productId: "prod-2", quantity: 1, priceFils: 25000 },
        ],
        updatedAt: new Date("2025-01-01"),
      });

      const result = await callProcedure(commerceRouter.getCart, {
        ctx: authedCtx(db),
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: "cart-1",
          totalFils: 45000, // 2*10000 + 1*25000
        }),
      );
      expect((result as { items: unknown[] }).items).toHaveLength(2);
    });
  });

  // ─── addToCart ───

  describe("addToCart", () => {
    it("rejects invalid (non-existent) product", async () => {
      db.retailerProduct.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(commerceRouter.addToCart, {
          ctx: authedCtx(db),
          input: { productId: "prod-invalid", quantity: 1 },
        }),
      ).rejects.toThrow(TRPCError);

      await expect(
        callProcedure(commerceRouter.addToCart, {
          ctx: authedCtx(db),
          input: { productId: "prod-invalid", quantity: 1 },
        }),
      ).rejects.toThrow("Product not found or not available");
    });

    it("rejects inactive product", async () => {
      db.retailerProduct.findUnique.mockResolvedValue({
        id: "prod-1",
        priceFils: 10000,
        stockQuantity: 5,
        validationStatus: "PENDING",
      });

      await expect(
        callProcedure(commerceRouter.addToCart, {
          ctx: authedCtx(db),
          input: { productId: "prod-1", quantity: 1 },
        }),
      ).rejects.toThrow("Product not found or not available");
    });

    it("rejects when insufficient stock", async () => {
      db.retailerProduct.findUnique.mockResolvedValue({
        id: "prod-1",
        priceFils: 10000,
        stockQuantity: 2,
        validationStatus: "ACTIVE",
      });

      await expect(
        callProcedure(commerceRouter.addToCart, {
          ctx: authedCtx(db),
          input: { productId: "prod-1", quantity: 5 },
        }),
      ).rejects.toThrow("Insufficient stock");
    });

    it("creates cart if none exists and adds new item", async () => {
      db.retailerProduct.findUnique.mockResolvedValue({
        id: "prod-1",
        priceFils: 15000,
        stockQuantity: 10,
        validationStatus: "ACTIVE",
      });
      db.cart.upsert.mockResolvedValue({ id: "cart-1" });
      db.cartItem.findFirst.mockResolvedValue(null);
      db.cartItem.create.mockResolvedValue({
        id: "item-1",
        productId: "prod-1",
        quantity: 2,
        priceFils: 15000,
      });

      const result = await callProcedure(commerceRouter.addToCart, {
        ctx: authedCtx(db),
        input: { productId: "prod-1", quantity: 2 },
      });

      expect(db.cart.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
          create: { userId: "user-1" },
        }),
      );
      expect(db.cartItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            cartId: "cart-1",
            productId: "prod-1",
            quantity: 2,
            priceFils: 15000,
          },
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ id: "item-1", productId: "prod-1" }),
      );
      expect(trackEvent).toHaveBeenCalledWith(
        "cart.item_added",
        "user-1",
        expect.objectContaining({ productId: "prod-1" }),
      );
    });

    it("updates quantity for existing cart item", async () => {
      db.retailerProduct.findUnique.mockResolvedValue({
        id: "prod-1",
        priceFils: 15000,
        stockQuantity: 10,
        validationStatus: "ACTIVE",
      });
      db.cart.upsert.mockResolvedValue({ id: "cart-1" });
      db.cartItem.findFirst.mockResolvedValue({
        id: "item-1",
        quantity: 1,
      });
      db.cartItem.update.mockResolvedValue({
        id: "item-1",
        productId: "prod-1",
        quantity: 3,
        priceFils: 15000,
      });

      const result = await callProcedure(commerceRouter.addToCart, {
        ctx: authedCtx(db),
        input: { productId: "prod-1", quantity: 2 },
      });

      expect(db.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "item-1" },
          data: { quantity: 3, priceFils: 15000 },
        }),
      );
      expect((result as { quantity: number }).quantity).toBe(3);
    });
  });

  // ─── updateCartItem ───

  describe("updateCartItem", () => {
    it("rejects when cart not found", async () => {
      db.cart.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(commerceRouter.updateCartItem, {
          ctx: authedCtx(db),
          input: { itemId: "item-1", quantity: 3 },
        }),
      ).rejects.toThrow("Cart not found");
    });

    it("rejects when cart item not found", async () => {
      db.cart.findUnique.mockResolvedValue({ id: "cart-1" });
      db.cartItem.findFirst.mockResolvedValue(null);

      await expect(
        callProcedure(commerceRouter.updateCartItem, {
          ctx: authedCtx(db),
          input: { itemId: "item-missing", quantity: 3 },
        }),
      ).rejects.toThrow("Cart item not found");
    });

    it("updates quantity", async () => {
      db.cart.findUnique.mockResolvedValue({ id: "cart-1" });
      db.cartItem.findFirst.mockResolvedValue({ id: "item-1" });
      db.cartItem.update.mockResolvedValue({
        id: "item-1",
        quantity: 5,
        priceFils: 10000,
      });

      const result = await callProcedure(commerceRouter.updateCartItem, {
        ctx: authedCtx(db),
        input: { itemId: "item-1", quantity: 5 },
      });

      expect(db.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "item-1" },
          data: { quantity: 5 },
        }),
      );
      expect((result as { quantity: number }).quantity).toBe(5);
    });

    it("removes item when quantity is 0", async () => {
      db.cart.findUnique.mockResolvedValue({ id: "cart-1" });
      db.cartItem.findFirst.mockResolvedValue({ id: "item-1" });

      const result = await callProcedure(commerceRouter.updateCartItem, {
        ctx: authedCtx(db),
        input: { itemId: "item-1", quantity: 0 },
      });

      expect(db.cartItem.delete).toHaveBeenCalledWith({
        where: { id: "item-1" },
      });
      expect(result).toEqual({ removed: true });
    });
  });

  // ─── removeCartItem ───

  describe("removeCartItem", () => {
    it("rejects when cart not found", async () => {
      db.cart.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(commerceRouter.removeCartItem, {
          ctx: authedCtx(db),
          input: { itemId: "item-1" },
        }),
      ).rejects.toThrow("Cart not found");
    });

    it("rejects when item not found", async () => {
      db.cart.findUnique.mockResolvedValue({ id: "cart-1" });
      db.cartItem.findFirst.mockResolvedValue(null);

      await expect(
        callProcedure(commerceRouter.removeCartItem, {
          ctx: authedCtx(db),
          input: { itemId: "item-missing" },
        }),
      ).rejects.toThrow("Cart item not found");
    });

    it("removes item successfully", async () => {
      db.cart.findUnique.mockResolvedValue({ id: "cart-1" });
      db.cartItem.findFirst.mockResolvedValue({ id: "item-1" });

      const result = await callProcedure(commerceRouter.removeCartItem, {
        ctx: authedCtx(db),
        input: { itemId: "item-1" },
      });

      expect(db.cartItem.delete).toHaveBeenCalledWith({
        where: { id: "item-1" },
      });
      expect(result).toEqual({ removed: true });
    });
  });

  // ─── createOrder ───

  describe("createOrder", () => {
    it("rejects when cart is empty", async () => {
      db.cart.findUnique.mockResolvedValue({ id: "cart-1", items: [] });

      await expect(
        callProcedure(commerceRouter.createOrder, {
          ctx: authedCtx(db),
          input: {
            shippingAddress: {
              line1: "123 Main St",
              city: "Dubai",
              emirate: "Dubai",
              country: "AE",
            },
          },
        }),
      ).rejects.toThrow("Cart is empty");
    });

    it("rejects when cart is null", async () => {
      db.cart.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(commerceRouter.createOrder, {
          ctx: authedCtx(db),
          input: {
            shippingAddress: {
              line1: "123 Main St",
              city: "Dubai",
              emirate: "Dubai",
              country: "AE",
            },
          },
        }),
      ).rejects.toThrow("Cart is empty");
    });

    it("rejects when a product is no longer available", async () => {
      db.cart.findUnique.mockResolvedValue({
        id: "cart-1",
        items: [
          { productId: "prod-1", quantity: 1, priceFils: 10000 },
        ],
      });
      db.retailerProduct.findMany.mockResolvedValue([]); // product gone

      await expect(
        callProcedure(commerceRouter.createOrder, {
          ctx: authedCtx(db),
          input: {
            shippingAddress: {
              line1: "123 Main St",
              city: "Dubai",
              emirate: "Dubai",
              country: "AE",
            },
          },
        }),
      ).rejects.toThrow("is no longer available");
    });

    it("rejects when stock is insufficient", async () => {
      db.cart.findUnique.mockResolvedValue({
        id: "cart-1",
        items: [
          { productId: "prod-1", quantity: 5, priceFils: 10000 },
        ],
      });
      db.retailerProduct.findMany.mockResolvedValue([
        {
          id: "prod-1",
          retailerId: "ret-1",
          name: "Sofa",
          sku: "SOFA-1",
          priceFils: 10000,
          stockQuantity: 2,
        },
      ]);

      await expect(
        callProcedure(commerceRouter.createOrder, {
          ctx: authedCtx(db),
          input: {
            shippingAddress: {
              line1: "123 Main St",
              city: "Dubai",
              emirate: "Dubai",
              country: "AE",
            },
          },
        }),
      ).rejects.toThrow("Insufficient stock");
    });

    it("creates order from cart successfully", async () => {
      db.cart.findUnique.mockResolvedValue({
        id: "cart-1",
        items: [
          { productId: "prod-1", quantity: 2, priceFils: 10000 },
          { productId: "prod-2", quantity: 1, priceFils: 30000 },
        ],
      });
      db.retailerProduct.findMany.mockResolvedValue([
        {
          id: "prod-1",
          retailerId: "ret-1",
          name: "Chair",
          sku: "CHAIR-1",
          priceFils: 10000,
          stockQuantity: 10,
        },
        {
          id: "prod-2",
          retailerId: "ret-1",
          name: "Table",
          sku: "TABLE-1",
          priceFils: 30000,
          stockQuantity: 5,
        },
      ]);

      const mockTx = createMockTx();
      mockTx.order.create.mockResolvedValue({
        id: "order-1",
        orderRef: "ORD-001",
      });
      mockTx.orderLineItem.createMany.mockResolvedValue({ count: 2 });
      mockTx.retailerProduct.update.mockResolvedValue({});
      mockTx.cartItem.deleteMany.mockResolvedValue({});

      db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockTx),
      );

      const result = await callProcedure(commerceRouter.createOrder, {
        ctx: authedCtx(db),
        input: {
          shippingAddress: {
            line1: "123 Main St",
            city: "Dubai",
            emirate: "Dubai",
            country: "AE",
          },
          notes: "Test note",
        },
      });

      expect(result).toEqual({
        orderId: "order-1",
        orderRef: "ORD-001",
        totalFils: 55000, // (2*10000 + 1*30000) + 5000 delivery
      });

      // Check stock decrement was called for both products
      expect(mockTx.retailerProduct.update).toHaveBeenCalledTimes(2);
      // Cart should be cleared
      expect(mockTx.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: "cart-1" },
      });
      expect(trackEvent).toHaveBeenCalledWith(
        "order.created",
        "user-1",
        expect.objectContaining({ orderId: "order-1" }),
      );
    });
  });

  // ─── processPayment ───

  describe("processPayment", () => {
    it("rejects when order not found", async () => {
      db.order.findFirst.mockResolvedValue(null);

      await expect(
        callProcedure(commerceRouter.processPayment, {
          ctx: authedCtx(db),
          input: { orderId: "order-missing", method: "CARD", token: "tok_test" },
        }),
      ).rejects.toThrow("Order not found");
    });

    it("rejects when order is not pending payment", async () => {
      db.order.findFirst.mockResolvedValue({
        id: "order-1",
        status: "PAID",
        totalFils: 50000,
      });

      await expect(
        callProcedure(commerceRouter.processPayment, {
          ctx: authedCtx(db),
          input: { orderId: "order-1", method: "CARD", token: "tok_test" },
        }),
      ).rejects.toThrow("Order is not awaiting payment");
    });

    it("handles successful payment (Captured)", async () => {
      db.order.findFirst.mockResolvedValue({
        id: "order-1",
        status: "PENDING_PAYMENT",
        totalFils: 50000,
      });

      vi.mocked(createPaymentIntent).mockResolvedValue({
        externalId: "pay_ext_1",
        actionId: "act_1",
        approved: true,
        status: "Captured",
        responseCode: "10000",
        responseSummary: "Approved",
        processedOn: "2025-01-01T00:00:00Z",
      });

      db.payment.create.mockResolvedValue({
        id: "payment-1",
        externalRef: "pay_ext_1",
        status: "CAPTURED",
      });

      db.order.update.mockResolvedValue({});

      const result = await callProcedure(commerceRouter.processPayment, {
        ctx: authedCtx(db),
        input: { orderId: "order-1", method: "CARD", token: "tok_test" },
      });

      expect(result).toEqual({ paymentId: "payment-1", status: "CAPTURED" });
      expect(db.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "PAID" }),
        }),
      );
      expect(enqueue).toHaveBeenCalledWith("commission.calculate", {
        orderId: "order-1",
      });
      expect(trackEvent).toHaveBeenCalledWith(
        "order.paid",
        "user-1",
        expect.objectContaining({ orderId: "order-1" }),
      );
    });

    it("handles declined payment", async () => {
      db.order.findFirst.mockResolvedValue({
        id: "order-1",
        status: "PENDING_PAYMENT",
        totalFils: 50000,
      });

      vi.mocked(createPaymentIntent).mockRejectedValue(
        new PaymentError("Card declined", "DECLINED"),
      );

      db.payment.create.mockResolvedValue({
        id: "payment-fail",
        status: "FAILED",
      });

      await expect(
        callProcedure(commerceRouter.processPayment, {
          ctx: authedCtx(db),
          input: { orderId: "order-1", method: "CARD", token: "tok_bad" },
        }),
      ).rejects.toThrow("Payment failed: Card declined");

      // Verify failed payment was recorded
      expect(db.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "FAILED",
            failureReason: "Card declined",
          }),
        }),
      );
    });

    it("handles authorized but not captured (attempts capture)", async () => {
      db.order.findFirst.mockResolvedValue({
        id: "order-1",
        status: "PENDING_PAYMENT",
        totalFils: 50000,
      });

      vi.mocked(createPaymentIntent).mockResolvedValue({
        externalId: "pay_ext_2",
        actionId: "act_2",
        approved: true,
        status: "Authorized",
        responseCode: "10000",
        responseSummary: "Approved",
        processedOn: "2025-01-01T00:00:00Z",
      });

      db.payment.create.mockResolvedValue({
        id: "payment-2",
        externalRef: "pay_ext_2",
        status: "AUTHORIZED",
      });

      vi.mocked(capturePayment).mockResolvedValue({ actionId: "act_cap" });
      db.payment.update.mockResolvedValue({});
      db.order.update.mockResolvedValue({});

      const result = await callProcedure(commerceRouter.processPayment, {
        ctx: authedCtx(db),
        input: { orderId: "order-1", method: "CARD", token: "tok_auth" },
      });

      expect(capturePayment).toHaveBeenCalledWith("pay_ext_2", 50000);
      expect(db.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "CAPTURED" }),
        }),
      );
      expect(result).toEqual({ paymentId: "payment-2", status: "CAPTURED" });
    });

    it("handles unknown payment error", async () => {
      db.order.findFirst.mockResolvedValue({
        id: "order-1",
        status: "PENDING_PAYMENT",
        totalFils: 50000,
      });

      vi.mocked(createPaymentIntent).mockRejectedValue(
        new Error("Network failure"),
      );

      db.payment.create.mockResolvedValue({
        id: "payment-fail",
        status: "FAILED",
      });

      await expect(
        callProcedure(commerceRouter.processPayment, {
          ctx: authedCtx(db),
          input: { orderId: "order-1", method: "CARD", token: "tok_err" },
        }),
      ).rejects.toThrow("Payment processing failed unexpectedly");
    });
  });

  // ─── listOrders ───

  describe("listOrders", () => {
    it("returns paginated orders", async () => {
      const orders = [
        {
          id: "o1",
          orderRef: "ORD-001",
          status: "PAID",
          totalFils: 50000,
          createdAt: new Date(),
          _count: { lineItems: 2 },
        },
        {
          id: "o2",
          orderRef: "ORD-002",
          status: "DELIVERED",
          totalFils: 30000,
          createdAt: new Date(),
          _count: { lineItems: 1 },
        },
      ];
      db.order.findMany.mockResolvedValue(orders);

      const result = await callProcedure(commerceRouter.listOrders, {
        ctx: authedCtx(db),
        input: { limit: 20 },
      });

      expect((result as { items: unknown[] }).items).toHaveLength(2);
      expect((result as { nextCursor: unknown }).nextCursor).toBeUndefined();
    });

    it("returns nextCursor when more items exist", async () => {
      // limit+1 items means there are more
      const orders = Array.from({ length: 3 }, (_, i) => ({
        id: `o${i}`,
        orderRef: `ORD-${i}`,
        status: "PAID",
        totalFils: 50000,
        createdAt: new Date(),
        _count: { lineItems: 1 },
      }));
      db.order.findMany.mockResolvedValue(orders);

      const result = await callProcedure(commerceRouter.listOrders, {
        ctx: authedCtx(db),
        input: { limit: 2 },
      });

      expect((result as { items: unknown[] }).items).toHaveLength(2);
      expect((result as { nextCursor: string }).nextCursor).toBe("o2");
    });

    it("filters by status", async () => {
      db.order.findMany.mockResolvedValue([]);

      await callProcedure(commerceRouter.listOrders, {
        ctx: authedCtx(db),
        input: { limit: 20, status: "PAID" },
      });

      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "PAID" }),
        }),
      );
    });

    it("respects cursor", async () => {
      db.order.findMany.mockResolvedValue([]);

      await callProcedure(commerceRouter.listOrders, {
        ctx: authedCtx(db),
        input: { limit: 20, cursor: "o5" },
      });

      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "o5" },
          skip: 1,
        }),
      );
    });
  });

  // ─── createDispute ───

  describe("createDispute", () => {
    it("rejects when order not found", async () => {
      db.order.findFirst.mockResolvedValue(null);

      await expect(
        callProcedure(commerceRouter.createDispute, {
          ctx: authedCtx(db),
          input: {
            orderId: "order-missing",
            reason: "DAMAGED",
            description: "Item arrived broken",
          },
        }),
      ).rejects.toThrow("Order not found");
    });

    it("rejects when order status is not disputable", async () => {
      db.order.findFirst.mockResolvedValue({
        id: "order-1",
        orderRef: "ORD-001",
        status: "PENDING_PAYMENT",
        totalFils: 50000,
      });

      await expect(
        callProcedure(commerceRouter.createDispute, {
          ctx: authedCtx(db),
          input: {
            orderId: "order-1",
            reason: "DAMAGED",
            description: "Item broken",
          },
        }),
      ).rejects.toThrow("cannot be disputed");
    });

    it("rejects duplicate active dispute", async () => {
      db.order.findFirst.mockResolvedValue({
        id: "order-1",
        orderRef: "ORD-001",
        status: "PAID",
        totalFils: 50000,
      });
      db.supportTicket.findFirst.mockResolvedValue({
        id: "existing-ticket",
      });

      await expect(
        callProcedure(commerceRouter.createDispute, {
          ctx: authedCtx(db),
          input: {
            orderId: "order-1",
            reason: "DAMAGED",
            description: "Item broken",
          },
        }),
      ).rejects.toThrow("active dispute already exists");
    });

    it("creates dispute ticket successfully", async () => {
      db.order.findFirst.mockResolvedValue({
        id: "order-1",
        orderRef: "ORD-001",
        status: "DELIVERED",
        totalFils: 50000,
      });
      db.supportTicket.findFirst.mockResolvedValue(null);

      const mockTx = createMockTx();
      const ticketData = {
        id: "ticket-1",
        ticketRef: "TKT-001",
        category: "DISPUTE",
        priority: "HIGH",
        status: "OPEN",
        subject: "Dispute: DAMAGED — Order ORD-001",
        createdAt: new Date(),
      };
      mockTx.supportTicket.create.mockResolvedValue(ticketData);
      mockTx.ticketMessage.create.mockResolvedValue({});
      mockTx.order.update.mockResolvedValue({});

      db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockTx),
      );

      const result = await callProcedure(commerceRouter.createDispute, {
        ctx: authedCtx(db),
        input: {
          orderId: "order-1",
          reason: "DAMAGED",
          description: "Arrived broken",
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: "ticket-1",
          ticketRef: "TKT-001",
          category: "DISPUTE",
        }),
      );
      // Verify order status changed
      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "DISPUTED" },
        }),
      );
      expect(trackEvent).toHaveBeenCalledWith(
        "dispute.created",
        "user-1",
        expect.objectContaining({ orderId: "order-1" }),
      );
    });
  });

  // ─── resolveDispute ───

  describe("resolveDispute", () => {
    it("rejects when ticket not found", async () => {
      db.supportTicket.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(commerceRouter.resolveDispute, {
          ctx: adminCtx(db),
          input: { ticketId: "ticket-missing", resolution: "REJECTED" },
        }),
      ).rejects.toThrow("Ticket not found");
    });

    it("rejects when ticket is not a dispute", async () => {
      db.supportTicket.findUnique.mockResolvedValue({
        id: "ticket-1",
        category: "ORDER_ISSUE",
        status: "OPEN",
        orderId: "order-1",
        userId: "user-1",
      });

      await expect(
        callProcedure(commerceRouter.resolveDispute, {
          ctx: adminCtx(db),
          input: { ticketId: "ticket-1", resolution: "REJECTED" },
        }),
      ).rejects.toThrow("Ticket is not a dispute");
    });

    it("rejects when dispute is already resolved", async () => {
      db.supportTicket.findUnique.mockResolvedValue({
        id: "ticket-1",
        category: "DISPUTE",
        status: "RESOLVED",
        orderId: "order-1",
        userId: "user-1",
      });

      await expect(
        callProcedure(commerceRouter.resolveDispute, {
          ctx: adminCtx(db),
          input: { ticketId: "ticket-1", resolution: "REJECTED" },
        }),
      ).rejects.toThrow("Dispute is already resolved");
    });

    it("handles full refund resolution", async () => {
      db.supportTicket.findUnique.mockResolvedValue({
        id: "ticket-1",
        category: "DISPUTE",
        status: "OPEN",
        orderId: "order-1",
        userId: "user-1",
      });
      db.order.findUnique.mockResolvedValue({
        id: "order-1",
        status: "DISPUTED",
        totalFils: 50000,
      });
      db.payment.findFirst.mockResolvedValue({
        id: "pay-1",
        externalRef: "pay_ext_1",
        amountFils: 50000,
      });

      vi.mocked(refundPayment).mockResolvedValue({ actionId: "act_ref" });

      const mockTx = createMockTx();
      mockTx.commission.findMany.mockResolvedValue([
        {
          id: "comm-1",
          retailerId: "ret-1",
          amountFils: 5000,
          netAmountFils: 4500,
          rateBps: 1000,
        },
      ]);

      db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockTx),
      );

      const result = await callProcedure(commerceRouter.resolveDispute, {
        ctx: adminCtx(db),
        input: {
          ticketId: "ticket-1",
          resolution: "FULL_REFUND",
        },
      });

      expect(result).toEqual({
        resolved: true,
        ticketId: "ticket-1",
        resolution: "FULL_REFUND",
      });
      expect(refundPayment).toHaveBeenCalledWith("pay_ext_1", 50000);
      // Verify commission was adjusted
      expect(mockTx.commission.update).toHaveBeenCalled();
      expect(mockTx.ledgerEntry.create).toHaveBeenCalled();
      // Verify order set to REFUNDED
      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "REFUNDED" }),
        }),
      );
      expect(trackEvent).toHaveBeenCalledWith(
        "dispute.resolved",
        "admin-1",
        expect.objectContaining({ resolution: "FULL_REFUND" }),
      );
    });

    it("handles partial refund resolution", async () => {
      db.supportTicket.findUnique.mockResolvedValue({
        id: "ticket-1",
        category: "DISPUTE",
        status: "OPEN",
        orderId: "order-1",
        userId: "user-1",
      });
      db.order.findUnique.mockResolvedValue({
        id: "order-1",
        status: "DISPUTED",
        totalFils: 50000,
      });
      db.payment.findFirst.mockResolvedValue({
        id: "pay-1",
        externalRef: "pay_ext_1",
        amountFils: 50000,
      });

      vi.mocked(refundPayment).mockResolvedValue({ actionId: "act_ref" });

      const mockTx = createMockTx();
      mockTx.commission.findMany.mockResolvedValue([]);

      db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockTx),
      );

      const result = await callProcedure(commerceRouter.resolveDispute, {
        ctx: adminCtx(db),
        input: {
          ticketId: "ticket-1",
          resolution: "PARTIAL_REFUND",
          refundAmountFils: 25000,
        },
      });

      expect(result).toEqual({
        resolved: true,
        ticketId: "ticket-1",
        resolution: "PARTIAL_REFUND",
      });
      expect(refundPayment).toHaveBeenCalledWith("pay_ext_1", 25000);
      // Partial refund: order stays at PAID (since was DISPUTED)
      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "PAID" }),
        }),
      );
    });

    it("handles rejection resolution", async () => {
      db.supportTicket.findUnique.mockResolvedValue({
        id: "ticket-1",
        category: "DISPUTE",
        status: "IN_PROGRESS",
        orderId: "order-1",
        userId: "user-1",
      });
      db.order.findUnique.mockResolvedValue({
        id: "order-1",
        status: "DISPUTED",
        totalFils: 50000,
      });

      const mockTx = createMockTx();
      db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockTx),
      );

      const result = await callProcedure(commerceRouter.resolveDispute, {
        ctx: adminCtx(db),
        input: {
          ticketId: "ticket-1",
          resolution: "REJECTED",
          notes: "No valid evidence",
        },
      });

      expect(result).toEqual({
        resolved: true,
        ticketId: "ticket-1",
        resolution: "REJECTED",
      });
      // Order restored to DELIVERED on rejection
      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "DELIVERED" },
        }),
      );
      // Ticket marked resolved
      expect(mockTx.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "RESOLVED" }),
        }),
      );
    });

    it("handles replacement resolution", async () => {
      db.supportTicket.findUnique.mockResolvedValue({
        id: "ticket-1",
        category: "DISPUTE",
        status: "OPEN",
        orderId: "order-1",
        userId: "user-1",
      });
      db.order.findUnique.mockResolvedValue({
        id: "order-1",
        status: "DISPUTED",
        totalFils: 50000,
      });

      const mockTx = createMockTx();
      db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockTx),
      );

      const result = await callProcedure(commerceRouter.resolveDispute, {
        ctx: adminCtx(db),
        input: {
          ticketId: "ticket-1",
          resolution: "REPLACEMENT",
        },
      });

      expect(result).toEqual({
        resolved: true,
        ticketId: "ticket-1",
        resolution: "REPLACEMENT",
      });
      // Order restored to PROCESSING for re-fulfillment
      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "PROCESSING" },
        }),
      );
    });

    it("rejects refund when no captured payment exists", async () => {
      db.supportTicket.findUnique.mockResolvedValue({
        id: "ticket-1",
        category: "DISPUTE",
        status: "OPEN",
        orderId: "order-1",
        userId: "user-1",
      });
      db.order.findUnique.mockResolvedValue({
        id: "order-1",
        status: "DISPUTED",
        totalFils: 50000,
      });
      db.payment.findFirst.mockResolvedValue(null);

      await expect(
        callProcedure(commerceRouter.resolveDispute, {
          ctx: adminCtx(db),
          input: {
            ticketId: "ticket-1",
            resolution: "FULL_REFUND",
          },
        }),
      ).rejects.toThrow("No captured payment found");
    });
  });
});
