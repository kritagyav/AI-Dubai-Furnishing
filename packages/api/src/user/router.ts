import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { authedProcedure, publicProcedure } from "../trpc";

export const userRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),

  getProfile: authedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        onboardingPath: true,
        onboardedAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return user;
  }),

  updateProfile: authedProcedure
    .input(
      z.object({
        name: z.string().min(2).optional(),
        avatarUrl: z.url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.user.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.avatarUrl !== undefined
            ? { avatarUrl: input.avatarUrl }
            : {}),
        },
      });
    }),

  /**
   * Set the user's onboarding path — Story 1.10.
   * Called once when the user selects "I need to furnish now" or "Just browsing".
   */
  setOnboardingPath: authedProcedure
    .input(
      z.object({
        path: z.enum(["FURNISH_NOW", "JUST_BROWSING"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: {
          onboardingPath: input.path,
          onboardedAt: new Date(),
        },
        select: {
          id: true,
          onboardingPath: true,
          onboardedAt: true,
        },
      });

      return user;
    }),

  /**
   * Check if the user needs onboarding.
   */
  getOnboardingStatus: authedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        onboardingPath: true,
        onboardedAt: true,
      },
    });

    return {
      needsOnboarding: !user?.onboardingPath,
      path: user?.onboardingPath ?? null,
      onboardedAt: user?.onboardedAt ?? null,
    };
  }),
} satisfies TRPCRouterRecord;
