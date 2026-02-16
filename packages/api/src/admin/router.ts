import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { paginationInput, retailerDecisionInput, listOrdersInput, listSettlementsInput, listCatalogIssuesInput } from "@dubai/validators";
import { z } from "zod/v4";

import { adminProcedure, auditedProcedure } from "../trpc";

/**
 * Admin router — includes retailer approval workflow (Story 5.1).
 */
export const adminRouter = {
  /**
   * List pending retailer applications for admin review.
   */
  listPendingRetailers: adminProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      const retailers = await ctx.db.retailer.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          companyName: true,
          tradeLicenseNumber: true,
          contactEmail: true,
          businessType: true,
          documentsUrl: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (retailers.length > input.limit) {
        const next = retailers.pop();
        nextCursor = next?.id;
      }

      return { items: retailers, nextCursor };
    }),

  /**
   * Get a specific retailer application for detailed review.
   */
  getRetailerApplication: adminProcedure
    .input(z.object({ retailerId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { id: input.retailerId },
        select: {
          id: true,
          companyName: true,
          tradeLicenseNumber: true,
          contactEmail: true,
          contactPhone: true,
          businessType: true,
          status: true,
          rejectionReason: true,
          warehouseDetails: true,
          documentsUrl: true,
          createdAt: true,
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      return retailer;
    }),

  /**
   * Approve or reject a retailer application.
   * Uses auditedProcedure for automatic audit trail.
   */
  decideRetailer: auditedProcedure
    .input(retailerDecisionInput)
    .mutation(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { id: input.retailerId },
        select: { id: true, status: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      if (retailer.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Retailer application is already ${retailer.status.toLowerCase()}`,
        });
      }

      const updated = await ctx.db.retailer.update({
        where: { id: input.retailerId },
        data: {
          status: input.decision,
          rejectionReason: input.decision === "REJECTED" ? (input.reason ?? null) : null,
        },
        select: {
          id: true,
          companyName: true,
          status: true,
          rejectionReason: true,
        },
      });

      return updated;
    }),

  // ─── All retailers (any status) ───

  listRetailers: adminProcedure
    .input(
      paginationInput.extend({
        status: z
          .enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"])
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = input.status ? { status: input.status } : {};

      const retailers = await ctx.db.retailer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          companyName: true,
          tradeLicenseNumber: true,
          contactEmail: true,
          businessType: true,
          status: true,
          commissionRate: true,
          createdAt: true,
          _count: { select: { products: true } },
        },
      });

      let nextCursor: string | undefined;
      if (retailers.length > input.limit) {
        const next = retailers.pop();
        nextCursor = next?.id;
      }

      return { items: retailers, nextCursor };
    }),

  // ─── All orders (platform-wide) ───

  listAllOrders: adminProcedure
    .input(listOrdersInput)
    .query(async ({ ctx, input }) => {
      const where = input.status ? { status: input.status } : {};

      const items = await ctx.db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          orderRef: true,
          userId: true,
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

  // ─── Platform-wide aggregate stats ───

  platformStats: adminProcedure.query(async ({ ctx }) => {
    const [
      orderCount,
      revenueAgg,
      retailerCounts,
      ticketCounts,
    ] = await Promise.all([
      ctx.db.order.count(),
      ctx.db.order.aggregate({ _sum: { totalFils: true } }),
      ctx.db.retailer.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      ctx.db.supportTicket.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const retailerMap = Object.fromEntries(
      retailerCounts.map((r) => [r.status, r._count._all]),
    );
    const ticketMap = Object.fromEntries(
      ticketCounts.map((t) => [t.status, t._count._all]),
    );

    return {
      orders: {
        total: orderCount,
        revenueFils: revenueAgg._sum.totalFils ?? 0,
      },
      retailers: {
        approved: retailerMap["APPROVED"] ?? 0,
        pending: retailerMap["PENDING"] ?? 0,
        total:
          (retailerMap["APPROVED"] ?? 0) +
          (retailerMap["PENDING"] ?? 0) +
          (retailerMap["REJECTED"] ?? 0) +
          (retailerMap["SUSPENDED"] ?? 0),
      },
      tickets: {
        open: ticketMap["OPEN"] ?? 0,
        inProgress: ticketMap["IN_PROGRESS"] ?? 0,
        waitingOnCustomer: ticketMap["WAITING_ON_CUSTOMER"] ?? 0,
        resolved: ticketMap["RESOLVED"] ?? 0,
      },
    };
  }),

  // ─── Corporate accounts ───

  listCorporateAccounts: adminProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.corporateAccount.findMany({
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          companyName: true,
          contactEmail: true,
          contactPhone: true,
          discountBps: true,
          maxEmployees: true,
          isActive: true,
          createdAt: true,
          _count: { select: { employees: true } },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      return { items, nextCursor };
    }),

  // ─── Agent partners ───

  listAgentPartners: adminProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.agentPartner.findMany({
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          companyName: true,
          commissionRate: true,
          status: true,
          totalReferrals: true,
          totalEarningsFils: true,
          createdAt: true,
          _count: { select: { referrals: true } },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      return { items, nextCursor };
    }),

  // ─── Settlement workflow ───

  /**
   * Initiate a settlement for a retailer by bundling all CLEARED commissions.
   * Creates a CREDIT ledger entry and marks commissions as SETTLED.
   */
  initiateSettlement: auditedProcedure
    .input(z.object({ retailerId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { id: input.retailerId },
        select: { id: true, companyName: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      // Gather all CLEARED commissions for this retailer
      const clearedCommissions = await ctx.db.commission.findMany({
        where: { retailerId: retailer.id, status: "CLEARED" },
        select: { id: true, netAmountFils: true },
      });

      if (clearedCommissions.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No cleared commissions available for settlement",
        });
      }

      const totalAmountFils = clearedCommissions.reduce(
        (sum, c) => sum + c.netAmountFils,
        0,
      );

      // Use a transaction to ensure atomicity
      const settlement = await ctx.db.$transaction(async (tx) => {
        // Create the settlement record
        const newSettlement = await tx.settlement.create({
          data: {
            retailerId: retailer.id,
            totalAmountFils,
            commissionCount: clearedCommissions.length,
            status: "PENDING",
          },
          select: {
            id: true,
            totalAmountFils: true,
            commissionCount: true,
            status: true,
            createdAt: true,
          },
        });

        // Link commissions to settlement and mark as SETTLED
        await tx.commission.updateMany({
          where: {
            id: { in: clearedCommissions.map((c) => c.id) },
          },
          data: {
            status: "SETTLED",
            settlementId: newSettlement.id,
            settledAt: new Date(),
          },
        });

        // Create a CREDIT ledger entry
        await tx.ledgerEntry.create({
          data: {
            retailerId: retailer.id,
            type: "SETTLEMENT_PAYOUT",
            amountFils: totalAmountFils,
            referenceId: newSettlement.id,
            description: `Settlement payout for ${clearedCommissions.length} commissions`,
          },
        });

        return newSettlement;
      });

      return settlement;
    }),

  /**
   * List all settlements platform-wide with pagination.
   */
  listAllSettlements: adminProcedure
    .input(listSettlementsInput)
    .query(async ({ ctx, input }) => {
      const where = input.status ? { status: input.status } : {};

      const items = await ctx.db.settlement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          retailerId: true,
          totalAmountFils: true,
          commissionCount: true,
          status: true,
          payoutDate: true,
          transactionRef: true,
          createdAt: true,
          retailer: {
            select: { id: true, companyName: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      return { items, nextCursor };
    }),

  /**
   * Update a settlement's status with optional transaction reference.
   */
  updateSettlementStatus: adminProcedure
    .input(
      z.object({
        settlementId: z.uuid(),
        status: z.enum(["PROCESSING", "COMPLETED", "FAILED"]),
        transactionRef: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const settlement = await ctx.db.settlement.findUnique({
        where: { id: input.settlementId },
        select: { id: true, status: true },
      });

      if (!settlement) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Settlement not found",
        });
      }

      const updated = await ctx.db.settlement.update({
        where: { id: input.settlementId },
        data: {
          status: input.status,
          ...(input.transactionRef
            ? { transactionRef: input.transactionRef }
            : {}),
          ...(input.status === "COMPLETED"
            ? { payoutDate: new Date() }
            : {}),
        },
        select: {
          id: true,
          status: true,
          transactionRef: true,
          payoutDate: true,
          updatedAt: true,
        },
      });

      return updated;
    }),

  // ─── Catalog health (admin) ───

  /**
   * Trigger a catalog health check for a retailer.
   * Checks for stale stock (30 days), missing fields, pricing anomalies.
   */
  triggerCatalogHealthCheck: adminProcedure
    .input(z.object({ retailerId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { id: input.retailerId },
        select: { id: true, companyName: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      // Get all products for health analysis
      const products = await ctx.db.retailerProduct.findMany({
        where: { retailerId: retailer.id },
        select: {
          id: true,
          sku: true,
          name: true,
          photos: true,
          priceFils: true,
          stockQuantity: true,
          materials: true,
          updatedAt: true,
        },
      });

      const totalProducts = products.length;
      let staleProducts = 0;
      let missingFields = 0;
      let pricingIssues = 0;
      const newIssues: Array<{
        productId: string;
        issueType: string;
        severity: string;
        description: string;
        recommendation: string;
      }> = [];

      const now = new Date();
      const staleThresholdMs = 30 * 24 * 60 * 60 * 1000; // 30 days

      for (const product of products) {
        // Stale stock check (not updated in 30 days)
        const ageMs = now.getTime() - product.updatedAt.getTime();
        if (ageMs > staleThresholdMs) {
          staleProducts++;
          newIssues.push({
            productId: product.id,
            issueType: "STALE_STOCK",
            severity: ageMs > staleThresholdMs * 2 ? "HIGH" : "MEDIUM",
            description: `Product "${product.name}" has not been updated in ${Math.floor(ageMs / (24 * 60 * 60 * 1000))} days`,
            recommendation: "Sync inventory to update stock levels and pricing",
          });
        }

        // Missing fields: no photos
        const photos = product.photos as unknown[];
        if (!photos || (Array.isArray(photos) && photos.length === 0)) {
          missingFields++;
          newIssues.push({
            productId: product.id,
            issueType: "MISSING_FIELDS",
            severity: "HIGH",
            description: `Product "${product.name}" has no photos`,
            recommendation: "Add at least one product photo",
          });
        }

        // Missing fields: no materials
        const materials = product.materials as unknown[];
        if (!materials || (Array.isArray(materials) && materials.length === 0)) {
          missingFields++;
          newIssues.push({
            productId: product.id,
            issueType: "MISSING_FIELDS",
            severity: "LOW",
            description: `Product "${product.name}" has no materials listed`,
            recommendation: "Add material information for better AI matching",
          });
        }

        // Pricing anomaly: price < 100 fils or > 50M fils
        if (product.priceFils < 100) {
          pricingIssues++;
          newIssues.push({
            productId: product.id,
            issueType: "PRICING_ANOMALY",
            severity: "CRITICAL",
            description: `Product "${product.name}" has suspiciously low price: ${product.priceFils} fils`,
            recommendation: "Verify product price is correct",
          });
        } else if (product.priceFils > 50000000) {
          pricingIssues++;
          newIssues.push({
            productId: product.id,
            issueType: "PRICING_ANOMALY",
            severity: "MEDIUM",
            description: `Product "${product.name}" has unusually high price: ${(product.priceFils / 100).toFixed(2)} AED`,
            recommendation: "Verify that the price is correct",
          });
        }
      }

      const issuesFound = staleProducts + missingFields + pricingIssues;
      const maxDeductions = totalProducts * 4;
      const overallScore =
        totalProducts === 0
          ? 100
          : Math.max(
              0,
              Math.round(100 - (issuesFound / maxDeductions) * 100),
            );

      // Save health check record
      const healthCheck = await ctx.db.catalogHealthCheck.create({
        data: {
          retailerId: retailer.id,
          overallScore,
          totalProducts,
          issuesFound,
          staleProducts,
          missingFields,
          pricingIssues,
        },
      });

      // Resolve old issues and create new ones
      await ctx.db.catalogIssue.updateMany({
        where: { retailerId: retailer.id, resolved: false },
        data: { resolved: true, resolvedAt: now },
      });

      if (newIssues.length > 0) {
        await ctx.db.catalogIssue.createMany({
          data: newIssues.map((issue) => ({
            retailerId: retailer.id,
            productId: issue.productId,
            issueType: issue.issueType as "STALE_STOCK",
            severity: issue.severity as "LOW",
            description: issue.description,
            recommendation: issue.recommendation,
          })),
        });
      }

      return {
        healthCheckId: healthCheck.id,
        overallScore,
        totalProducts,
        issuesFound,
        breakdown: { staleProducts, missingFields, pricingIssues },
      };
    }),

  /**
   * Mark a catalog issue as resolved.
   */
  resolveCatalogIssue: adminProcedure
    .input(
      z.object({
        issueId: z.uuid(),
        resolution: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const issue = await ctx.db.catalogIssue.findUnique({
        where: { id: input.issueId },
        select: { id: true, resolved: true },
      });

      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Catalog issue not found",
        });
      }

      if (issue.resolved) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Issue is already resolved",
        });
      }

      const updated = await ctx.db.catalogIssue.update({
        where: { id: input.issueId },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          ...(input.resolution
            ? { recommendation: input.resolution }
            : {}),
        },
        select: {
          id: true,
          resolved: true,
          resolvedAt: true,
          recommendation: true,
        },
      });

      return updated;
    }),

  /**
   * List all catalog issues platform-wide (admin view).
   */
  listAllCatalogIssues: adminProcedure
    .input(listCatalogIssuesInput)
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.catalogIssue.findMany({
        where: {
          ...(input.severity ? { severity: input.severity } : {}),
          ...(input.issueType ? { issueType: input.issueType } : {}),
          ...(input.resolved !== undefined ? { resolved: input.resolved } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          retailerId: true,
          productId: true,
          issueType: true,
          severity: true,
          description: true,
          recommendation: true,
          resolved: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      return { items, nextCursor };
    }),

  /**
   * List catalog health checks for a retailer (admin view).
   */
  listCatalogHealthChecks: adminProcedure
    .input(
      z.object({
        retailerId: z.uuid(),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const checks = await ctx.db.catalogHealthCheck.findMany({
        where: { retailerId: input.retailerId },
        orderBy: { checkedAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          overallScore: true,
          totalProducts: true,
          issuesFound: true,
          staleProducts: true,
          missingFields: true,
          brokenImages: true,
          pricingIssues: true,
          checkedAt: true,
        },
      });

      return { items: checks };
    }),

  // ─── Platform Health ───

  /**
   * Get live platform health indicators.
   */
  platformHealth: adminProcedure.query(async ({ ctx }) => {
    const [orderCount, workerQueueSize, recentSyncJob, activeSequences] =
      await Promise.all([
        ctx.db.order.count({ where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }),
        ctx.db.notification.count({ where: { read: false } }),
        ctx.db.inventorySyncJob.findFirst({
          orderBy: { startedAt: "desc" },
          select: { status: true, startedAt: true },
        }),
        ctx.db.reEngagementSequence.count({ where: { status: "ACTIVE" } }),
      ]);

    const workerStatus = recentSyncJob?.startedAt
      ? recentSyncJob.startedAt > new Date(Date.now() - 10 * 60 * 1000)
        ? "Running"
        : "Idle"
      : "Unknown";

    return {
      api: "Operational",
      database: "Operational",
      worker: workerStatus,
      recentOrders: orderCount,
      unreadNotifications: workerQueueSize,
      activeSequences,
    };
  }),
} satisfies TRPCRouterRecord;
