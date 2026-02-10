import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@dubai/db";
import type { Prisma as PrismaTypes } from "@dubai/db";
import {
  catalogIngestInput,
  paginationInput,
  updateProductInput,
} from "@dubai/validators";
import { z } from "zod/v4";

import { retailerProcedure } from "../trpc";

type JsonValue = PrismaTypes.InputJsonValue;

/**
 * Catalog router — Story 5.2: Product Catalog API Integration.
 *
 * Handles product ingestion, validation, listing, and management
 * for approved retailers. All procedures use retailerProcedure
 * which enforces tenant scoping.
 */
export const catalogRouter = {
  /**
   * Ingest a batch of products (up to 1000).
   * Products are validated and stored with their validation status.
   */
  ingestProducts: retailerProcedure
    .input(catalogIngestInput)
    .mutation(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true, tenantId: true, status: true },
      });

      if (!retailer || retailer.status !== "APPROVED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only approved retailers can ingest products",
        });
      }

      const results: Array<{
        sku: string;
        status: "created" | "updated" | "error";
        error?: string;
      }> = [];

      for (const product of input.products) {
        try {
          await ctx.db.retailerProduct.upsert({
            where: {
              retailerId_sku: {
                retailerId: retailer.id,
                sku: product.sku,
              },
            },
            create: {
              retailerId: retailer.id,
              tenantId: retailer.tenantId,
              sku: product.sku,
              name: product.name,
              category: product.category,
              widthCm: product.dimensions.widthCm,
              depthCm: product.dimensions.depthCm,
              heightCm: product.dimensions.heightCm,
              materials: product.materials as JsonValue,
              colors: product.colors as JsonValue,
              priceFils: product.priceFils,
              photos: product.photos as JsonValue,
              stockQuantity: product.stockQuantity,
              validationStatus: "ACTIVE",
            },
            update: {
              name: product.name,
              category: product.category,
              widthCm: product.dimensions.widthCm,
              depthCm: product.dimensions.depthCm,
              heightCm: product.dimensions.heightCm,
              materials: product.materials as JsonValue,
              colors: product.colors as JsonValue,
              priceFils: product.priceFils,
              photos: product.photos as JsonValue,
              stockQuantity: product.stockQuantity,
              validationStatus: "ACTIVE",
              validationErrors: Prisma.DbNull,
            },
          });

          results.push({ sku: product.sku, status: "updated" });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          results.push({ sku: product.sku, status: "error", error: message });
        }
      }

      const created = results.filter((r) => r.status !== "error").length;
      const errors = results.filter((r) => r.status === "error").length;

      return { total: input.products.length, succeeded: created, failed: errors, results };
    }),

  /**
   * List products for the authenticated retailer.
   */
  listProducts: retailerProcedure
    .input(
      paginationInput.extend({
        status: z.enum(["ACTIVE", "PENDING", "REJECTED"]).optional(),
        category: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      const products = await ctx.db.retailerProduct.findMany({
        where: {
          retailerId: retailer.id,
          ...(input.status ? { validationStatus: input.status } : {}),
          ...(input.category ? { category: input.category as "SOFA" } : {}),
        } satisfies PrismaTypes.RetailerProductWhereInput,
        orderBy: { updatedAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          sku: true,
          name: true,
          category: true,
          priceFils: true,
          stockQuantity: true,
          validationStatus: true,
          photos: true,
          updatedAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (products.length > input.limit) {
        const next = products.pop();
        nextCursor = next?.id;
      }

      return { items: products, nextCursor };
    }),

  /**
   * Get a single product's details.
   */
  getProduct: retailerProcedure
    .input(z.object({ productId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      const product = await ctx.db.retailerProduct.findFirst({
        where: { id: input.productId, retailerId: retailer.id },
      });

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      return product;
    }),

  /**
   * Update a product's mutable fields.
   */
  updateProduct: retailerProcedure
    .input(updateProductInput)
    .mutation(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      const product = await ctx.db.retailerProduct.findFirst({
        where: { id: input.productId, retailerId: retailer.id },
        select: { id: true },
      });

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      return ctx.db.retailerProduct.update({
        where: { id: input.productId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.priceFils !== undefined ? { priceFils: input.priceFils } : {}),
          ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
          ...(input.photos !== undefined ? { photos: input.photos as JsonValue } : {}),
        },
        select: {
          id: true,
          sku: true,
          name: true,
          priceFils: true,
          stockQuantity: true,
          validationStatus: true,
        },
      });
    }),

  /**
   * Delete a product from the catalog.
   */
  deleteProduct: retailerProcedure
    .input(z.object({ productId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      const product = await ctx.db.retailerProduct.findFirst({
        where: { id: input.productId, retailerId: retailer.id },
        select: { id: true },
      });

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      await ctx.db.retailerProduct.delete({ where: { id: input.productId } });
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
