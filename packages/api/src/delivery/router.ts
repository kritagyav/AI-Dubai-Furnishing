import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@dubai/db";
import {
  scheduleDeliveryInput,
  rescheduleDeliveryInput,
  listDeliverySlotsInput,
  reportDeliveryIssueInput,
  updateDeliveryStatusInput,
  listDeliveriesInput,
} from "@dubai/validators";

import { adminProcedure, authedProcedure } from "../trpc";

export const deliveryRouter = {
  /**
   * List available delivery time slots for a date.
   */
  listSlots: authedProcedure
    .input(listDeliverySlotsInput)
    .query(async ({ ctx, input }) => {
      const date = new Date(input.date);

      const slots = await ctx.db.deliverySlot.findMany({
        where: {
          date,
          isActive: true,
          ...(input.area ? { area: input.area } : {}),
        },
        orderBy: { startTime: "asc" },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          capacity: true,
          booked: true,
          area: true,
        },
      });

      return slots.map((slot) => ({
        ...slot,
        available: slot.capacity - slot.booked,
      }));
    }),

  /**
   * Schedule a delivery for an order.
   */
  schedule: authedProcedure
    .input(scheduleDeliveryInput)
    .mutation(async ({ ctx, input }) => {
      // Verify order ownership and status
      const order = await ctx.db.order.findFirst({
        where: { id: input.orderId, userId: ctx.user.id },
        select: { id: true, status: true },
      });

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      if (!["PAID", "PROCESSING"].includes(order.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Order must be paid before scheduling delivery",
        });
      }

      // Verify slot availability
      const slot = await ctx.db.deliverySlot.findUnique({
        where: { id: input.slotId },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          capacity: true,
          booked: true,
        },
      });

      if (!slot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Delivery slot not found",
        });
      }

      if (slot.booked >= slot.capacity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Delivery slot is fully booked",
        });
      }

      const delivery = await ctx.db.$transaction(async (tx) => {
        // Increment slot booking
        await tx.deliverySlot.update({
          where: { id: slot.id },
          data: { booked: { increment: 1 } },
        });

        return tx.deliverySchedule.create({
          data: {
            orderId: input.orderId,
            slotId: slot.id,
            scheduledDate: slot.date,
            scheduledSlot: `${slot.startTime}-${slot.endTime}`,
            notes: input.notes ?? null,
            status: "SCHEDULED",
          },
          select: {
            id: true,
            scheduledDate: true,
            scheduledSlot: true,
            status: true,
          },
        });
      });

      return delivery;
    }),

  /**
   * Reschedule a delivery.
   */
  reschedule: authedProcedure
    .input(rescheduleDeliveryInput)
    .mutation(async ({ ctx, input }) => {
      const delivery = await ctx.db.deliverySchedule.findUnique({
        where: { id: input.deliveryId },
        select: { id: true, orderId: true, slotId: true, status: true },
      });

      if (!delivery) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Delivery not found",
        });
      }

      // Verify order ownership
      const order = await ctx.db.order.findFirst({
        where: { id: delivery.orderId, userId: ctx.user.id },
        select: { id: true },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      if (!["SCHEDULED", "FAILED"].includes(delivery.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Delivery cannot be rescheduled in its current status",
        });
      }

      const newSlot = await ctx.db.deliverySlot.findUnique({
        where: { id: input.slotId },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          capacity: true,
          booked: true,
        },
      });

      if (!newSlot || newSlot.booked >= newSlot.capacity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "New slot is not available",
        });
      }

      return ctx.db.$transaction(async (tx) => {
        // Release old slot
        if (delivery.slotId) {
          await tx.deliverySlot.update({
            where: { id: delivery.slotId },
            data: { booked: { decrement: 1 } },
          });
        }

        // Book new slot
        await tx.deliverySlot.update({
          where: { id: newSlot.id },
          data: { booked: { increment: 1 } },
        });

        return tx.deliverySchedule.update({
          where: { id: delivery.id },
          data: {
            slotId: newSlot.id,
            scheduledDate: newSlot.date,
            scheduledSlot: `${newSlot.startTime}-${newSlot.endTime}`,
            status: "RESCHEDULED",
          },
          select: {
            id: true,
            scheduledDate: true,
            scheduledSlot: true,
            status: true,
          },
        });
      });
    }),

  /**
   * Get delivery details for an order.
   */
  getByOrder: authedProcedure
    .input(scheduleDeliveryInput.pick({ orderId: true }))
    .query(async ({ ctx, input }) => {
      // Verify order ownership
      const order = await ctx.db.order.findFirst({
        where: { id: input.orderId, userId: ctx.user.id },
        select: { id: true },
      });

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      const deliveries = await ctx.db.deliverySchedule.findMany({
        where: { orderId: input.orderId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          scheduledSlot: true,
          driverName: true,
          driverPhone: true,
          trackingUrl: true,
          deliveredAt: true,
          notes: true,
          createdAt: true,
          issues: {
            select: {
              id: true,
              type: true,
              description: true,
              resolved: true,
              createdAt: true,
            },
          },
        },
      });

      return deliveries;
    }),

  /**
   * Report an issue with a delivery.
   */
  reportIssue: authedProcedure
    .input(reportDeliveryIssueInput)
    .mutation(async ({ ctx, input }) => {
      const delivery = await ctx.db.deliverySchedule.findUnique({
        where: { id: input.deliveryId },
        select: { id: true, orderId: true },
      });

      if (!delivery) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Delivery not found",
        });
      }

      // Verify order ownership
      const order = await ctx.db.order.findFirst({
        where: { id: delivery.orderId, userId: ctx.user.id },
        select: { id: true },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      const photoUrlsJson = input.photoUrls
        ? (input.photoUrls as Prisma.InputJsonValue)
        : undefined;

      return ctx.db.deliveryIssue.create({
        data: {
          deliveryId: delivery.id,
          type: input.type,
          description: input.description,
          ...(photoUrlsJson !== undefined ? { photoUrls: photoUrlsJson } : {}),
        },
        select: {
          id: true,
          type: true,
          description: true,
          createdAt: true,
        },
      });
    }),

  // ─── Admin: Manage deliveries ───

  /**
   * Update delivery status (admin/driver).
   */
  updateStatus: adminProcedure
    .input(updateDeliveryStatusInput)
    .mutation(async ({ ctx, input }) => {
      const delivery = await ctx.db.deliverySchedule.findUnique({
        where: { id: input.deliveryId },
        select: { id: true },
      });

      if (!delivery) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Delivery not found",
        });
      }

      return ctx.db.deliverySchedule.update({
        where: { id: delivery.id },
        data: {
          status: input.status,
          ...(input.driverName ? { driverName: input.driverName } : {}),
          ...(input.driverPhone ? { driverPhone: input.driverPhone } : {}),
          ...(input.trackingUrl ? { trackingUrl: input.trackingUrl } : {}),
          ...(input.status === "DELIVERED"
            ? { deliveredAt: new Date() }
            : {}),
        },
        select: {
          id: true,
          status: true,
          driverName: true,
          trackingUrl: true,
          deliveredAt: true,
        },
      });
    }),

  /**
   * List all deliveries with filters (admin).
   */
  listAll: adminProcedure
    .input(listDeliveriesInput)
    .query(async ({ ctx, input }) => {
      const where = {
        ...(input.orderId ? { orderId: input.orderId } : {}),
        ...(input.status ? { status: input.status } : {}),
      };

      const items = await ctx.db.deliverySchedule.findMany({
        where,
        orderBy: { scheduledDate: "asc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          orderId: true,
          status: true,
          scheduledDate: true,
          scheduledSlot: true,
          driverName: true,
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
   * Create delivery slots (admin).
   */
  createSlots: adminProcedure
    .input(listDeliverySlotsInput)
    .mutation(async ({ ctx, input }) => {
      // Generate standard 3-hour delivery slots for a given date
      const date = new Date(input.date);
      const timeSlots = [
        { startTime: "09:00", endTime: "12:00" },
        { startTime: "12:00", endTime: "15:00" },
        { startTime: "15:00", endTime: "18:00" },
        { startTime: "18:00", endTime: "21:00" },
      ];

      const created = [];
      for (const slot of timeSlots) {
        try {
          const s = await ctx.db.deliverySlot.create({
            data: {
              date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              capacity: 10,
              area: input.area ?? null,
            },
            select: { id: true, startTime: true, endTime: true },
          });
          created.push(s);
        } catch {
          // Ignore duplicates
        }
      }

      return { created: created.length, slots: created };
    }),
} satisfies TRPCRouterRecord;
