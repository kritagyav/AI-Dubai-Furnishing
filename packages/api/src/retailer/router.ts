import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@dubai/db";
import {
  inventoryUpdateInput,
  registerRetailerInput,
  registerSyncConfigInput,
  submitRetailerDocumentsInput,
} from "@dubai/validators";

import { authedProcedure, retailerProcedure } from "../trpc";

type JsonValue = Prisma.InputJsonValue;

/**
 * Retailer router — Story 5.1: Retailer Onboarding Portal.
 *
 * Handles retailer registration, application submission,
 * and retailer-side account management.
 */
export const retailerRouter = {
  /**
   * Register as a retailer — creates Retailer record and
   * assigns RETAILER_ADMIN role to the user.
   */
  register: authedProcedure
    .input(registerRetailerInput)
    .mutation(async ({ ctx, input }) => {
      // Check user doesn't already have a retailer account
      const existing = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have a retailer account",
        });
      }

      const warehouseJson = input.warehouseDetails
        ? ({ details: input.warehouseDetails } as JsonValue)
        : undefined;

      // Create retailer and update user role in a transaction
      const retailer = await ctx.db.$transaction(async (tx) => {
        const r = await tx.retailer.create({
          data: {
            userId: ctx.user.id,
            companyName: input.companyName,
            tradeLicenseNumber: input.tradeLicenseNumber,
            contactEmail: input.contactEmail,
            contactPhone: input.contactPhone ?? null,
            businessType: input.businessType ?? null,
            ...(warehouseJson !== undefined ? { warehouseDetails: warehouseJson } : {}),
            status: "PENDING",
          },
          select: {
            id: true,
            tenantId: true,
            companyName: true,
            status: true,
            createdAt: true,
          },
        });

        // Update user role and tenantId
        await tx.user.update({
          where: { id: ctx.user.id },
          data: { role: "RETAILER_ADMIN", tenantId: r.tenantId },
        });

        return r;
      });

      return retailer;
    }),

  /**
   * Submit supporting documents for the application.
   */
  submitDocuments: authedProcedure
    .input(submitRetailerDocumentsInput)
    .mutation(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true, status: true },
      });

      if (!retailer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No retailer account found. Register first.",
        });
      }

      if (retailer.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Documents can only be submitted while application is pending",
        });
      }

      return ctx.db.retailer.update({
        where: { id: retailer.id },
        data: { documentsUrl: input.documentsUrl },
        select: { id: true, documentsUrl: true },
      });
    }),

  /**
   * Get the current user's retailer application status.
   */
  getApplicationStatus: authedProcedure.query(async ({ ctx }) => {
    const retailer = await ctx.db.retailer.findUnique({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        companyName: true,
        status: true,
        rejectionReason: true,
        documentsUrl: true,
        createdAt: true,
      },
    });

    if (!retailer) {
      return { hasApplication: false as const };
    }

    return {
      hasApplication: true as const,
      ...retailer,
    };
  }),

  /**
   * Get the retailer dashboard summary (for approved retailers).
   */
  getDashboard: retailerProcedure.query(async ({ ctx }) => {
    const retailer = await ctx.db.retailer.findUnique({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        companyName: true,
        status: true,
        commissionRate: true,
        _count: { select: { products: true } },
      },
    });

    if (!retailer || retailer.status !== "APPROVED") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Retailer account not approved",
      });
    }

    // Get product validation summary
    const productStats = await ctx.db.retailerProduct.groupBy({
      by: ["validationStatus"],
      where: { retailerId: retailer.id },
      _count: true,
    });

    const stats = {
      total: retailer._count.products,
      active: 0,
      pending: 0,
      rejected: 0,
    };

    for (const group of productStats) {
      if (group.validationStatus === "ACTIVE") stats.active = group._count;
      else if (group.validationStatus === "PENDING") stats.pending = group._count;
      else if (group.validationStatus === "REJECTED") stats.rejected = group._count;
    }

    return {
      companyName: retailer.companyName,
      commissionRate: retailer.commissionRate,
      productStats: stats,
    };
  }),

  // ─── Story 5.3: Inventory Sync ───

  /**
   * Register or update inventory sync configuration.
   * PREMIUM tier = webhook push; BASIC tier = platform polling.
   */
  registerSyncConfig: retailerProcedure
    .input(registerSyncConfigInput)
    .mutation(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true, status: true },
      });

      if (!retailer || retailer.status !== "APPROVED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only approved retailers can configure sync",
        });
      }

      if (input.tier === "PREMIUM" && !input.webhookUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Webhook URL is required for premium tier",
        });
      }

      const config = await ctx.db.inventorySyncConfig.upsert({
        where: { retailerId: retailer.id },
        create: {
          retailerId: retailer.id,
          tier: input.tier,
          webhookUrl: input.webhookUrl ?? null,
          pollingInterval: input.pollingInterval ?? 60,
          isActive: true,
        },
        update: {
          tier: input.tier,
          webhookUrl: input.webhookUrl ?? null,
          ...(input.pollingInterval !== undefined
            ? { pollingInterval: input.pollingInterval }
            : {}),
          isActive: true,
          consecutiveFailures: 0,
        },
        select: {
          id: true,
          tier: true,
          webhookUrl: true,
          pollingInterval: true,
          isActive: true,
          lastSyncAt: true,
        },
      });

      return config;
    }),

  /**
   * Get current sync configuration and status.
   */
  getSyncStatus: retailerProcedure.query(async ({ ctx }) => {
    const retailer = await ctx.db.retailer.findUnique({
      where: { userId: ctx.user.id },
      select: { id: true },
    });

    if (!retailer) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
    }

    const config = await ctx.db.inventorySyncConfig.findUnique({
      where: { retailerId: retailer.id },
      select: {
        id: true,
        tier: true,
        webhookUrl: true,
        pollingInterval: true,
        isActive: true,
        lastSyncAt: true,
        consecutiveFailures: true,
      },
    });

    // Get recent sync jobs
    const recentJobs = await ctx.db.inventorySyncJob.findMany({
      where: { retailerId: retailer.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        productsUpdated: true,
        productsErrored: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return { config, recentJobs };
  }),

  /**
   * Process incoming inventory updates from retailer webhook or manual push.
   * Updates stock quantities (and optionally prices) by SKU.
   */
  pushInventoryUpdate: retailerProcedure
    .input(inventoryUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true, tenantId: true, status: true },
      });

      if (!retailer || retailer.status !== "APPROVED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only approved retailers can push inventory updates",
        });
      }

      // Create a sync job record
      const job = await ctx.db.inventorySyncJob.create({
        data: {
          retailerId: retailer.id,
          status: "RUNNING",
          startedAt: new Date(),
        },
        select: { id: true },
      });

      let updated = 0;
      let errored = 0;

      for (const item of input.updates) {
        try {
          const product = await ctx.db.retailerProduct.findFirst({
            where: { retailerId: retailer.id, sku: item.sku },
            select: { id: true },
          });

          if (!product) {
            errored++;
            continue;
          }

          await ctx.db.retailerProduct.update({
            where: { id: product.id },
            data: {
              stockQuantity: item.stockQuantity,
              ...(item.priceFils !== undefined ? { priceFils: item.priceFils } : {}),
            },
          });
          updated++;
        } catch {
          errored++;
        }
      }

      // Update job and sync config
      await ctx.db.inventorySyncJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          productsUpdated: updated,
          productsErrored: errored,
          completedAt: new Date(),
        },
      });

      await ctx.db.inventorySyncConfig.updateMany({
        where: { retailerId: retailer.id },
        data: {
          lastSyncAt: new Date(),
          consecutiveFailures: 0,
        },
      });

      return { jobId: job.id, updated, errored, total: input.updates.length };
    }),
} satisfies TRPCRouterRecord;
