// Background Worker Process
// Processes jobs for async operations:
// - Inventory sync (polling retailers on schedule)
// - Commission calculation
// - Notification dispatch
// - Delivery reminders
// - Cart abandonment detection
//
// Currently runs as a simple interval-based scheduler.
// When BullMQ is added, replace with proper queue consumers.

import { prisma } from "@dubai/db";

import { initSentry } from "./sentry";
import { logger } from "./logger";
import { startHealthServer } from "./health";
import { handleInventorySync } from "./jobs/inventory-sync";
import { handleCartAbandonCheck } from "./jobs/cart-abandon";
import { handleDeliveryRemind } from "./jobs/delivery-remind";

initSentry();

logger.info("Worker starting...");

startHealthServer();

// ─── Scheduled Tasks ───

/**
 * Poll-based inventory sync: find all BASIC-tier retailers due for sync.
 */
async function runInventorySyncScheduler() {
  try {
    const configs = await prisma.inventorySyncConfig.findMany({
      where: {
        tier: "BASIC",
        isActive: true,
      },
      select: {
        id: true,
        retailerId: true,
        tier: true,
        pollingInterval: true,
        lastSyncAt: true,
      },
    });

    for (const config of configs) {
      const intervalMs = config.pollingInterval * 60 * 1000;
      const lastSync = config.lastSyncAt?.getTime() ?? 0;
      const now = Date.now();

      if (now - lastSync >= intervalMs) {
        logger.info(
          { retailerId: config.retailerId },
          "Triggering scheduled inventory sync",
        );
        await handleInventorySync({
          retailerId: config.retailerId,
          configId: config.id,
          tier: config.tier,
        }).catch((err) => {
          logger.error({ err, retailerId: config.retailerId }, "Sync failed");
        });
      }
    }
  } catch (err) {
    logger.error({ err }, "Inventory sync scheduler error");
  }
}

/**
 * Check for abandoned carts (carts not updated in 2+ hours).
 */
async function runAbandonedCartCheck() {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const carts = await prisma.cart.findMany({
      where: {
        updatedAt: { lt: twoHoursAgo },
        items: { some: {} },
      },
      select: { id: true, userId: true },
      take: 50,
    });

    for (const cart of carts) {
      // Check if already tracked
      const existing = await prisma.abandonedCart.findFirst({
        where: {
          userId: cart.userId,
          createdAt: { gte: twoHoursAgo },
        },
        select: { id: true },
      });

      if (!existing) {
        await handleCartAbandonCheck({
          userId: cart.userId,
          cartId: cart.id,
        }).catch((err) => {
          logger.error({ err, cartId: cart.id }, "Abandon check failed");
        });
      }
    }
  } catch (err) {
    logger.error({ err }, "Abandoned cart check error");
  }
}

/**
 * Send reminders for deliveries scheduled within 24 hours.
 */
async function runDeliveryReminders() {
  try {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const now = new Date();

    const deliveries = await prisma.deliverySchedule.findMany({
      where: {
        status: "SCHEDULED",
        scheduledDate: { gte: now, lte: tomorrow },
      },
      select: { id: true },
      take: 100,
    });

    for (const delivery of deliveries) {
      await handleDeliveryRemind({ deliveryId: delivery.id }).catch((err) => {
        logger.error(
          { err, deliveryId: delivery.id },
          "Delivery remind failed",
        );
      });
    }
  } catch (err) {
    logger.error({ err }, "Delivery reminder scheduler error");
  }
}

// ─── Start Intervals ───

// Inventory sync: every 5 minutes
setInterval(() => void runInventorySyncScheduler(), 5 * 60 * 1000);

// Abandoned cart check: every 30 minutes
setInterval(() => void runAbandonedCartCheck(), 30 * 60 * 1000);

// Delivery reminders: every hour
setInterval(() => void runDeliveryReminders(), 60 * 60 * 1000);

logger.info("Worker schedulers registered");

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down...");
  process.exit(0);
});
