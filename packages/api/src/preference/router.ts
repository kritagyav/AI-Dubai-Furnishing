import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import type { Prisma, PrismaClient } from "@dubai/db";
import {
  saveChildSafetyInput,
  saveInvestorPreferencesInput,
  saveLifestyleQuizInput,
  setProfileTypeInput,
} from "@dubai/validators";

import { authedProcedure } from "../trpc";

type JsonValue = Prisma.InputJsonValue;

// ═══════════════════════════════════════════
// Helper: verify user owns the project
// ═══════════════════════════════════════════

async function verifyProjectOwnership(
  db: PrismaClient,
  projectId: string,
  userId: string,
) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });

  if (!project) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Project not found or access denied",
    });
  }

  return project;
}

/**
 * Preference router — Stories 3.1–3.4: Lifestyle Discovery & Preference Engine.
 *
 * Handles lifestyle quiz, profile type selection, investor preferences,
 * and child-safety requirements. All linked to a Project.
 */
export const preferenceRouter = {
  // ─── Story 3.1: Lifestyle Intake Quiz ───

  /**
   * Save or update lifestyle quiz answers.
   * Supports partial saves (auto-save on each step).
   */
  saveLifestyleQuiz: authedProcedure
    .input(saveLifestyleQuizInput)
    .mutation(async ({ ctx, input }) => {
      await verifyProjectOwnership(ctx.db, input.projectId, ctx.user.id);

      const data: Record<string, unknown> = {};
      if (input.budgetMinFils !== undefined)
        data.budgetMinFils = input.budgetMinFils;
      if (input.budgetMaxFils !== undefined)
        data.budgetMaxFils = input.budgetMaxFils;
      if (input.familySize !== undefined) data.familySize = input.familySize;
      if (input.childrenAges !== undefined)
        data.childrenAges = input.childrenAges as JsonValue;
      if (input.hasPets !== undefined) data.hasPets = input.hasPets;
      if (input.petTypes !== undefined)
        data.petTypes = input.petTypes as JsonValue;
      if (input.stylePreferences !== undefined)
        data.stylePreferences = input.stylePreferences as JsonValue;
      if (input.quizStep !== undefined) data.quizStep = input.quizStep;
      if (input.quizCompleted !== undefined)
        data.quizCompleted = input.quizCompleted;

      const preference = await ctx.db.userPreference.upsert({
        where: {
          userId_projectId: {
            userId: ctx.user.id,
            projectId: input.projectId,
          },
        },
        create: {
          userId: ctx.user.id,
          projectId: input.projectId,
          ...data,
        },
        update: data,
        select: {
          id: true,
          quizStep: true,
          quizCompleted: true,
          budgetMinFils: true,
          budgetMaxFils: true,
          familySize: true,
          childrenAges: true,
          hasPets: true,
          stylePreferences: true,
          updatedAt: true,
        },
      });

      return preference;
    }),

  /**
   * Get preferences for a project.
   */
  getPreferences: authedProcedure
    .input(z.object({ projectId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await verifyProjectOwnership(ctx.db, input.projectId, ctx.user.id);

      const preference = await ctx.db.userPreference.findUnique({
        where: {
          userId_projectId: {
            userId: ctx.user.id,
            projectId: input.projectId,
          },
        },
        include: {
          investorPreference: true,
          childSafetyPreference: true,
        },
      });

      return preference;
    }),

  // ─── Story 3.2: Profile Type Selection ───

  /**
   * Set or update profile type for a project.
   * Also stored on UserPreference for preference engine access.
   */
  setProfileType: authedProcedure
    .input(setProfileTypeInput)
    .mutation(async ({ ctx, input }) => {
      await verifyProjectOwnership(ctx.db, input.projectId, ctx.user.id);

      // Update project profile type
      await ctx.db.project.update({
        where: { id: input.projectId },
        data: { profileType: input.profileType },
      });

      // Upsert preference with profile type
      const preference = await ctx.db.userPreference.upsert({
        where: {
          userId_projectId: {
            userId: ctx.user.id,
            projectId: input.projectId,
          },
        },
        create: {
          userId: ctx.user.id,
          projectId: input.projectId,
          profileType: input.profileType,
        },
        update: {
          profileType: input.profileType,
        },
        select: {
          id: true,
          profileType: true,
        },
      });

      return preference;
    }),

  // ─── Story 3.3: Airbnb Investor Target & Revenue Goals ───

  /**
   * Save investor-specific preferences.
   * Only valid if profile type is AIRBNB_INVESTOR.
   */
  saveInvestorPreferences: authedProcedure
    .input(saveInvestorPreferencesInput)
    .mutation(async ({ ctx, input }) => {
      await verifyProjectOwnership(ctx.db, input.projectId, ctx.user.id);

      // Ensure preference exists and profile is AIRBNB_INVESTOR
      const pref = await ctx.db.userPreference.findUnique({
        where: {
          userId_projectId: {
            userId: ctx.user.id,
            projectId: input.projectId,
          },
        },
        select: { id: true, profileType: true },
      });

      if (!pref) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Complete profile type selection first",
        });
      }

      if (pref.profileType !== "AIRBNB_INVESTOR") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Investor preferences are only available for Airbnb investor profiles",
        });
      }

      const investor = await ctx.db.investorPreference.upsert({
        where: { preferenceId: pref.id },
        create: {
          preferenceId: pref.id,
          targetDemographics: input.targetDemographics as JsonValue,
          ...(input.nightlyRateMinFils !== undefined
            ? { nightlyRateMinFils: input.nightlyRateMinFils }
            : {}),
          ...(input.nightlyRateMaxFils !== undefined
            ? { nightlyRateMaxFils: input.nightlyRateMaxFils }
            : {}),
          ...(input.occupancyTargetPct !== undefined
            ? { occupancyTargetPct: input.occupancyTargetPct }
            : {}),
          ...(input.investmentBudgetFils !== undefined
            ? { investmentBudgetFils: input.investmentBudgetFils }
            : {}),
        },
        update: {
          targetDemographics: input.targetDemographics as JsonValue,
          ...(input.nightlyRateMinFils !== undefined
            ? { nightlyRateMinFils: input.nightlyRateMinFils }
            : {}),
          ...(input.nightlyRateMaxFils !== undefined
            ? { nightlyRateMaxFils: input.nightlyRateMaxFils }
            : {}),
          ...(input.occupancyTargetPct !== undefined
            ? { occupancyTargetPct: input.occupancyTargetPct }
            : {}),
          ...(input.investmentBudgetFils !== undefined
            ? { investmentBudgetFils: input.investmentBudgetFils }
            : {}),
        },
      });

      return investor;
    }),

  // ─── Story 3.4: Child-Safety Requirements ───

  /**
   * Save child-safety preferences.
   * Only shown when children are indicated in the lifestyle quiz.
   */
  saveChildSafety: authedProcedure
    .input(saveChildSafetyInput)
    .mutation(async ({ ctx, input }) => {
      await verifyProjectOwnership(ctx.db, input.projectId, ctx.user.id);

      const pref = await ctx.db.userPreference.findUnique({
        where: {
          userId_projectId: {
            userId: ctx.user.id,
            projectId: input.projectId,
          },
        },
        select: { id: true, childrenAges: true },
      });

      if (!pref) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Complete the lifestyle quiz first",
        });
      }

      // Determine age-based safety profile
      const youngestAge = input.youngestChildAge ?? 0;
      let ageBasedProfile = "school_age";
      if (youngestAge <= 3) ageBasedProfile = "toddler";
      else if (youngestAge <= 6) ageBasedProfile = "mixed";

      const safety = await ctx.db.childSafetyPreference.upsert({
        where: { preferenceId: pref.id },
        create: {
          preferenceId: pref.id,
          hasChildren: true,
          youngestChildAge: input.youngestChildAge ?? null,
          safetyFeatures: input.safetyFeatures as JsonValue,
          ageBasedProfile,
          notes: input.notes ?? null,
        },
        update: {
          youngestChildAge: input.youngestChildAge ?? null,
          safetyFeatures: input.safetyFeatures as JsonValue,
          ageBasedProfile,
          notes: input.notes ?? null,
        },
      });

      return safety;
    }),
} satisfies TRPCRouterRecord;
