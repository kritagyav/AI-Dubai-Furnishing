import { createHmac } from "node:crypto";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { publicProcedure } from "../trpc";

/**
 * Compute HMAC-SHA256 signature for webhook verification.
 */
function computeHmac(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Verify the webhook signature from the request headers.
 * Uses HMAC-SHA256 with the signing secret.
 *
 * Signature format: HMAC-SHA256 of `${timestamp}.${JSON.stringify(body)}`
 */
function verifyWebhookSignature(
  body: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
): void {
  if (!signature || !timestamp) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing webhook signature or timestamp headers",
    });
  }

  // Reject timestamps older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Webhook timestamp is too old or invalid",
    });
  }

  const expectedSignature = computeHmac(`${timestamp}.${body}`, secret);
  if (signature !== expectedSignature) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid webhook signature",
    });
  }
}

const webhookProductSchema = z.object({
  sku: z.string().min(1).max(200),
  stockQuantity: z.number().int().nonnegative(),
  priceFils: z.number().int().positive().optional(),
});

const receiveInventoryWebhookInput = z.object({
  retailerId: z.uuid(),
  products: z.array(webhookProductSchema).min(1).max(1000),
  // The signature and timestamp are passed in the body for tRPC procedures
  // (since tRPC doesn't give direct header access in input parsing).
  // Alternatively, they can be sent as headers and accessed via ctx.headers.
  _signature: z.string().optional(),
  _timestamp: z.string().optional(),
});

/**
 * Webhook router — inbound webhooks for PREMIUM-tier retailers.
 *
 * These endpoints use `publicProcedure` because they are called by external
 * systems (retailer inventory systems) that authenticate via webhook signatures
 * rather than Supabase sessions.
 */
export const webhookRouter = {
  /**
   * Receive inventory updates from PREMIUM-tier retailers via webhook push.
   *
   * Authentication:
   *   - Verifies retailer has PREMIUM-tier sync config
   *   - If WEBHOOK_SIGNING_SECRET is set, verifies X-Webhook-Signature and
   *     X-Webhook-Timestamp headers (or _signature/_timestamp body fields)
   *
   * For each product in the payload:
   *   - Finds by SKU + retailerId
   *   - Updates stockQuantity (and optionally priceFils)
   *   - Marks updatedAt
   *
   * Creates an InventorySyncJob record with status COMPLETED.
   * Updates the sync config's lastSyncAt.
   */
  receiveInventoryWebhook: publicProcedure
    .input(receiveInventoryWebhookInput)
    .mutation(async ({ ctx, input }) => {
      // Look up the retailer's sync config
      const syncConfig = await ctx.db.inventorySyncConfig.findFirst({
        where: { retailerId: input.retailerId, isActive: true },
        select: {
          id: true,
          retailerId: true,
          tier: true,
          webhookSecret: true,
        },
      });

      if (!syncConfig) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active inventory sync config found for this retailer",
        });
      }

      // Verify PREMIUM tier
      if (syncConfig.tier !== "PREMIUM") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Only PREMIUM-tier retailers can push inventory updates via webhook",
        });
      }

      // Verify webhook signature if signing secret is configured
      const signingSecret =
        syncConfig.webhookSecret ?? process.env.WEBHOOK_SIGNING_SECRET;

      if (signingSecret) {
        // Try headers first, fall back to body fields
        const signature =
          ctx.headers.get("x-webhook-signature") ?? input._signature ?? null;
        const timestamp =
          ctx.headers.get("x-webhook-timestamp") ?? input._timestamp ?? null;

        // Build the body string for verification (excluding signature fields)
        const bodyForSigning = JSON.stringify({
          retailerId: input.retailerId,
          products: input.products,
        });

        verifyWebhookSignature(
          bodyForSigning,
          signature,
          timestamp,
          signingSecret,
        );
      }

      // Process the inventory updates
      let updated = 0;
      const notFound: string[] = [];

      for (const product of input.products) {
        const existing = await ctx.db.retailerProduct.findUnique({
          where: {
            retailerId_sku: {
              retailerId: input.retailerId,
              sku: product.sku,
            },
          },
          select: { id: true },
        });

        if (!existing) {
          notFound.push(product.sku);
          continue;
        }

        await ctx.db.retailerProduct.update({
          where: { id: existing.id },
          data: {
            stockQuantity: product.stockQuantity,
            ...(product.priceFils !== undefined
              ? { priceFils: product.priceFils }
              : {}),
          },
        });

        updated++;
      }

      // Create a sync job record
      await ctx.db.inventorySyncJob.create({
        data: {
          retailerId: input.retailerId,
          status: "COMPLETED",
          productsUpdated: updated,
          productsErrored: notFound.length,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      // Update last sync timestamp
      await ctx.db.inventorySyncConfig.update({
        where: { id: syncConfig.id },
        data: {
          lastSyncAt: new Date(),
          consecutiveFailures: 0,
        },
      });

      return { updated, notFound };
    }),
} satisfies TRPCRouterRecord;
