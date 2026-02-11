import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import {
  disputeCommissionInput,
  listCommissionsInput,
  listSettlementsInput,
} from "@dubai/validators";
import { z } from "zod/v4";

import { retailerProcedure } from "../trpc";

/**
 * Ledger router — Story 5.5: Commission Calculation & Settlement.
 *
 * Provides commission listing, detail, dispute, and settlement
 * views for retailers. Commission creation happens from the
 * commerce flow (Sprint 5) via internal service calls.
 */
export const ledgerRouter = {
  /**
   * List commissions for the authenticated retailer.
   * Supports filtering by status and date range.
   */
  listCommissions: retailerProcedure
    .input(listCommissionsInput)
    .query(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      const where: Record<string, unknown> = { retailerId: retailer.id };
      if (input.status) where.status = input.status;
      if (input.fromDate || input.toDate) {
        const dateFilter: Record<string, Date> = {};
        if (input.fromDate) dateFilter.gte = new Date(input.fromDate);
        if (input.toDate) dateFilter.lte = new Date(input.toDate);
        where.createdAt = dateFilter;
      }

      const commissions = await ctx.db.commission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          orderRef: true,
          amountFils: true,
          rateBps: true,
          netAmountFils: true,
          status: true,
          createdAt: true,
          clearedAt: true,
          settledAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (commissions.length > input.limit) {
        const next = commissions.pop();
        nextCursor = next?.id;
      }

      // Compute summary
      const allCommissions = await ctx.db.commission.findMany({
        where: { retailerId: retailer.id },
        select: { netAmountFils: true, status: true },
      });

      let pending = 0;
      let cleared = 0;
      let settled = 0;
      for (const c of allCommissions) {
        if (c.status === "PENDING") pending += c.netAmountFils;
        else if (c.status === "CLEARED") cleared += c.netAmountFils;
        else if (c.status === "SETTLED") settled += c.netAmountFils;
      }

      return {
        items: commissions,
        nextCursor,
        summary: {
          pendingFils: pending,
          clearedFils: cleared,
          settledFils: settled,
        },
      };
    }),

  /**
   * Get a single commission's details.
   */
  getCommission: retailerProcedure
    .input(z.object({ commissionId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      const commission = await ctx.db.commission.findFirst({
        where: { id: input.commissionId, retailerId: retailer.id },
        include: {
          settlement: {
            select: {
              id: true,
              status: true,
              payoutDate: true,
              transactionRef: true,
            },
          },
        },
      });

      if (!commission) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Commission not found",
        });
      }

      return commission;
    }),

  /**
   * Dispute a commission.
   * Only PENDING or CLEARED commissions can be disputed.
   */
  disputeCommission: retailerProcedure
    .input(disputeCommissionInput)
    .mutation(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      const commission = await ctx.db.commission.findFirst({
        where: { id: input.commissionId, retailerId: retailer.id },
        select: { id: true, status: true },
      });

      if (!commission) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Commission not found",
        });
      }

      if (commission.status !== "PENDING" && commission.status !== "CLEARED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot dispute a commission with status ${commission.status}`,
        });
      }

      const updated = await ctx.db.commission.update({
        where: { id: commission.id },
        data: {
          status: "DISPUTED",
          disputeReason: input.reason,
        },
        select: {
          id: true,
          status: true,
          disputeReason: true,
          updatedAt: true,
        },
      });

      return updated;
    }),

  /**
   * List settlements for the authenticated retailer.
   */
  listSettlements: retailerProcedure
    .input(listSettlementsInput)
    .query(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      const settlements = await ctx.db.settlement.findMany({
        where: {
          retailerId: retailer.id,
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          totalAmountFils: true,
          commissionCount: true,
          status: true,
          payoutDate: true,
          transactionRef: true,
          statementUrl: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (settlements.length > input.limit) {
        const next = settlements.pop();
        nextCursor = next?.id;
      }

      return { items: settlements, nextCursor };
    }),

  /**
   * Get settlement statement details.
   */
  getSettlement: retailerProcedure
    .input(z.object({ settlementId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      const settlement = await ctx.db.settlement.findFirst({
        where: { id: input.settlementId, retailerId: retailer.id },
        include: {
          commissions: {
            select: {
              id: true,
              orderRef: true,
              amountFils: true,
              netAmountFils: true,
              rateBps: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!settlement) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Settlement not found",
        });
      }

      return settlement;
    }),

  /**
   * Get ledger entries (financial transaction log).
   */
  getLedgerEntries: retailerProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      const entries = await ctx.db.ledgerEntry.findMany({
        where: { retailerId: retailer.id },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          type: true,
          amountFils: true,
          referenceId: true,
          description: true,
          createdAt: true,
        },
      });

      return { entries };
    }),
} satisfies TRPCRouterRecord;
