import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@dubai/db";
import {
  createTicketInput,
  addTicketMessageInput,
  updateTicketStatusInput,
  assignTicketInput,
  listTicketsInput,
} from "@dubai/validators";

import { authedProcedure, supportProcedure } from "../trpc";

type JsonValue = Prisma.InputJsonValue;

export const supportRouter = {
  // ─── Customer-facing ───

  /**
   * Create a new support ticket.
   */
  create: authedProcedure
    .input(createTicketInput)
    .mutation(async ({ ctx, input }) => {
      const attachmentsJson = input.attachments
        ? (input.attachments as JsonValue)
        : undefined;

      return ctx.db.supportTicket.create({
        data: {
          userId: ctx.user.id,
          category: input.category,
          subject: input.subject,
          description: input.description,
          priority: input.priority,
          orderId: input.orderId ?? null,
          ...(attachmentsJson !== undefined
            ? { attachments: attachmentsJson }
            : {}),
        },
        select: {
          id: true,
          ticketRef: true,
          category: true,
          priority: true,
          status: true,
          subject: true,
          createdAt: true,
        },
      });
    }),

  /**
   * List the current user's tickets.
   */
  listMine: authedProcedure
    .input(listTicketsInput)
    .query(async ({ ctx, input }) => {
      const where = {
        userId: ctx.user.id,
        ...(input.status ? { status: input.status } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
      };

      const items = await ctx.db.supportTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          ticketRef: true,
          category: true,
          priority: true,
          status: true,
          subject: true,
          createdAt: true,
          updatedAt: true,
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
   * Get a ticket with messages.
   */
  get: authedProcedure
    .input(addTicketMessageInput.pick({ ticketId: true }))
    .query(async ({ ctx, input }) => {
      const ticket = await ctx.db.supportTicket.findFirst({
        where: { id: input.ticketId, userId: ctx.user.id },
        select: {
          id: true,
          ticketRef: true,
          category: true,
          priority: true,
          status: true,
          subject: true,
          description: true,
          orderId: true,
          attachments: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              senderId: true,
              senderRole: true,
              body: true,
              attachments: true,
              createdAt: true,
            },
          },
        },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      return ticket;
    }),

  /**
   * Add a message to a ticket (customer side).
   */
  addMessage: authedProcedure
    .input(addTicketMessageInput)
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.supportTicket.findFirst({
        where: { id: input.ticketId, userId: ctx.user.id },
        select: { id: true, status: true },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      if (ticket.status === "CLOSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot add messages to a closed ticket",
        });
      }

      const attachmentsJson = input.attachments
        ? (input.attachments as JsonValue)
        : undefined;

      const message = await ctx.db.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: ctx.user.id,
          senderRole: "customer",
          body: input.body,
          ...(attachmentsJson !== undefined
            ? { attachments: attachmentsJson }
            : {}),
        },
        select: {
          id: true,
          senderRole: true,
          body: true,
          createdAt: true,
        },
      });

      // Re-open if waiting on customer
      if (ticket.status === "WAITING_ON_CUSTOMER") {
        await ctx.db.supportTicket.update({
          where: { id: ticket.id },
          data: { status: "IN_PROGRESS" },
        });
      }

      return message;
    }),

  // ─── Support Agent ───

  /**
   * List all tickets (support agents).
   */
  listAll: supportProcedure
    .input(listTicketsInput)
    .query(async ({ ctx, input }) => {
      const where = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
      };

      const items = await ctx.db.supportTicket.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          ticketRef: true,
          userId: true,
          assigneeId: true,
          category: true,
          priority: true,
          status: true,
          subject: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { messages: true } },
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
   * Get a ticket with messages (support agent view).
   */
  getTicket: supportProcedure
    .input(addTicketMessageInput.pick({ ticketId: true }))
    .query(async ({ ctx, input }) => {
      const ticket = await ctx.db.supportTicket.findUnique({
        where: { id: input.ticketId },
        select: {
          id: true,
          ticketRef: true,
          userId: true,
          assigneeId: true,
          category: true,
          priority: true,
          status: true,
          subject: true,
          description: true,
          orderId: true,
          attachments: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              senderId: true,
              senderRole: true,
              body: true,
              attachments: true,
              createdAt: true,
            },
          },
        },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      return ticket;
    }),

  /**
   * Reply to a ticket (support agent).
   */
  reply: supportProcedure
    .input(addTicketMessageInput)
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.supportTicket.findUnique({
        where: { id: input.ticketId },
        select: { id: true, status: true },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      const attachmentsJson = input.attachments
        ? (input.attachments as JsonValue)
        : undefined;

      const message = await ctx.db.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: ctx.user.id,
          senderRole: "support",
          body: input.body,
          ...(attachmentsJson !== undefined
            ? { attachments: attachmentsJson }
            : {}),
        },
        select: {
          id: true,
          senderRole: true,
          body: true,
          createdAt: true,
        },
      });

      // Auto-set to WAITING_ON_CUSTOMER if currently IN_PROGRESS
      if (ticket.status === "IN_PROGRESS" || ticket.status === "OPEN") {
        await ctx.db.supportTicket.update({
          where: { id: ticket.id },
          data: { status: "WAITING_ON_CUSTOMER" },
        });
      }

      return message;
    }),

  /**
   * Assign a ticket to a support agent.
   */
  assign: supportProcedure
    .input(assignTicketInput)
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.supportTicket.findUnique({
        where: { id: input.ticketId },
        select: { id: true },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      return ctx.db.supportTicket.update({
        where: { id: ticket.id },
        data: {
          assigneeId: input.assigneeId,
          status: "IN_PROGRESS",
        },
        select: {
          id: true,
          assigneeId: true,
          status: true,
        },
      });
    }),

  /**
   * Update ticket status (resolve, close, etc.).
   */
  updateStatus: supportProcedure
    .input(updateTicketStatusInput)
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.supportTicket.findUnique({
        where: { id: input.ticketId },
        select: { id: true },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      const now = new Date();

      return ctx.db.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: input.status,
          ...(input.status === "RESOLVED" ? { resolvedAt: now } : {}),
          ...(input.status === "CLOSED" ? { closedAt: now } : {}),
        },
        select: {
          id: true,
          status: true,
          resolvedAt: true,
          closedAt: true,
        },
      });
    }),

  /**
   * Get support dashboard metrics.
   */
  metrics: supportProcedure.query(async ({ ctx }) => {
    const statusCounts = await ctx.db.supportTicket.groupBy({
      by: ["status"],
      _count: true,
    });

    const priorityCounts = await ctx.db.supportTicket.groupBy({
      by: ["priority"],
      where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] } },
      _count: true,
    });

    const stats = {
      open: 0,
      inProgress: 0,
      waitingOnCustomer: 0,
      resolved: 0,
      closed: 0,
    };

    for (const group of statusCounts) {
      if (group.status === "OPEN") stats.open = group._count;
      else if (group.status === "IN_PROGRESS") stats.inProgress = group._count;
      else if (group.status === "WAITING_ON_CUSTOMER")
        stats.waitingOnCustomer = group._count;
      else if (group.status === "RESOLVED") stats.resolved = group._count;
      else if (group.status === "CLOSED") stats.closed = group._count;
    }

    const priorities = { low: 0, medium: 0, high: 0, urgent: 0 };
    for (const group of priorityCounts) {
      if (group.priority === "LOW") priorities.low = group._count;
      else if (group.priority === "MEDIUM") priorities.medium = group._count;
      else if (group.priority === "HIGH") priorities.high = group._count;
      else if (group.priority === "URGENT") priorities.urgent = group._count;
    }

    return { statuses: stats, activePriorities: priorities };
  }),
} satisfies TRPCRouterRecord;
