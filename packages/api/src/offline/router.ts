import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@dubai/db";
import { z } from "zod/v4";

import { authedProcedure } from "../trpc";

type JsonValue = Prisma.InputJsonValue;

/**
 * Offline Actions router -- handles syncing actions that were queued
 * while the user was offline.
 *
 * Actions are stored as PENDING records and later processed by the
 * worker via the "offline.sync" job.
 */
export const offlineRouter = {
  /**
   * Submit a batch of offline actions for processing.
   * Each action gets a server-generated idempotency key based on
   * the user + client timestamp + action type to prevent duplicates.
   */
  submitOfflineActions: authedProcedure
    .input(
      z.object({
        actions: z.array(
          z.object({
            actionType: z.string().min(1).max(100),
            payload: z.record(z.string(), z.unknown()),
            clientTimestamp: z.string().min(1),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const createdIds: string[] = [];

      for (const action of input.actions) {
        // Build a deterministic idempotency key from user + timestamp + type
        const idempotencyKey = `${ctx.user.id}:${action.clientTimestamp}:${action.actionType}`;

        // Check for existing action with the same idempotency key
        const existing = await ctx.db.offlineAction.findUnique({
          where: { idempotencyKey },
          select: { id: true },
        });

        if (existing) {
          createdIds.push(existing.id);
          continue;
        }

        const record = await ctx.db.offlineAction.create({
          data: {
            userId: ctx.user.id,
            idempotencyKey,
            action: action.actionType,
            payload: action.payload as JsonValue,
            status: "pending",
          },
          select: { id: true },
        });

        createdIds.push(record.id);
      }

      return { actionIds: createdIds };
    }),

  /**
   * List the current user's PENDING and FAILED offline actions.
   */
  listPendingActions: authedProcedure.query(async ({ ctx }) => {
    const actions = await ctx.db.offlineAction.findMany({
      where: {
        userId: ctx.user.id,
        status: { in: ["pending", "failed"] },
      },
      select: {
        id: true,
        action: true,
        payload: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        processedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { actions };
  }),

  /**
   * Re-queue a FAILED action for retry by resetting its status to PENDING.
   */
  retryAction: authedProcedure
    .input(
      z.object({
        actionId: z.uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const action = await ctx.db.offlineAction.findFirst({
        where: {
          id: input.actionId,
          userId: ctx.user.id,
          status: "failed",
        },
        select: { id: true },
      });

      if (!action) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Failed action not found",
        });
      }

      const updated = await ctx.db.offlineAction.update({
        where: { id: input.actionId },
        data: {
          status: "pending",
          errorMessage: null,
          processedAt: null,
        },
        select: { id: true, status: true },
      });

      return updated;
    }),
} satisfies TRPCRouterRecord;
