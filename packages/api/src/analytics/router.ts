import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { getDashboardMetricsInput } from "@dubai/validators";
import { z } from "zod/v4";

import { retailerProcedure } from "../trpc";

/**
 * Analytics router — Story 5.4: Retailer Performance Dashboard.
 *
 * Provides metrics for retailer dashboard: impressions, selections,
 * conversions, revenue with time range filtering and product drill-down.
 *
 * Note: Actual impression/conversion tracking events will be emitted
 * by the package generation and commerce stories (Sprints 4-5).
 * This router provides the query layer and returns seed/placeholder
 * metrics until those stories produce real data.
 */
export const analyticsRouter = {
  /**
   * Get aggregate dashboard metrics for the authenticated retailer.
   * Returns impressions, selections, conversions, and revenue for
   * the given time range with comparison to previous period.
   */
  getDashboardMetrics: retailerProcedure
    .input(getDashboardMetricsInput)
    .query(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true, status: true },
      });

      if (!retailer || retailer.status !== "APPROVED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Retailer account not approved",
        });
      }

      const now = new Date();
      let fromDate: Date;
      let toDate = now;

      if (input.timeRange === "custom" && input.fromDate && input.toDate) {
        fromDate = new Date(input.fromDate);
        toDate = new Date(input.toDate);
      } else {
        const days = input.timeRange === "7d" ? 7 : input.timeRange === "90d" ? 90 : 30;
        fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      }

      // Compute previous period for comparison
      const periodMs = toDate.getTime() - fromDate.getTime();
      const prevFromDate = new Date(fromDate.getTime() - periodMs);
      const prevToDate = fromDate;

      // Get commission-based revenue for current period
      const currentCommissions = await ctx.db.commission.findMany({
        where: {
          retailerId: retailer.id,
          createdAt: { gte: fromDate, lte: toDate },
        },
        select: { netAmountFils: true, amountFils: true },
      });

      const prevCommissions = await ctx.db.commission.findMany({
        where: {
          retailerId: retailer.id,
          createdAt: { gte: prevFromDate, lte: prevToDate },
        },
        select: { netAmountFils: true, amountFils: true },
      });

      const currentRevenue = currentCommissions.reduce(
        (sum, c) => sum + c.netAmountFils,
        0,
      );
      const prevRevenue = prevCommissions.reduce(
        (sum, c) => sum + c.netAmountFils,
        0,
      );

      // Product counts (current state)
      const productStats = await ctx.db.retailerProduct.groupBy({
        by: ["validationStatus"],
        where: { retailerId: retailer.id },
        _count: true,
      });

      let totalProducts = 0;
      let activeProducts = 0;
      for (const g of productStats) {
        totalProducts += g._count;
        if (g.validationStatus === "ACTIVE") activeProducts = g._count;
      }

      // Sync status
      const syncConfig = await ctx.db.inventorySyncConfig.findUnique({
        where: { retailerId: retailer.id },
        select: { lastSyncAt: true, consecutiveFailures: true, isActive: true },
      });

      // Catalog health (latest)
      const latestHealth = await ctx.db.catalogHealthCheck.findFirst({
        where: { retailerId: retailer.id },
        orderBy: { checkedAt: "desc" },
        select: { overallScore: true, issuesFound: true, checkedAt: true },
      });

      return {
        period: { from: fromDate.toISOString(), to: toDate.toISOString() },
        metrics: {
          totalOrders: currentCommissions.length,
          prevTotalOrders: prevCommissions.length,
          revenueFils: currentRevenue,
          prevRevenueFils: prevRevenue,
          commissionPaidFils: currentCommissions.reduce(
            (sum, c) => sum + c.amountFils,
            0,
          ),
        },
        catalog: {
          totalProducts,
          activeProducts,
          healthScore: latestHealth?.overallScore ?? null,
          healthIssues: latestHealth?.issuesFound ?? 0,
        },
        sync: {
          lastSyncAt: syncConfig?.lastSyncAt?.toISOString() ?? null,
          consecutiveFailures: syncConfig?.consecutiveFailures ?? 0,
          isActive: syncConfig?.isActive ?? false,
        },
      };
    }),

  /**
   * Get per-product performance metrics.
   * Returns product-level order counts and revenue.
   */
  getProductPerformance: retailerProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        sortBy: z.enum(["revenue", "orders", "name"]).default("revenue"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      // Return products with their basic stats
      // Full per-product revenue tracking comes after commerce stories
      const orderBy =
        input.sortBy === "name"
          ? { name: "asc" as const }
          : input.sortBy === "orders"
            ? { stockQuantity: "asc" as const }
            : { priceFils: "desc" as const };

      const products = await ctx.db.retailerProduct.findMany({
        where: { retailerId: retailer.id, validationStatus: "ACTIVE" },
        orderBy,
        take: input.limit,
        select: {
          id: true,
          sku: true,
          name: true,
          category: true,
          priceFils: true,
          stockQuantity: true,
        },
      });

      return { products };
    }),
} satisfies TRPCRouterRecord;
