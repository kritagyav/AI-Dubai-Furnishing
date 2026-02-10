import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@dubai/db";
import {
  registerRetailerInput,
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
} satisfies TRPCRouterRecord;
