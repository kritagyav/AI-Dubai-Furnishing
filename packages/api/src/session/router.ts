import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import type { Prisma } from "@dubai/db";

import { authedProcedure } from "../trpc";

type JsonValue = Prisma.InputJsonValue;

/**
 * Session management router — Story 1.9: Cross-Device Session Continuity.
 *
 * Provides device registration, session listing, activity state tracking,
 * and cross-device handoff (deep link generation).
 */
export const sessionRouter = {
  /**
   * Register or refresh the current device session.
   * Called on app mount / auth state change.
   */
  registerDevice: authedProcedure
    .input(
      z.object({
        deviceType: z.enum(["mobile", "tablet", "desktop"]),
        deviceName: z.string().max(100).optional(),
        userAgent: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const session = await ctx.db.session.create({
        data: {
          userId: ctx.user.id,
          deviceType: input.deviceType,
          deviceName: input.deviceName ?? null,
          userAgent: input.userAgent ?? null,
          expiresAt,
        },
        select: {
          id: true,
          deviceType: true,
          deviceName: true,
          createdAt: true,
        },
      });

      return session;
    }),

  /**
   * List all active sessions for the current user.
   * Enables "your active devices" UI.
   */
  listDevices: authedProcedure.query(async ({ ctx }) => {
    const sessions = await ctx.db.session.findMany({
      where: {
        userId: ctx.user.id,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceType: true,
        deviceName: true,
        lastActiveAt: true,
        lastPath: true,
        createdAt: true,
      },
      orderBy: { lastActiveAt: "desc" },
    });

    return sessions;
  }),

  /**
   * Revoke a specific device session.
   */
  revokeSession: authedProcedure
    .input(z.object({ sessionId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.session.findFirst({
        where: { id: input.sessionId, userId: ctx.user.id },
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      await ctx.db.session.delete({ where: { id: input.sessionId } });

      return { success: true };
    }),

  /**
   * Revoke all sessions except the current one.
   * "Sign out everywhere else" feature.
   */
  revokeAllOtherSessions: authedProcedure
    .input(z.object({ currentSessionId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.session.deleteMany({
        where: {
          userId: ctx.user.id,
          id: { not: input.currentSessionId },
        },
      });

      return { revokedCount: result.count };
    }),

  /**
   * Update the user's activity state for cross-device continuity.
   * Called on navigation / significant state changes.
   */
  updateActivityState: authedProcedure
    .input(
      z.object({
        sessionId: z.uuid(),
        currentPath: z.string().max(500),
        currentScreen: z.string().max(100).optional(),
        contextData: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const jsonContext = input.contextData
        ? (input.contextData as JsonValue)
        : undefined;

      // Update the session's last active path
      await ctx.db.session.update({
        where: { id: input.sessionId },
        data: {
          lastActiveAt: new Date(),
          lastPath: input.currentPath,
          ...(jsonContext !== undefined ? { lastContext: jsonContext } : {}),
        },
      });

      // Upsert the global user activity state
      await ctx.db.userActivityState.upsert({
        where: { userId: ctx.user.id },
        create: {
          userId: ctx.user.id,
          currentPath: input.currentPath,
          currentScreen: input.currentScreen ?? null,
          ...(jsonContext !== undefined ? { contextData: jsonContext } : {}),
        },
        update: {
          currentPath: input.currentPath,
          currentScreen: input.currentScreen ?? null,
          ...(jsonContext !== undefined ? { contextData: jsonContext } : {}),
        },
      });

      return { success: true };
    }),

  /**
   * Get the user's last activity state from another device.
   * Powers the "Continue where you left off" prompt.
   */
  getResumableState: authedProcedure
    .input(z.object({ currentSessionId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      // Find the most recently active session that isn't the current one
      const otherSession = await ctx.db.session.findFirst({
        where: {
          userId: ctx.user.id,
          id: { not: input.currentSessionId },
          expiresAt: { gt: new Date() },
          lastPath: { not: null },
        },
        orderBy: { lastActiveAt: "desc" },
        select: {
          deviceType: true,
          deviceName: true,
          lastActiveAt: true,
          lastPath: true,
          lastContext: true,
        },
      });

      if (!otherSession?.lastPath) {
        return null;
      }

      // Only show "continue" if the other session was active in the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (otherSession.lastActiveAt < twentyFourHoursAgo) {
        return null;
      }

      return {
        deviceType: otherSession.deviceType,
        deviceName: otherSession.deviceName,
        lastActiveAt: otherSession.lastActiveAt,
        path: otherSession.lastPath,
        context: otherSession.lastContext as Record<string, unknown> | null,
      };
    }),

  /**
   * Generate a deep link for cross-device handoff.
   * Creates a time-limited, single-use handoff token.
   */
  createHandoffLink: authedProcedure
    .input(
      z.object({
        targetPath: z.string().max(500),
        contextData: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const handoffData = {
        ...(input.contextData ?? {}),
        handoffCreatedAt: new Date().toISOString(),
      } as JsonValue;

      // Store handoff state in UserActivityState
      await ctx.db.userActivityState.upsert({
        where: { userId: ctx.user.id },
        create: {
          userId: ctx.user.id,
          currentPath: input.targetPath,
          currentScreen: "handoff",
          contextData: handoffData,
        },
        update: {
          currentPath: input.targetPath,
          currentScreen: "handoff",
          contextData: handoffData,
        },
      });

      // Return path that the other device can navigate to
      return {
        path: input.targetPath,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      };
    }),

  /**
   * Process a queued offline action with idempotency.
   */
  submitOfflineAction: authedProcedure
    .input(
      z.object({
        idempotencyKey: z.string().min(1).max(255),
        action: z.string().max(100),
        payload: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check for existing action with same idempotency key
      const existing = await ctx.db.offlineAction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true, status: true },
      });

      if (existing) {
        return { id: existing.id, status: existing.status, deduplicated: true };
      }

      const action = await ctx.db.offlineAction.create({
        data: {
          userId: ctx.user.id,
          idempotencyKey: input.idempotencyKey,
          action: input.action,
          payload: input.payload as JsonValue,
        },
        select: { id: true, status: true },
      });

      return { id: action.id, status: action.status, deduplicated: false };
    }),
} satisfies TRPCRouterRecord;
