// Background Worker Process — BullMQ Consumer
//
// Processes typed jobs from the "dubai-jobs" queue and runs
// scheduled scanners via BullMQ repeatable jobs.

import { Worker } from "bullmq";
import { prisma } from "@dubai/db";
import {
  QUEUE_NAME,
  getQueue,
  closeQueue,
  type JobName,
  type JobPayloadMap,
} from "@dubai/queue";

import { initSentry } from "./sentry";
import { logger } from "./logger";
import { startHealthServer } from "./health";
import { handleInventorySync } from "./jobs/inventory-sync";
import { handleCartAbandonCheck } from "./jobs/cart-abandon";
import { handleDeliveryRemind } from "./jobs/delivery-remind";
import { handleCommissionCalculate } from "./jobs/commission";
import { handleNotificationSend } from "./jobs/notification";
import { handlePackageGenerate } from "./jobs/package-generate";
import { handleAnalyticsTrack } from "./jobs/analytics-track";
import { handleReEngagement } from "./jobs/re-engagement";
import { handleCatalogHealthCheck } from "./jobs/catalog-health";
import { enqueue } from "@dubai/queue";

initSentry();

logger.info("Worker starting...");

startHealthServer();

// ─── Redis Connection ───

function getRedisUrl(): string {
  return process.env.BULLMQ_REDIS_URL ?? "redis://localhost:6379";
}

function parseRedisConnection(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    ...(parsed.password ? { password: parsed.password } : {}),
  };
}

const connection = parseRedisConnection(getRedisUrl());

// ─── Job Dispatch Map ───

const jobHandlers: Record<string, (payload: never) => Promise<void>> = {
  "inventory.sync": handleInventorySync as (payload: never) => Promise<void>,
  "notification.send": handleNotificationSend as (payload: never) => Promise<void>,
  "commission.calculate": handleCommissionCalculate as (payload: never) => Promise<void>,
  "delivery.remind": handleDeliveryRemind as (payload: never) => Promise<void>,
  "package.generate": handlePackageGenerate as (payload: never) => Promise<void>,
  "cart.abandon-check": handleCartAbandonCheck as (payload: never) => Promise<void>,
  "analytics.track": handleAnalyticsTrack as (payload: never) => Promise<void>,
  "re-engagement.process": handleReEngagement as (payload: never) => Promise<void>,
  "catalog.health-check": handleCatalogHealthCheck as (payload: never) => Promise<void>,
};

// ─── Scheduled Scanners ───

/**
 * Scan for BASIC-tier retailers due for inventory sync and enqueue individual jobs.
 */
async function scanInventorySync() {
  const configs = await prisma.inventorySyncConfig.findMany({
    where: { tier: "BASIC", isActive: true },
    select: {
      id: true,
      retailerId: true,
      tier: true,
      pollingInterval: true,
      lastSyncAt: true,
    },
  });

  let enqueued = 0;
  for (const config of configs) {
    const intervalMs = config.pollingInterval * 60 * 1000;
    const lastSync = config.lastSyncAt?.getTime() ?? 0;
    if (Date.now() - lastSync >= intervalMs) {
      await enqueue("inventory.sync", {
        retailerId: config.retailerId,
        configId: config.id,
        tier: config.tier,
      });
      enqueued++;
    }
  }

  logger.info({ enqueued, total: configs.length }, "Inventory sync scan complete");
}

/**
 * Scan for abandoned carts (not updated in 2+ hours) and enqueue check jobs.
 */
async function scanAbandonedCarts() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const carts = await prisma.cart.findMany({
    where: {
      updatedAt: { lt: twoHoursAgo },
      items: { some: {} },
    },
    select: { id: true, userId: true },
    take: 50,
  });

  let enqueued = 0;
  for (const cart of carts) {
    const existing = await prisma.abandonedCart.findFirst({
      where: {
        userId: cart.userId,
        createdAt: { gte: twoHoursAgo },
      },
      select: { id: true },
    });

    if (!existing) {
      await enqueue("cart.abandon-check", {
        userId: cart.userId,
        cartId: cart.id,
      });
      enqueued++;
    }
  }

  logger.info({ enqueued, total: carts.length }, "Abandoned cart scan complete");
}

/**
 * Scan for active re-engagement sequences due for processing.
 * Enqueues a single re-engagement.process job to handle the batch.
 */
async function scanReEngagement() {
  await enqueue("re-engagement.process", {});
  logger.info("Re-engagement scan: enqueued processing job");
}

/**
 * Scan for upcoming deliveries and enqueue reminder jobs.
 */
async function scanDeliveryReminders() {
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
    await enqueue("delivery.remind", { deliveryId: delivery.id });
  }

  logger.info({ enqueued: deliveries.length }, "Delivery reminder scan complete");
}

const schedulerHandlers: Record<string, () => Promise<void>> = {
  "scheduler.inventory-scan": scanInventorySync,
  "scheduler.cart-abandon-scan": scanAbandonedCarts,
  "scheduler.delivery-remind-scan": scanDeliveryReminders,
  "scheduler.re-engagement-scan": scanReEngagement,
};

// ─── BullMQ Worker ───

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const log = logger.child({ jobName: job.name, jobId: job.id });
    log.info("Processing job");

    const handler = jobHandlers[job.name];
    if (handler) {
      await handler(job.data as never);
      return;
    }

    const scheduler = schedulerHandlers[job.name];
    if (scheduler) {
      await scheduler();
      return;
    }

    log.warn("Unknown job name, skipping");
  },
  {
    connection,
    concurrency: 5,
  },
);

// ─── Register Repeatable Jobs ───

async function registerRepeatableJobs() {
  const queue = getQueue();

  // Inventory sync scan: every 5 minutes
  await queue.add("scheduler.inventory-scan", {}, {
    repeat: { every: 5 * 60 * 1000 },
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 },
  });

  // Cart abandon scan: every 30 minutes
  await queue.add("scheduler.cart-abandon-scan", {}, {
    repeat: { every: 30 * 60 * 1000 },
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 },
  });

  // Delivery reminder scan: every hour
  await queue.add("scheduler.delivery-remind-scan", {}, {
    repeat: { every: 60 * 60 * 1000 },
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 },
  });

  // Re-engagement scan: every 15 minutes
  await queue.add("scheduler.re-engagement-scan", {}, {
    repeat: { every: 15 * 60 * 1000 },
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 },
  });

  logger.info("Repeatable scheduler jobs registered");
}

void registerRepeatableJobs();

// ─── Worker Events ───

worker.on("completed", (job) => {
  logger.info({ jobName: job.name, jobId: job.id }, "Job completed");
});

worker.on("failed", (job, err) => {
  logger.error(
    { jobName: job?.name, jobId: job?.id, err: err.message },
    "Job failed",
  );
});

logger.info("BullMQ worker started");

// ─── Graceful Shutdown ───

async function shutdown() {
  logger.info("Shutting down worker...");
  await worker.close();
  await closeQueue();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
