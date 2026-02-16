import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import {
  listNotificationsInput,
  markNotificationReadInput,
  submitSurveyInput,
} from "@dubai/validators";

import { authedProcedure } from "../trpc";

export const engagementRouter = {
  // ─── Notifications ───

  /**
   * List user notifications with optional unread filter.
   */
  listNotifications: authedProcedure
    .input(listNotificationsInput)
    .query(async ({ ctx, input }) => {
      const where = {
        userId: ctx.user.id,
        ...(input.unreadOnly ? { read: false } : {}),
        ...(input.type ? { type: input.type } : {}),
      };

      const items = await ctx.db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          type: true,
          channel: true,
          title: true,
          body: true,
          data: true,
          read: true,
          sentAt: true,
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
   * Get unread notification count.
   */
  unreadCount: authedProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.notification.count({
      where: { userId: ctx.user.id, read: false },
    });
    return { count };
  }),

  /**
   * Mark a notification as read.
   */
  markRead: authedProcedure
    .input(markNotificationReadInput)
    .mutation(async ({ ctx, input }) => {
      const notification = await ctx.db.notification.findFirst({
        where: { id: input.notificationId, userId: ctx.user.id },
        select: { id: true },
      });

      if (!notification) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notification not found",
        });
      }

      return ctx.db.notification.update({
        where: { id: notification.id },
        data: { read: true, readAt: new Date() },
        select: { id: true, read: true },
      });
    }),

  /**
   * Mark all notifications as read.
   */
  markAllRead: authedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.notification.updateMany({
      where: { userId: ctx.user.id, read: false },
      data: { read: true, readAt: new Date() },
    });

    return { updated: result.count };
  }),

  // ─── Satisfaction Surveys ───

  /**
   * Submit a satisfaction survey.
   */
  submitSurvey: authedProcedure
    .input(submitSurveyInput)
    .mutation(async ({ ctx, input }) => {
      // Verify order ownership if orderId provided
      if (input.orderId) {
        const order = await ctx.db.order.findFirst({
          where: { id: input.orderId, userId: ctx.user.id },
          select: { id: true },
        });
        if (!order) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Order not found",
          });
        }
      }

      return ctx.db.satisfactionSurvey.create({
        data: {
          userId: ctx.user.id,
          orderId: input.orderId ?? null,
          overallScore: input.overallScore,
          deliveryScore: input.deliveryScore ?? null,
          qualityScore: input.qualityScore ?? null,
          comment: input.comment ?? null,
        },
        select: {
          id: true,
          overallScore: true,
          createdAt: true,
        },
      });
    }),

  /**
   * Get survey history for the user.
   */
  listSurveys: authedProcedure.query(async ({ ctx }) => {
    return ctx.db.satisfactionSurvey.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        orderId: true,
        overallScore: true,
        deliveryScore: true,
        qualityScore: true,
        comment: true,
        createdAt: true,
      },
    });
  }),
} satisfies TRPCRouterRecord;
