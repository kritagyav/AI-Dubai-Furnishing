import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@dubai/db";
import type { Prisma as PrismaTypes } from "@dubai/db";
import {
  catalogIngestInput,
  listCatalogIssuesInput,
  paginationInput,
  updateProductInput,
} from "@dubai/validators";
import { trackEvent } from "@dubai/queue";
import { z } from "zod/v4";

import { adminProcedure, publicProcedure, retailerProcedure } from "../trpc";

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

      trackEvent("catalog.uploaded", ctx.user.id, {
        total: input.products.length,
        succeeded: created,
        failed: errors,
      });

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

  // ─── Story 5.6: Catalog Health Monitoring ───

  /**
   * Get catalog health summary for the authenticated retailer.
   */
  getCatalogHealth: retailerProcedure.query(async ({ ctx }) => {
    const retailer = await ctx.db.retailer.findUnique({
      where: { userId: ctx.user.id },
      select: { id: true },
    });

    if (!retailer) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
    }

    // Get latest health check
    const latestCheck = await ctx.db.catalogHealthCheck.findFirst({
      where: { retailerId: retailer.id },
      orderBy: { checkedAt: "desc" },
    });

    // Count open issues by severity
    const issueCounts = await ctx.db.catalogIssue.groupBy({
      by: ["severity"],
      where: { retailerId: retailer.id, resolved: false },
      _count: true,
    });

    const issues = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const group of issueCounts) {
      issues[group.severity as keyof typeof issues] = group._count;
    }

    // Count issues by type
    const issuesByType = await ctx.db.catalogIssue.groupBy({
      by: ["issueType"],
      where: { retailerId: retailer.id, resolved: false },
      _count: true,
    });

    const typeBreakdown: Record<string, number> = {};
    for (const group of issuesByType) {
      typeBreakdown[group.issueType] = group._count;
    }

    return {
      latestCheck: latestCheck
        ? {
            overallScore: latestCheck.overallScore,
            totalProducts: latestCheck.totalProducts,
            issuesFound: latestCheck.issuesFound,
            staleProducts: latestCheck.staleProducts,
            missingFields: latestCheck.missingFields,
            brokenImages: latestCheck.brokenImages,
            pricingIssues: latestCheck.pricingIssues,
            checkedAt: latestCheck.checkedAt,
          }
        : null,
      openIssues: issues,
      typeBreakdown,
    };
  }),

  /**
   * List catalog issues for the authenticated retailer.
   */
  listCatalogIssues: retailerProcedure
    .input(listCatalogIssuesInput)
    .query(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      const issuesList = await ctx.db.catalogIssue.findMany({
        where: {
          retailerId: retailer.id,
          ...(input.severity ? { severity: input.severity } : {}),
          ...(input.issueType ? { issueType: input.issueType } : {}),
          ...(input.resolved !== undefined ? { resolved: input.resolved } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          productId: true,
          issueType: true,
          severity: true,
          description: true,
          recommendation: true,
          resolved: true,
          createdAt: true,
        },
      });

      let nextCursor: string | undefined;
      if (issuesList.length > input.limit) {
        const next = issuesList.pop();
        nextCursor = next?.id;
      }

      return { items: issuesList, nextCursor };
    }),

  /**
   * Run a catalog health check for a specific retailer.
   * Admin-only — normally triggered by scheduled job.
   */
  runHealthCheck: adminProcedure
    .input(z.object({ retailerId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const retailer = await ctx.db.retailer.findUnique({
        where: { id: input.retailerId },
        select: { id: true, status: true },
      });

      if (!retailer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Retailer not found" });
      }

      // Get all products for health analysis
      const products = await ctx.db.retailerProduct.findMany({
        where: { retailerId: retailer.id },
        select: {
          id: true,
          sku: true,
          name: true,
          photos: true,
          priceFils: true,
          stockQuantity: true,
          materials: true,
          colors: true,
          updatedAt: true,
        },
      });

      const totalProducts = products.length;
      let staleProducts = 0;
      let missingFields = 0;
      let brokenImages = 0;
      let pricingIssues = 0;
      const newIssues: Array<{
        productId: string;
        issueType: string;
        severity: string;
        description: string;
        recommendation: string;
      }> = [];

      const now = new Date();
      const staleThresholdMs = 7 * 24 * 60 * 60 * 1000; // 7 days

      for (const product of products) {
        // Stale stock check
        const ageMs = now.getTime() - product.updatedAt.getTime();
        if (ageMs > staleThresholdMs) {
          staleProducts++;
          newIssues.push({
            productId: product.id,
            issueType: "STALE_STOCK",
            severity: ageMs > staleThresholdMs * 2 ? "HIGH" : "MEDIUM",
            description: `Product "${product.name}" has not been updated in ${Math.floor(ageMs / (24 * 60 * 60 * 1000))} days`,
            recommendation: "Sync inventory to update stock levels and pricing",
          });
        }

        // Missing fields check
        const photos = product.photos as unknown[];
        if (!photos || (Array.isArray(photos) && photos.length === 0)) {
          missingFields++;
          newIssues.push({
            productId: product.id,
            issueType: "MISSING_FIELDS",
            severity: "HIGH",
            description: `Product "${product.name}" has no photos`,
            recommendation: "Add at least one product photo for package inclusion",
          });
        }

        const materials = product.materials as unknown[];
        if (!materials || (Array.isArray(materials) && materials.length === 0)) {
          missingFields++;
          newIssues.push({
            productId: product.id,
            issueType: "MISSING_FIELDS",
            severity: "LOW",
            description: `Product "${product.name}" has no materials listed`,
            recommendation: "Add material information for better AI matching",
          });
        }

        // Pricing anomaly check (zero or extremely high price)
        if (product.priceFils <= 0) {
          pricingIssues++;
          newIssues.push({
            productId: product.id,
            issueType: "PRICING_ANOMALY",
            severity: "CRITICAL",
            description: `Product "${product.name}" has invalid price: ${product.priceFils} fils`,
            recommendation: "Update product price to a valid amount",
          });
        } else if (product.priceFils > 100000000) {
          // > 1M AED
          pricingIssues++;
          newIssues.push({
            productId: product.id,
            issueType: "PRICING_ANOMALY",
            severity: "MEDIUM",
            description: `Product "${product.name}" has unusually high price: ${(product.priceFils / 100).toFixed(2)} AED`,
            recommendation: "Verify that the price is correct",
          });
        }
      }

      // Compute overall score (0-100)
      const issuesFound =
        staleProducts + missingFields + brokenImages + pricingIssues;
      const maxDeductions = totalProducts * 4; // 4 checks per product
      const overallScore =
        totalProducts === 0
          ? 100
          : Math.max(
              0,
              Math.round(100 - (issuesFound / maxDeductions) * 100),
            );

      // Save health check record
      const healthCheck = await ctx.db.catalogHealthCheck.create({
        data: {
          retailerId: retailer.id,
          overallScore,
          totalProducts,
          issuesFound,
          staleProducts,
          missingFields,
          brokenImages,
          pricingIssues,
        },
      });

      // Resolve old issues and create new ones
      await ctx.db.catalogIssue.updateMany({
        where: { retailerId: retailer.id, resolved: false },
        data: { resolved: true, resolvedAt: now },
      });

      if (newIssues.length > 0) {
        await ctx.db.catalogIssue.createMany({
          data: newIssues.map((issue) => ({
            retailerId: retailer.id,
            productId: issue.productId,
            issueType: issue.issueType as "STALE_STOCK",
            severity: issue.severity as "LOW",
            description: issue.description,
            recommendation: issue.recommendation,
          })),
        });
      }

      return {
        healthCheckId: healthCheck.id,
        overallScore,
        totalProducts,
        issuesFound,
        breakdown: { staleProducts, missingFields, brokenImages, pricingIssues },
      };
    }),

  // ─── Public Product Browsing ───

  /**
   * Browse products publicly (for gallery and discovery pages).
   * Returns active, in-stock products from approved retailers.
   */
  browseProducts: publicProcedure
    .input(
      paginationInput.extend({
        category: z.string().optional(),
        search: z.string().max(200).optional(),
        minPriceFils: z.number().int().nonnegative().optional(),
        maxPriceFils: z.number().int().positive().optional(),
        sortBy: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: PrismaTypes.RetailerProductWhereInput = {
        validationStatus: "ACTIVE",
        stockQuantity: { gt: 0 },
        retailer: { status: "APPROVED" },
        ...(input.category ? { category: input.category as "SOFA" } : {}),
        ...(input.search
          ? { name: { contains: input.search, mode: "insensitive" as const } }
          : {}),
        ...((input.minPriceFils !== undefined || input.maxPriceFils !== undefined)
          ? {
              priceFils: {
                ...(input.minPriceFils !== undefined ? { gte: input.minPriceFils } : {}),
                ...(input.maxPriceFils !== undefined ? { lte: input.maxPriceFils } : {}),
              },
            }
          : {}),
      };

      const orderBy: PrismaTypes.RetailerProductOrderByWithRelationInput =
        input.sortBy === "price_asc"
          ? { priceFils: "asc" }
          : input.sortBy === "price_desc"
            ? { priceFils: "desc" }
            : { createdAt: "desc" };

      const products = await ctx.db.retailerProduct.findMany({
        where,
        orderBy,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          name: true,
          category: true,
          priceFils: true,
          photos: true,
          materials: true,
          colors: true,
          retailer: {
            select: { companyName: true },
          },
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
   * Get a single product's public details (for the product detail page).
   * Returns active products from approved retailers only.
   */
  getProductDetail: publicProcedure
    .input(z.object({ productId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.retailerProduct.findFirst({
        where: {
          id: input.productId,
          validationStatus: "ACTIVE",
          retailer: { status: "APPROVED" },
        },
        select: {
          id: true,
          name: true,
          category: true,
          priceFils: true,
          photos: true,
          materials: true,
          colors: true,
          widthCm: true,
          depthCm: true,
          heightCm: true,
          stockQuantity: true,
          sku: true,
          createdAt: true,
          retailer: {
            select: { companyName: true },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found",
        });
      }

      // Fetch related products (same category, different product, limit 4)
      const relatedProducts = await ctx.db.retailerProduct.findMany({
        where: {
          category: product.category,
          id: { not: product.id },
          validationStatus: "ACTIVE",
          stockQuantity: { gt: 0 },
          retailer: { status: "APPROVED" },
        },
        take: 4,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          category: true,
          priceFils: true,
          photos: true,
          retailer: {
            select: { companyName: true },
          },
        },
      });

      return { ...product, relatedProducts };
    }),
} satisfies TRPCRouterRecord;
