import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import {
  generatePackageInput,
  listPackagesInput,
  reviewPackageInput,
  updatePackageStatusInput,
} from "@dubai/validators";

import { authedProcedure } from "../trpc";

export const packageRouter = {
  /**
   * Generate a new AI furniture package for a project/room.
   * Kicks off async generation; returns immediately with GENERATING status.
   */
  generate: authedProcedure
    .input(generatePackageInput)
    .mutation(async ({ ctx, input }) => {
      // Verify project ownership
      const project = await ctx.db.project.findFirst({
        where: { id: input.projectId, userId: ctx.user.id },
        select: { id: true, name: true },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Verify room if specified
      if (input.roomId) {
        const room = await ctx.db.room.findFirst({
          where: { id: input.roomId, projectId: input.projectId },
          select: { id: true },
        });
        if (!room) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Room not found in this project",
          });
        }
      }

      // Get user preferences for AI context
      const preference = await ctx.db.userPreference.findFirst({
        where: { userId: ctx.user.id, projectId: input.projectId },
        select: {
          budgetMinFils: true,
          budgetMaxFils: true,
          stylePreferences: true,
        },
      });

      // Create package record in GENERATING state
      const pkg = await ctx.db.package.create({
        data: {
          userId: ctx.user.id,
          projectId: input.projectId,
          roomId: input.roomId ?? null,
          name: `AI Package for ${project.name}`,
          status: "GENERATING",
          styleTag: input.styleTag ?? null,
          aiModelVersion: "v1.0",
        },
        select: { id: true, status: true, createdAt: true },
      });

      // In production, this would queue a job to the AI service.
      // For now, simulate generation by selecting matching products.
      const budgetMax = preference?.budgetMaxFils ?? 500000; // 5000 AED default
      const products = await ctx.db.retailerProduct.findMany({
        where: {
          validationStatus: "ACTIVE",
          stockQuantity: { gt: 0 },
          priceFils: { lte: budgetMax },
        },
        take: 8,
        orderBy: { createdAt: "desc" },
        select: { id: true, priceFils: true },
      });

      if (products.length > 0) {
        await ctx.db.packageItem.createMany({
          data: products.map((p) => ({
            packageId: pkg.id,
            productId: p.id,
            quantity: 1,
            unitPriceFils: p.priceFils,
          })),
        });

        const totalPrice = products.reduce((sum, p) => sum + p.priceFils, 0);

        await ctx.db.package.update({
          where: { id: pkg.id },
          data: {
            status: "READY",
            totalPriceFils: totalPrice,
            generatedAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });
      }

      return pkg;
    }),

  /**
   * Get a specific package with its items.
   */
  get: authedProcedure
    .input(updatePackageStatusInput.pick({ packageId: true }))
    .query(async ({ ctx, input }) => {
      const pkg = await ctx.db.package.findFirst({
        where: { id: input.packageId, userId: ctx.user.id },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          totalPriceFils: true,
          styleTag: true,
          generatedAt: true,
          expiresAt: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              unitPriceFils: true,
              roomPlacement: true,
            },
          },
          previews: {
            select: {
              id: true,
              imageUrl: true,
              thumbnailUrl: true,
              viewAngle: true,
            },
          },
          reviews: {
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
            },
          },
        },
      });

      if (!pkg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Package not found",
        });
      }

      return pkg;
    }),

  /**
   * List packages for a project or all user packages.
   */
  list: authedProcedure
    .input(listPackagesInput)
    .query(async ({ ctx, input }) => {
      const where = {
        userId: ctx.user.id,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.status ? { status: input.status } : {}),
      };

      const items = await ctx.db.package.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          name: true,
          status: true,
          totalPriceFils: true,
          styleTag: true,
          createdAt: true,
          _count: { select: { items: true } },
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
   * Accept or reject a package.
   */
  updateStatus: authedProcedure
    .input(updatePackageStatusInput)
    .mutation(async ({ ctx, input }) => {
      const pkg = await ctx.db.package.findFirst({
        where: { id: input.packageId, userId: ctx.user.id },
        select: { id: true, status: true },
      });

      if (!pkg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Package not found",
        });
      }

      if (pkg.status !== "READY") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only ready packages can be accepted or rejected",
        });
      }

      return ctx.db.package.update({
        where: { id: pkg.id },
        data: { status: input.status },
        select: { id: true, status: true },
      });
    }),

  /**
   * Add to cart from an accepted package.
   */
  addPackageToCart: authedProcedure
    .input(updatePackageStatusInput.pick({ packageId: true }))
    .mutation(async ({ ctx, input }) => {
      const pkg = await ctx.db.package.findFirst({
        where: {
          id: input.packageId,
          userId: ctx.user.id,
          status: "ACCEPTED",
        },
        select: {
          id: true,
          items: {
            select: { productId: true, quantity: true, unitPriceFils: true },
          },
        },
      });

      if (!pkg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Accepted package not found",
        });
      }

      // Upsert cart
      const cart = await ctx.db.cart.upsert({
        where: { userId: ctx.user.id },
        create: { userId: ctx.user.id },
        update: {},
        select: { id: true },
      });

      let added = 0;
      for (const item of pkg.items) {
        const existing = await ctx.db.cartItem.findFirst({
          where: { cartId: cart.id, productId: item.productId },
          select: { id: true, quantity: true },
        });

        if (existing) {
          await ctx.db.cartItem.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + item.quantity,
              priceFils: item.unitPriceFils,
            },
          });
        } else {
          await ctx.db.cartItem.create({
            data: {
              cartId: cart.id,
              productId: item.productId,
              quantity: item.quantity,
              priceFils: item.unitPriceFils,
            },
          });
        }
        added++;
      }

      return { added };
    }),

  /**
   * Review a package.
   */
  review: authedProcedure
    .input(reviewPackageInput)
    .mutation(async ({ ctx, input }) => {
      const pkg = await ctx.db.package.findFirst({
        where: { id: input.packageId, userId: ctx.user.id },
        select: { id: true },
      });

      if (!pkg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Package not found",
        });
      }

      return ctx.db.packageReview.upsert({
        where: {
          packageId_userId: {
            packageId: input.packageId,
            userId: ctx.user.id,
          },
        },
        create: {
          packageId: input.packageId,
          userId: ctx.user.id,
          rating: input.rating,
          comment: input.comment ?? null,
        },
        update: {
          rating: input.rating,
          comment: input.comment ?? null,
        },
        select: { id: true, rating: true, comment: true },
      });
    }),
} satisfies TRPCRouterRecord;
