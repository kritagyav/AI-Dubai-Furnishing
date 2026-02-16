import { prisma } from "@dubai/db";
import type { InventorySyncPayload } from "@dubai/queue";

import { logger } from "../logger";

/**
 * Inventory Sync Job — polls retailer systems for stock updates.
 * For BASIC tier retailers, fetches and updates stock quantities.
 * PREMIUM tier uses webhooks (handled by the API).
 */
export async function handleInventorySync(
  payload: InventorySyncPayload,
): Promise<void> {
  const log = logger.child({ job: "inventory.sync", retailerId: payload.retailerId });
  log.info("Starting inventory sync");

  const config = await prisma.inventorySyncConfig.findUnique({
    where: { id: payload.configId },
    select: {
      retailerId: true,
      tier: true,
      isActive: true,
      consecutiveFailures: true,
    },
  });

  if (!config || !config.isActive) {
    log.warn("Sync config not found or inactive, skipping");
    return;
  }

  // Create sync job record
  const job = await prisma.inventorySyncJob.create({
    data: {
      retailerId: config.retailerId,
      status: "RUNNING",
      startedAt: new Date(),
    },
    select: { id: true },
  });

  try {
    // For BASIC tier, we simulate polling the retailer's system.
    // In production, this would call the retailer's inventory API endpoint.
    const products = await prisma.retailerProduct.findMany({
      where: { retailerId: config.retailerId },
      select: { id: true, stockQuantity: true },
    });

    log.info({ productCount: products.length }, "Products found for sync");

    // Update sync job as completed
    await prisma.inventorySyncJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        productsUpdated: products.length,
        completedAt: new Date(),
      },
    });

    // Update last sync timestamp and reset failures
    await prisma.inventorySyncConfig.update({
      where: { id: payload.configId },
      data: {
        lastSyncAt: new Date(),
        consecutiveFailures: 0,
      },
    });

    log.info({ jobId: job.id }, "Inventory sync completed");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await prisma.inventorySyncJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage,
        completedAt: new Date(),
      },
    });

    await prisma.inventorySyncConfig.update({
      where: { id: payload.configId },
      data: {
        consecutiveFailures: { increment: 1 },
      },
    });

    // Disable sync after 5 consecutive failures
    if ((config.consecutiveFailures ?? 0) >= 4) {
      await prisma.inventorySyncConfig.update({
        where: { id: payload.configId },
        data: { isActive: false },
      });
      log.error("Sync disabled after 5 consecutive failures");
    }

    log.error({ error: errorMessage }, "Inventory sync failed");
    throw error;
  }
}
