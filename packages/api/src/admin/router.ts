import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { paginationInput, retailerDecisionInput, listOrdersInput } from "@dubai/validators";
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
} satisfies TRPCRouterRecord;
