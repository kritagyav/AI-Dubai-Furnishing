import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { prisma } from "@dubai/db";
import { trackEvent } from "@dubai/queue";
import { getDashboardMetricsInput } from "@dubai/validators";

import { authedProcedure, retailerProcedure } from "../trpc";

/**
 * Analytics router — Story 5.4: Retailer Performance Dashboard.
 *
 * Provides metrics for retailer dashboard: impressions, selections,
 * conversions, revenue with time range filtering and product drill-down.
 * Queries real AnalyticsEvent data alongside commission-based metrics.
 */
export const analyticsRouter = {
  /**
   * Get aggregate dashboard metrics for the authenticated retailer.
   * Returns impressions, selections, conversions, revenue, and
   * real event-based funnel metrics for the given time range.
   */
  getDashboardMetrics: retailerProcedure
    .input(getDashboardMetricsInput)
    .query(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true, status: true },
      });

      if (retailer?.status !== "APPROVED") {
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
        const days =
          input.timeRange === "7d" ? 7 : input.timeRange === "90d" ? 90 : 30;
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

      // ─── Real AnalyticsEvent Queries ───
      // Use unscoped prisma since AnalyticsEvent is not tenant-scoped.
      // We filter by userId matching the retailer's user to get retailer-relevant events.

      // Get retailer's product IDs for filtering product.viewed events
      const retailerProducts = await ctx.db.retailerProduct.findMany({
        where: { retailerId: retailer.id },
        select: { id: true },
      });
      const productIds = retailerProducts.map((p) => p.id);

      // Count product.viewed events for this retailer's products (impressions)
      const impressions =
        productIds.length > 0
          ? await prisma.analyticsEvent
              .count({
                where: {
                  event: "product.viewed",
                  timestamp: { gte: fromDate, lte: toDate },
                  properties: {
                    path: ["productId"],
                    array_contains: productIds,
                  },
                },
              })
              .catch(() => 0)
          : 0;

      // Count package.generated events (package selections)
      const packageSelections = await prisma.analyticsEvent
        .count({
          where: {
            event: "package.generated",
            userId: ctx.user.id,
            timestamp: { gte: fromDate, lte: toDate },
          },
        })
        .catch(() => 0);

      // Count package.accepted events (conversions)
      const conversions = await prisma.analyticsEvent
        .count({
          where: {
            event: "package.accepted",
            userId: ctx.user.id,
            timestamp: { gte: fromDate, lte: toDate },
          },
        })
        .catch(() => 0);

      // Count order.paid events (confirmed orders)
      const confirmedOrders = await prisma.analyticsEvent
        .count({
          where: {
            event: "order.paid",
            userId: ctx.user.id,
            timestamp: { gte: fromDate, lte: toDate },
          },
        })
        .catch(() => 0);

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
        eventMetrics: {
          impressions,
          packageSelections,
          conversions,
          confirmedOrders,
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
   * Returns product-level view counts, order counts, and conversion rates.
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Retailer not found",
        });
      }

      // Return products with their basic stats
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

      // Get view counts per product from AnalyticsEvent (unscoped)
      const productIds = products.map((p) => p.id);

      // Fetch all product.viewed events for these products
      const viewEvents =
        productIds.length > 0
          ? await prisma.analyticsEvent
              .findMany({
                where: {
                  event: "product.viewed",
                },
                select: {
                  properties: true,
                },
              })
              .then((events) =>
                events.reduce<Record<string, number>>((acc, e) => {
                  const props = e.properties as Record<string, unknown> | null;
                  const pid = props?.productId as string | undefined;
                  if (pid && productIds.includes(pid)) {
                    acc[pid] = (acc[pid] ?? 0) + 1;
                  }
                  return acc;
                }, {}),
              )
              .catch(() => ({}) as Record<string, number>)
          : ({} as Record<string, number>);

      // Get order counts per product from OrderLineItem
      const orderCounts =
        productIds.length > 0
          ? await prisma.orderLineItem
              .groupBy({
                by: ["productId"],
                where: {
                  productId: { in: productIds },
                  retailerId: retailer.id,
                },
                _count: true,
              })
              .then((groups) =>
                groups.reduce<Record<string, number>>((acc, g) => {
                  acc[g.productId] = g._count;
                  return acc;
                }, {}),
              )
              .catch(() => ({}) as Record<string, number>)
          : ({} as Record<string, number>);

      const productsWithMetrics = products.map((product) => {
        const views = viewEvents[product.id] ?? 0;
        const orders = orderCounts[product.id] ?? 0;
        const conversionRate = views > 0 ? orders / views : 0;

        return {
          ...product,
          views,
          orders,
          conversionRate: Math.round(conversionRate * 10000) / 10000, // 4 decimal places
        };
      });

      return { products: productsWithMetrics };
    }),

  /**
   * Track a product impression event.
   * Creates a product.viewed AnalyticsEvent via the queue.
   */
  trackImpression: authedProcedure
    .input(
      z.object({
        productId: z.string(),
        source: z.enum(["gallery", "package", "search"]),
      }),
    )
    .mutation(({ ctx, input }) => {
      trackEvent("product.viewed", ctx.user.id, {
        productId: input.productId,
        source: input.source,
      });

      return { success: true };
    }),

  /**
   * Get conversion funnel data for a retailer.
   * Returns counts and conversion rates for each funnel step:
   * impressions -> package_selections -> cart_additions -> orders -> paid_orders
   */
  getConversionFunnel: retailerProcedure
    .input(
      z.object({
        timeRange: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
        fromDate: z.iso.datetime().optional(),
        toDate: z.iso.datetime().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true, status: true },
      });

      if (retailer?.status !== "APPROVED") {
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
        const days =
          input.timeRange === "7d" ? 7 : input.timeRange === "90d" ? 90 : 30;
        fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      }

      const timeFilter = { gte: fromDate, lte: toDate };

      // Query each funnel step from AnalyticsEvent (unscoped)
      const [
        impressions,
        packageSelections,
        cartAdditions,
        orders,
        paidOrders,
      ] = await Promise.all([
        prisma.analyticsEvent
          .count({
            where: { event: "product.viewed", timestamp: timeFilter },
          })
          .catch(() => 0),

        prisma.analyticsEvent
          .count({
            where: { event: "package.generated", timestamp: timeFilter },
          })
          .catch(() => 0),

        prisma.analyticsEvent
          .count({
            where: { event: "cart.item_added", timestamp: timeFilter },
          })
          .catch(() => 0),

        prisma.analyticsEvent
          .count({
            where: { event: "order.created", timestamp: timeFilter },
          })
          .catch(() => 0),

        prisma.analyticsEvent
          .count({
            where: { event: "order.paid", timestamp: timeFilter },
          })
          .catch(() => 0),
      ]);

      // Compute conversion rates between each step
      function rate(from: number, to: number): number {
        return from > 0 ? Math.round((to / from) * 10000) / 10000 : 0;
      }

      return {
        period: { from: fromDate.toISOString(), to: toDate.toISOString() },
        funnel: [
          {
            step: "impressions" as const,
            count: impressions,
            conversionRate: 1,
          },
          {
            step: "package_selections" as const,
            count: packageSelections,
            conversionRate: rate(impressions, packageSelections),
          },
          {
            step: "cart_additions" as const,
            count: cartAdditions,
            conversionRate: rate(packageSelections, cartAdditions),
          },
          {
            step: "orders" as const,
            count: orders,
            conversionRate: rate(cartAdditions, orders),
          },
          {
            step: "paid_orders" as const,
            count: paidOrders,
            conversionRate: rate(orders, paidOrders),
          },
        ],
        overall: {
          totalImpressions: impressions,
          totalPaidOrders: paidOrders,
          overallConversionRate: rate(impressions, paidOrders),
        },
      };
    }),
} satisfies TRPCRouterRecord;
