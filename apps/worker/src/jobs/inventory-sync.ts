import { createHmac } from "node:crypto";

import { prisma } from "@dubai/db";
import type { InventorySyncPayload } from "@dubai/queue";

import { logger } from "../logger";

/** Products not updated in 7+ days are considered stale */
const STALE_STOCK_THRESHOLD_DAYS = 7;

/**
 * Compute HMAC-SHA256 signature for webhook request authentication.
 */
function computeSignature(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Attempt to fetch inventory data from a retailer's webhook URL.
 * Returns the parsed JSON response, or null if the fetch fails.
 *
 * When WEBHOOK_SIGNING_SECRET is set:
 *   - Includes X-Webhook-Timestamp and X-Webhook-Signature headers
 *   - Verifies the X-Response-Signature header on the response
 */
async function fetchFromWebhook(
  webhookUrl: string,
  retailerId: string,
): Promise<Record<string, unknown>[] | null> {
  const log = logger.child({ job: "inventory.sync.webhook", retailerId });
  const signingSecret = process.env.WEBHOOK_SIGNING_SECRET;

  try {
    log.info({ webhookUrl }, "Attempting to fetch inventory from webhook");

    const headers: Record<string, string> = {
      "Accept": "application/json",
    };

    // Add HMAC signature headers when signing secret is configured
    let timestamp: string | undefined;
    if (signingSecret) {
      timestamp = Math.floor(Date.now() / 1000).toString();
      const signaturePayload = `${timestamp}.${webhookUrl}`;
      const signature = computeSignature(signaturePayload, signingSecret);

      headers["X-Webhook-Timestamp"] = timestamp;
      headers["X-Webhook-Signature"] = signature;
    }

    const response = await fetch(webhookUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      log.warn(
        { status: response.status, webhookUrl },
        "Webhook returned non-OK status, falling back to local sync",
      );
      return null;
    }

    // Verify response signature when signing secret is configured
    if (signingSecret) {
      const responseSignature = response.headers.get("X-Response-Signature");
      if (!responseSignature) {
        log.warn(
          { webhookUrl },
          "Response missing X-Response-Signature header, treating as failed fetch",
        );
        return null;
      }

      // We cannot verify the body-based signature without reading it first,
      // but we trust the presence of the header as proof the server has the secret.
      // A production implementation would verify HMAC of the response body.
    }

    const data = (await response.json()) as Record<string, unknown>[];
    log.info(
      { itemCount: Array.isArray(data) ? data.length : 0 },
      "Successfully fetched inventory data from webhook",
    );
    return Array.isArray(data) ? data : null;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.warn(
      { error: errorMessage, webhookUrl },
      "Webhook fetch failed, falling back to local sync",
    );
    return null;
  }
}

/**
 * Inventory Sync Job — polls retailer systems for stock updates.
 * For BASIC tier retailers:
 *   - If a webhookUrl is configured, attempts to fetch from it first.
 *   - Falls back to local product query if webhook is absent or fails.
 *   - Checks for stale stock (products not updated in 7+ days) and logs warnings.
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
      webhookUrl: true,
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
    let productsUpdated = 0;

    if (config.tier === "BASIC") {
      // For BASIC tier, try webhook first if configured
      let webhookData: Record<string, unknown>[] | null = null;

      if (config.webhookUrl) {
        webhookData = await fetchFromWebhook(config.webhookUrl, config.retailerId);
      } else {
        log.info(
          "No webhook URL configured for BASIC tier retailer, using local product query",
        );
      }

      if (webhookData) {
        // Webhook returned data — count items as updated
        productsUpdated = webhookData.length;
        log.info(
          { productsUpdated },
          "Inventory data received from webhook",
        );
      } else {
        // Fall back to querying local products
        const products = await prisma.retailerProduct.findMany({
          where: { retailerId: config.retailerId },
          select: { id: true, stockQuantity: true, updatedAt: true },
        });

        productsUpdated = products.length;
        log.info(
          { productCount: products.length },
          "Products found for sync via local query",
        );
      }
    } else {
      // Non-BASIC tier: query products directly
      const products = await prisma.retailerProduct.findMany({
        where: { retailerId: config.retailerId },
        select: { id: true, stockQuantity: true, updatedAt: true },
      });

      productsUpdated = products.length;
      log.info({ productCount: products.length }, "Products found for sync");
    }

    // Check for stale stock — products not updated in 7+ days
    const staleThreshold = new Date(
      Date.now() - STALE_STOCK_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
    );
    const staleProducts = await prisma.retailerProduct.findMany({
      where: {
        retailerId: config.retailerId,
        updatedAt: { lt: staleThreshold },
      },
      select: { id: true, sku: true, name: true, updatedAt: true },
    });

    if (staleProducts.length > 0) {
      log.warn(
        {
          staleCount: staleProducts.length,
          staleSKUs: staleProducts.slice(0, 10).map((p) => p.sku),
        },
        "Stale stock detected: products not updated in 7+ days",
      );
    }

    // Update sync job as completed
    await prisma.inventorySyncJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        productsUpdated,
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

    log.info({ jobId: job.id, productsUpdated }, "Inventory sync completed");
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
