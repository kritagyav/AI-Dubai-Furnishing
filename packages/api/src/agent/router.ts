import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import {
  paginationInput,
  registerAgentInput,
  updateAgentCommissionInput,
  updateAgentStatusInput,
} from "@dubai/validators";

import { adminProcedure, authedProcedure } from "../trpc";

/**
 * Generate a unique referral code with the pattern REF-XXXXXXXX.
 */
function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "REF-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Agent router — manages agent partner registration, referrals, and admin controls.
 */
export const agentRouter = {
  /**
   * Register the current user as an agent partner.
   */
  register: authedProcedure
    .input(registerAgentInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.agentPartner.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already registered as an agent partner",
        });
      }

      const agent = await ctx.db.agentPartner.create({
        data: {
          userId: ctx.user.id,
          companyName: input.companyName ?? null,
          licenseNumber: input.licenseNumber ?? null,
        },
        select: {
          id: true,
          userId: true,
          companyName: true,
          licenseNumber: true,
          commissionRate: true,
          status: true,
          createdAt: true,
        },
      });

      return agent;
    }),

  /**
   * Get the current user's agent profile.
   */
  getMyProfile: authedProcedure.query(async ({ ctx }) => {
    const agent = await ctx.db.agentPartner.findUnique({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        userId: true,
        companyName: true,
        licenseNumber: true,
        commissionRate: true,
        status: true,
        totalReferrals: true,
        totalEarningsFils: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!agent) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Agent profile not found. Please register first.",
      });
    }

    return agent;
  }),

  /**
   * Generate a unique referral code for the agent.
   */
  createReferralCode: authedProcedure.mutation(async ({ ctx }) => {
    const agent = await ctx.db.agentPartner.findUnique({
      where: { userId: ctx.user.id },
      select: { id: true, status: true },
    });

    if (!agent) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Agent profile not found. Please register first.",
      });
    }

    if (agent.status !== "ACTIVE") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only active agents can create referral codes",
      });
    }

    // Retry loop to handle unlikely collision on the unique referralCode
    let referral;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        referral = await ctx.db.referral.create({
          data: {
            agentId: agent.id,
            referralCode: generateReferralCode(),
          },
          select: {
            id: true,
            referralCode: true,
            createdAt: true,
          },
        });
        break;
      } catch {
        if (attempt === 4) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate unique referral code",
          });
        }
      }
    }

    return referral;
  }),

  /**
   * List the agent's referrals with conversion status.
   */
  listMyReferrals: authedProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      const agent = await ctx.db.agentPartner.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent profile not found. Please register first.",
        });
      }

      const items = await ctx.db.referral.findMany({
        where: { agentId: agent.id },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          referralCode: true,
          referredUserId: true,
          orderId: true,
          commissionFils: true,
          convertedAt: true,
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
   * Mark a referral as converted when an order is placed.
   */
  convertReferral: authedProcedure
    .input(
      z.object({
        referralCode: z.string().min(1),
        orderId: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const referral = await ctx.db.referral.findUnique({
        where: { referralCode: input.referralCode },
        select: {
          id: true,
          convertedAt: true,
          agent: { select: { id: true, userId: true, commissionRate: true } },
        },
      });

      if (!referral) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Referral code not found",
        });
      }

      if (referral.convertedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Referral has already been converted",
        });
      }

      // Look up the order to calculate commission
      const order = await ctx.db.order.findUnique({
        where: { id: input.orderId },
        select: { id: true, totalFils: true },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      const commissionFils = Math.floor(
        (order.totalFils * referral.agent.commissionRate) / 10000,
      );

      // Update referral and agent totals in a transaction
      const updated = await ctx.db.$transaction(async (tx) => {
        const updatedReferral = await tx.referral.update({
          where: { id: referral.id },
          data: {
            orderId: input.orderId,
            referredUserId: ctx.user.id,
            commissionFils,
            convertedAt: new Date(),
          },
          select: {
            id: true,
            referralCode: true,
            orderId: true,
            commissionFils: true,
            convertedAt: true,
          },
        });

        await tx.agentPartner.update({
          where: { id: referral.agent.id },
          data: {
            totalReferrals: { increment: 1 },
            totalEarningsFils: { increment: commissionFils },
          },
        });

        return updatedReferral;
      });

      return updated;
    }),

  /**
   * Admin: update an agent's status (activate/suspend/deactivate).
   */
  updateStatus: adminProcedure
    .input(updateAgentStatusInput)
    .mutation(async ({ ctx, input }) => {
      const agent = await ctx.db.agentPartner.findUnique({
        where: { id: input.agentId },
        select: { id: true },
      });

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent partner not found",
        });
      }

      const updated = await ctx.db.agentPartner.update({
        where: { id: input.agentId },
        data: { status: input.status },
        select: {
          id: true,
          companyName: true,
          status: true,
          updatedAt: true,
        },
      });

      return updated;
    }),

  /**
   * Admin: update an agent's commission rate in basis points.
   */
  updateCommissionRate: adminProcedure
    .input(updateAgentCommissionInput)
    .mutation(async ({ ctx, input }) => {
      const agent = await ctx.db.agentPartner.findUnique({
        where: { id: input.agentId },
        select: { id: true },
      });

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent partner not found",
        });
      }

      const updated = await ctx.db.agentPartner.update({
        where: { id: input.agentId },
        data: { commissionRate: input.commissionRate },
        select: {
          id: true,
          companyName: true,
          commissionRate: true,
          updatedAt: true,
        },
      });

      return updated;
    }),
} satisfies TRPCRouterRecord;
