import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { paginationInput, retailerDecisionInput } from "@dubai/validators";
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
} satisfies TRPCRouterRecord;
