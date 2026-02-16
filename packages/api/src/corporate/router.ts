import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import {
  createCorporateAccountInput,
  paginationInput,
  updateCorporateAccountInput,
} from "@dubai/validators";

import { adminProcedure } from "../trpc";

/**
 * Corporate router — manages corporate accounts and their employees.
 */
export const corporateRouter = {
  /**
   * Create a new corporate account.
   */
  createAccount: adminProcedure
    .input(createCorporateAccountInput)
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.corporateAccount.create({
        data: {
          companyName: input.companyName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone ?? null,
          maxEmployees: input.maxEmployees,
          discountBps: input.discountBps,
        },
        select: {
          id: true,
          tenantId: true,
          companyName: true,
          contactEmail: true,
          contactPhone: true,
          maxEmployees: true,
          discountBps: true,
          isActive: true,
          createdAt: true,
        },
      });

      return account;
    }),

  /**
   * Update an existing corporate account.
   */
  updateAccount: adminProcedure
    .input(updateCorporateAccountInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.corporateAccount.findUnique({
        where: { id: input.accountId },
        select: { id: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Corporate account not found",
        });
      }

      const { accountId, ...rest } = input;

      // Build data object, converting undefined to omit and handling nullable fields
      const data: Record<string, unknown> = {};
      if (rest.companyName !== undefined) data.companyName = rest.companyName;
      if (rest.contactEmail !== undefined)
        data.contactEmail = rest.contactEmail;
      if (rest.contactPhone !== undefined)
        data.contactPhone = rest.contactPhone ?? null;
      if (rest.maxEmployees !== undefined)
        data.maxEmployees = rest.maxEmployees;
      if (rest.discountBps !== undefined) data.discountBps = rest.discountBps;

      const updated = await ctx.db.corporateAccount.update({
        where: { id: accountId },
        data,
        select: {
          id: true,
          companyName: true,
          contactEmail: true,
          contactPhone: true,
          maxEmployees: true,
          discountBps: true,
          isActive: true,
          updatedAt: true,
        },
      });

      return updated;
    }),

  /**
   * Activate or deactivate a corporate account.
   */
  toggleAccount: adminProcedure
    .input(z.object({ accountId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.corporateAccount.findUnique({
        where: { id: input.accountId },
        select: { id: true, isActive: true },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Corporate account not found",
        });
      }

      const updated = await ctx.db.corporateAccount.update({
        where: { id: input.accountId },
        data: { isActive: !account.isActive },
        select: {
          id: true,
          companyName: true,
          isActive: true,
          updatedAt: true,
        },
      });

      return updated;
    }),

  /**
   * Add an employee to a corporate account by userId.
   */
  addEmployee: adminProcedure
    .input(
      z.object({
        accountId: z.uuid(),
        userId: z.uuid(),
        employeeRef: z.string().max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.corporateAccount.findUnique({
        where: { id: input.accountId },
        select: {
          id: true,
          maxEmployees: true,
          _count: { select: { employees: true } },
        },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Corporate account not found",
        });
      }

      if (account._count.employees >= account.maxEmployees) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Employee limit reached (${account.maxEmployees})`,
        });
      }

      const employee = await ctx.db.corporateEmployee.create({
        data: {
          corporateId: input.accountId,
          userId: input.userId,
          employeeRef: input.employeeRef ?? null,
        },
        select: {
          id: true,
          corporateId: true,
          userId: true,
          employeeRef: true,
          createdAt: true,
        },
      });

      return employee;
    }),

  /**
   * Remove an employee from a corporate account.
   */
  removeEmployee: adminProcedure
    .input(z.object({ employeeId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const employee = await ctx.db.corporateEmployee.findUnique({
        where: { id: input.employeeId },
        select: { id: true },
      });

      if (!employee) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Employee not found",
        });
      }

      await ctx.db.corporateEmployee.delete({
        where: { id: input.employeeId },
      });

      return { success: true };
    }),

  /**
   * List employees in a corporate account.
   */
  listEmployees: adminProcedure
    .input(
      paginationInput.extend({
        accountId: z.uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.corporateEmployee.findMany({
        where: { corporateId: input.accountId },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          userId: true,
          employeeRef: true,
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
   * Get a single corporate account with its employees.
   */
  getAccount: adminProcedure
    .input(z.object({ accountId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.corporateAccount.findUnique({
        where: { id: input.accountId },
        select: {
          id: true,
          tenantId: true,
          companyName: true,
          contactEmail: true,
          contactPhone: true,
          maxEmployees: true,
          discountBps: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          employees: {
            select: {
              id: true,
              userId: true,
              employeeRef: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Corporate account not found",
        });
      }

      return account;
    }),
} satisfies TRPCRouterRecord;
