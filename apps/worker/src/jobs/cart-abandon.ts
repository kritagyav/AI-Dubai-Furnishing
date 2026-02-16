import type { CartAbandonCheckPayload } from "@dubai/queue";
import { prisma } from "@dubai/db";

import { logger } from "../logger";

/**
 * Cart Abandon Check Job — detects abandoned carts and creates
 * re-engagement sequences.
 */
export async function handleCartAbandonCheck(
  payload: CartAbandonCheckPayload,
): Promise<void> {
  const log = logger.child({
    job: "cart.abandon-check",
    userId: payload.userId,
  });
  log.info("Checking for abandoned cart");

  const cart = await prisma.cart.findUnique({
    where: { id: payload.cartId },
    select: {
      id: true,
      userId: true,
      updatedAt: true,
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
    log.info("Cart empty or not found, skipping");
    return;
  }

  // Cart is considered abandoned if not updated in 2+ hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  if (cart.updatedAt > twoHoursAgo) {
    log.info("Cart recently active, not abandoned");
    return;
  }

  const totalFils = cart.items.reduce(
    (sum, item) => sum + item.priceFils * item.quantity,
    0,
  );

  // Create abandoned cart record
  await prisma.abandonedCart.create({
    data: {
      userId: cart.userId,
      cartSnapshot: cart.items,
      totalFils,
    },
  });

  // Create re-engagement sequence
  await prisma.reEngagementSequence.create({
    data: {
      userId: cart.userId,
      trigger: "cart_abandoned",
      status: "ACTIVE",
      totalSteps: 3,
      nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h later
    },
  });

  // Send notification
  await prisma.notification.create({
    data: {
      userId: cart.userId,
      type: "SYSTEM",
      channel: "IN_APP",
      title: "You left items in your cart",
      body: "Complete your order before items sell out!",
      data: { cartId: cart.id, totalFils },
      sentAt: new Date(),
    },
  });

  log.info({ totalFils }, "Abandoned cart recorded and notifications sent");
}
