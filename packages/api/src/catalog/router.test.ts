import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogRouter } from "./router";

// Mock external dependencies
vi.mock("@dubai/queue", () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
  trackEvent: vi.fn(),
}));

// Mock @dubai/db for Prisma.DbNull
vi.mock("@dubai/db", () => ({
  Prisma: {
    DbNull: Symbol("DbNull"),
  },
}));

// ─── Helpers ───

function createMockDb() {
  return {
    retailer: {
      findUnique: vi.fn(),
    },
    retailerProduct: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    catalogHealthCheck: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    catalogIssue: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      createMany: vi.fn(),
    },
  };
}

type MockDb = ReturnType<typeof createMockDb>;

function retailerCtx(db: MockDb) {
  return {
    user: {
      id: "user-retailer",
      supabaseId: "supa-retailer",
      role: "RETAILER_ADMIN",
      tenantId: "tenant-1",
      email: "retailer@example.com",
      name: "Retailer User",
    },
    db: db as unknown,
    tenantId: "tenant-1",
    correlationId: "test-corr",
  };
}

function publicCtx(db: MockDb) {
  return {
    db: db as unknown,
    correlationId: "test-corr",
  };
}

function adminCtx(db: MockDb) {
  return {
    user: {
      id: "admin-1",
      supabaseId: "supa-admin",
      role: "PLATFORM_ADMIN",
      tenantId: null,
      email: "admin@example.com",
      name: "Admin User",
    },
    db: db as unknown,
    correlationId: "test-corr",
  };
}

async function callProcedure(
  procedure: { _def: { resolver?: unknown } },
  opts: { ctx: unknown; input?: unknown },
) {
  const handler = procedure._def.resolver;
  if (!handler) throw new Error("No handler found");
  return (handler as (opts: { ctx: unknown; input: unknown }) => unknown)(opts);
}

// ═══════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════

describe("catalog router", () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  // ─── browseProducts (public) ───

  describe("browseProducts", () => {
    it("returns active products from approved retailers", async () => {
      const products = [
        {
          id: "p1",
          name: "Modern Sofa",
          category: "SOFA",
          priceFils: 100000,
          photos: ["https://example.com/photo.jpg"],
          materials: ["wood"],
          colors: ["brown"],
          retailer: { companyName: "Luxury Furnishings" },
        },
      ];
      db.retailerProduct.findMany.mockResolvedValue(products);

      const result = await callProcedure(catalogRouter.browseProducts, {
        ctx: publicCtx(db),
        input: { limit: 20, sortBy: "newest" },
      });

      expect(db.retailerProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            validationStatus: "ACTIVE",
            stockQuantity: { gt: 0 },
            retailer: { status: "APPROVED" },
          }),
        }),
      );
      expect((result as { items: unknown[] }).items).toHaveLength(1);
    });

    it("filters by category", async () => {
      db.retailerProduct.findMany.mockResolvedValue([]);

      await callProcedure(catalogRouter.browseProducts, {
        ctx: publicCtx(db),
        input: { limit: 20, category: "SOFA", sortBy: "newest" },
      });

      expect(db.retailerProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: "SOFA",
          }),
        }),
      );
    });

    it("filters by search term", async () => {
      db.retailerProduct.findMany.mockResolvedValue([]);

      await callProcedure(catalogRouter.browseProducts, {
        ctx: publicCtx(db),
        input: { limit: 20, search: "modern", sortBy: "newest" },
      });

      expect(db.retailerProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: "modern", mode: "insensitive" },
          }),
        }),
      );
    });

    it("filters by price range", async () => {
      db.retailerProduct.findMany.mockResolvedValue([]);

      await callProcedure(catalogRouter.browseProducts, {
        ctx: publicCtx(db),
        input: {
          limit: 20,
          minPriceFils: 10000,
          maxPriceFils: 50000,
          sortBy: "newest",
        },
      });

      expect(db.retailerProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priceFils: { gte: 10000, lte: 50000 },
          }),
        }),
      );
    });

    it("sorts by price ascending", async () => {
      db.retailerProduct.findMany.mockResolvedValue([]);

      await callProcedure(catalogRouter.browseProducts, {
        ctx: publicCtx(db),
        input: { limit: 20, sortBy: "price_asc" },
      });

      expect(db.retailerProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { priceFils: "asc" },
        }),
      );
    });

    it("sorts by price descending", async () => {
      db.retailerProduct.findMany.mockResolvedValue([]);

      await callProcedure(catalogRouter.browseProducts, {
        ctx: publicCtx(db),
        input: { limit: 20, sortBy: "price_desc" },
      });

      expect(db.retailerProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { priceFils: "desc" },
        }),
      );
    });

    it("sorts by newest by default", async () => {
      db.retailerProduct.findMany.mockResolvedValue([]);

      await callProcedure(catalogRouter.browseProducts, {
        ctx: publicCtx(db),
        input: { limit: 20, sortBy: "newest" },
      });

      expect(db.retailerProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("returns nextCursor for pagination", async () => {
      const products = Array.from({ length: 3 }, (_, i) => ({
        id: `p${i}`,
        name: `Product ${i}`,
        category: "SOFA",
        priceFils: 10000 * (i + 1),
        photos: [],
        materials: [],
        colors: [],
        retailer: { companyName: "Shop" },
      }));
      db.retailerProduct.findMany.mockResolvedValue(products);

      const result = await callProcedure(catalogRouter.browseProducts, {
        ctx: publicCtx(db),
        input: { limit: 2, sortBy: "newest" },
      });

      expect((result as { items: unknown[] }).items).toHaveLength(2);
      expect((result as { nextCursor: string }).nextCursor).toBe("p2");
    });
  });

  // ─── getProductDetail (public) ───

  describe("getProductDetail", () => {
    it("returns product with retailer info and related products", async () => {
      const product = {
        id: "p1",
        name: "Luxe Sofa",
        category: "SOFA",
        priceFils: 150000,
        photos: ["https://example.com/photo.jpg"],
        materials: ["leather"],
        colors: ["black"],
        widthCm: 200,
        depthCm: 90,
        heightCm: 85,
        stockQuantity: 5,
        sku: "LUXE-001",
        createdAt: new Date(),
        retailer: { companyName: "Premium Furnishings" },
      };
      db.retailerProduct.findFirst.mockResolvedValue(product);

      const relatedProducts = [
        {
          id: "p2",
          name: "Related Sofa",
          category: "SOFA",
          priceFils: 120000,
          photos: [],
          retailer: { companyName: "Other Shop" },
        },
      ];
      db.retailerProduct.findMany.mockResolvedValue(relatedProducts);

      const result = await callProcedure(catalogRouter.getProductDetail, {
        ctx: publicCtx(db),
        input: { productId: "p1" },
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: "p1",
          name: "Luxe Sofa",
          retailer: { companyName: "Premium Furnishings" },
          relatedProducts: expect.arrayContaining([
            expect.objectContaining({ id: "p2" }),
          ]),
        }),
      );

      // Related products query should exclude current product
      expect(db.retailerProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: "SOFA",
            id: { not: "p1" },
            validationStatus: "ACTIVE",
          }),
          take: 4,
        }),
      );
    });

    it("rejects inactive product", async () => {
      db.retailerProduct.findFirst.mockResolvedValue(null);

      await expect(
        callProcedure(catalogRouter.getProductDetail, {
          ctx: publicCtx(db),
          input: { productId: "p-inactive" },
        }),
      ).rejects.toThrow("Product not found");
    });
  });

  // ─── listProducts (retailer) ───

  describe("listProducts", () => {
    it("returns only retailer's products", async () => {
      db.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
      const products = [
        {
          id: "p1",
          sku: "SKU-1",
          name: "Sofa",
          category: "SOFA",
          priceFils: 100000,
          stockQuantity: 5,
          validationStatus: "ACTIVE",
          photos: [],
          updatedAt: new Date(),
        },
      ];
      db.retailerProduct.findMany.mockResolvedValue(products);

      const result = await callProcedure(catalogRouter.listProducts, {
        ctx: retailerCtx(db),
        input: { limit: 20 },
      });

      expect(db.retailerProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ retailerId: "retailer-1" }),
        }),
      );
      expect((result as { items: unknown[] }).items).toHaveLength(1);
    });

    it("rejects when retailer not found", async () => {
      db.retailer.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(catalogRouter.listProducts, {
          ctx: retailerCtx(db),
          input: { limit: 20 },
        }),
      ).rejects.toThrow("Retailer not found");
    });

    it("filters by status", async () => {
      db.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
      db.retailerProduct.findMany.mockResolvedValue([]);

      await callProcedure(catalogRouter.listProducts, {
        ctx: retailerCtx(db),
        input: { limit: 20, status: "ACTIVE" },
      });

      expect(db.retailerProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ validationStatus: "ACTIVE" }),
        }),
      );
    });

    it("filters by category", async () => {
      db.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
      db.retailerProduct.findMany.mockResolvedValue([]);

      await callProcedure(catalogRouter.listProducts, {
        ctx: retailerCtx(db),
        input: { limit: 20, category: "BED" },
      });

      expect(db.retailerProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: "BED" }),
        }),
      );
    });

    it("paginates with cursor", async () => {
      db.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
      const products = Array.from({ length: 3 }, (_, i) => ({
        id: `p${i}`,
        sku: `SKU-${i}`,
        name: `Product ${i}`,
        category: "SOFA",
        priceFils: 10000,
        stockQuantity: 5,
        validationStatus: "ACTIVE",
        photos: [],
        updatedAt: new Date(),
      }));
      db.retailerProduct.findMany.mockResolvedValue(products);

      const result = await callProcedure(catalogRouter.listProducts, {
        ctx: retailerCtx(db),
        input: { limit: 2 },
      });

      expect((result as { items: unknown[] }).items).toHaveLength(2);
      expect((result as { nextCursor: string }).nextCursor).toBe("p2");
    });
  });

  // ─── createProduct (via ingestProducts) ───

  describe("ingestProducts", () => {
    it("rejects when retailer not found", async () => {
      db.retailer.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(catalogRouter.ingestProducts, {
          ctx: retailerCtx(db),
          input: {
            products: [
              {
                name: "Sofa",
                sku: "SOFA-1",
                category: "SOFA",
                dimensions: { widthCm: 200, depthCm: 90, heightCm: 85 },
                materials: ["wood"],
                colors: ["brown"],
                priceFils: 100000,
                photos: ["https://example.com/p.jpg"],
                stockQuantity: 5,
              },
            ],
          },
        }),
      ).rejects.toThrow("Only approved retailers can ingest products");
    });

    it("rejects when retailer not approved", async () => {
      db.retailer.findUnique.mockResolvedValue({
        id: "r1",
        tenantId: "tenant-1",
        status: "PENDING",
      });

      await expect(
        callProcedure(catalogRouter.ingestProducts, {
          ctx: retailerCtx(db),
          input: {
            products: [
              {
                name: "Sofa",
                sku: "SOFA-1",
                category: "SOFA",
                dimensions: { widthCm: 200, depthCm: 90, heightCm: 85 },
                materials: ["wood"],
                colors: ["brown"],
                priceFils: 100000,
                photos: ["https://example.com/p.jpg"],
                stockQuantity: 5,
              },
            ],
          },
        }),
      ).rejects.toThrow("Only approved retailers can ingest products");
    });

    it("creates products successfully", async () => {
      db.retailer.findUnique.mockResolvedValue({
        id: "r1",
        tenantId: "tenant-1",
        status: "APPROVED",
      });
      db.retailerProduct.upsert.mockResolvedValue({});

      const result = await callProcedure(catalogRouter.ingestProducts, {
        ctx: retailerCtx(db),
        input: {
          products: [
            {
              name: "Sofa",
              sku: "SOFA-1",
              category: "SOFA",
              dimensions: { widthCm: 200, depthCm: 90, heightCm: 85 },
              materials: ["wood"],
              colors: ["brown"],
              priceFils: 100000,
              photos: ["https://example.com/p.jpg"],
              stockQuantity: 5,
            },
            {
              name: "Table",
              sku: "TABLE-1",
              category: "DINING_TABLE",
              dimensions: { widthCm: 150, depthCm: 80, heightCm: 75 },
              materials: ["metal"],
              colors: ["white"],
              priceFils: 50000,
              photos: ["https://example.com/t.jpg"],
              stockQuantity: 3,
            },
          ],
        },
      });

      expect(db.retailerProduct.upsert).toHaveBeenCalledTimes(2);
      expect(result).toEqual(
        expect.objectContaining({
          total: 2,
          succeeded: 2,
          failed: 0,
        }),
      );
    });

    it("handles errors for individual products", async () => {
      db.retailer.findUnique.mockResolvedValue({
        id: "r1",
        tenantId: "tenant-1",
        status: "APPROVED",
      });
      // First product succeeds, second fails
      db.retailerProduct.upsert
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error("Duplicate key"));

      const result = await callProcedure(catalogRouter.ingestProducts, {
        ctx: retailerCtx(db),
        input: {
          products: [
            {
              name: "Sofa",
              sku: "SOFA-1",
              category: "SOFA",
              dimensions: { widthCm: 200, depthCm: 90, heightCm: 85 },
              materials: ["wood"],
              colors: ["brown"],
              priceFils: 100000,
              photos: ["https://example.com/p.jpg"],
              stockQuantity: 5,
            },
            {
              name: "Bad Product",
              sku: "BAD-1",
              category: "BED",
              dimensions: { widthCm: 100, depthCm: 50, heightCm: 40 },
              materials: ["fabric"],
              colors: ["blue"],
              priceFils: 20000,
              photos: ["https://example.com/b.jpg"],
              stockQuantity: 1,
            },
          ],
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          total: 2,
          succeeded: 1,
          failed: 1,
        }),
      );
      expect(
        (result as { results: Array<{ status: string }> }).results.find(
          (r) => r.status === "error",
        ),
      ).toBeDefined();
    });
  });

  // ─── updateProduct (retailer) ───

  describe("updateProduct", () => {
    it("updates product fields", async () => {
      db.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
      db.retailerProduct.findFirst.mockResolvedValue({ id: "p1" });
      db.retailerProduct.update.mockResolvedValue({
        id: "p1",
        sku: "SKU-1",
        name: "Updated Sofa",
        priceFils: 120000,
        stockQuantity: 10,
        validationStatus: "ACTIVE",
      });

      const result = await callProcedure(catalogRouter.updateProduct, {
        ctx: retailerCtx(db),
        input: {
          productId: "p1",
          name: "Updated Sofa",
          priceFils: 120000,
          stockQuantity: 10,
        },
      });

      expect(db.retailerProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "p1" },
          data: expect.objectContaining({
            name: "Updated Sofa",
            priceFils: 120000,
            stockQuantity: 10,
          }),
        }),
      );
      expect((result as { name: string }).name).toBe("Updated Sofa");
    });

    it("rejects when retailer not found", async () => {
      db.retailer.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(catalogRouter.updateProduct, {
          ctx: retailerCtx(db),
          input: { productId: "p1", name: "Test" },
        }),
      ).rejects.toThrow("Retailer not found");
    });

    it("rejects when product belongs to another retailer", async () => {
      db.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
      // findFirst returns null because product doesn't belong to this retailer
      db.retailerProduct.findFirst.mockResolvedValue(null);

      await expect(
        callProcedure(catalogRouter.updateProduct, {
          ctx: retailerCtx(db),
          input: { productId: "p-other", name: "Stolen Update" },
        }),
      ).rejects.toThrow("Product not found");
    });

    it("only updates provided fields", async () => {
      db.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
      db.retailerProduct.findFirst.mockResolvedValue({ id: "p1" });
      db.retailerProduct.update.mockResolvedValue({
        id: "p1",
        sku: "SKU-1",
        name: "Original Name",
        priceFils: 99000,
        stockQuantity: 5,
        validationStatus: "ACTIVE",
      });

      await callProcedure(catalogRouter.updateProduct, {
        ctx: retailerCtx(db),
        input: { productId: "p1", priceFils: 99000 },
      });

      const updateCall = db.retailerProduct.update.mock.calls[0]![0];
      // name should not be in the data since it was not provided
      expect(updateCall.data).not.toHaveProperty("name");
      expect(updateCall.data).toHaveProperty("priceFils", 99000);
    });
  });

  // ─── deleteProduct ───

  describe("deleteProduct", () => {
    it("deletes product successfully", async () => {
      db.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
      db.retailerProduct.findFirst.mockResolvedValue({ id: "p1" });
      db.retailerProduct.delete.mockResolvedValue({});

      const result = await callProcedure(catalogRouter.deleteProduct, {
        ctx: retailerCtx(db),
        input: { productId: "p1" },
      });

      expect(db.retailerProduct.delete).toHaveBeenCalledWith({
        where: { id: "p1" },
      });
      expect(result).toEqual({ success: true });
    });

    it("rejects when product not found", async () => {
      db.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
      db.retailerProduct.findFirst.mockResolvedValue(null);

      await expect(
        callProcedure(catalogRouter.deleteProduct, {
          ctx: retailerCtx(db),
          input: { productId: "p-missing" },
        }),
      ).rejects.toThrow("Product not found");
    });
  });

  // ─── getProduct ───

  describe("getProduct", () => {
    it("returns product details for retailer's own product", async () => {
      db.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
      const product = {
        id: "p1",
        name: "Sofa",
        sku: "SOFA-1",
        category: "SOFA",
        priceFils: 100000,
      };
      db.retailerProduct.findFirst.mockResolvedValue(product);

      const result = await callProcedure(catalogRouter.getProduct, {
        ctx: retailerCtx(db),
        input: { productId: "p1" },
      });

      expect(db.retailerProduct.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "p1", retailerId: "retailer-1" },
        }),
      );
      expect(result).toEqual(product);
    });

    it("rejects when product not found", async () => {
      db.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
      db.retailerProduct.findFirst.mockResolvedValue(null);

      await expect(
        callProcedure(catalogRouter.getProduct, {
          ctx: retailerCtx(db),
          input: { productId: "p-other" },
        }),
      ).rejects.toThrow("Product not found");
    });
  });

  // ─── getCatalogHealth ───

  describe("getCatalogHealth", () => {
    it("returns health data with no prior check", async () => {
      db.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
      db.catalogHealthCheck.findFirst.mockResolvedValue(null);
      db.catalogIssue.groupBy.mockResolvedValue([]);

      const result = await callProcedure(catalogRouter.getCatalogHealth, {
        ctx: retailerCtx(db),
      });

      expect(result).toEqual(
        expect.objectContaining({
          latestCheck: null,
          openIssues: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
          typeBreakdown: {},
        }),
      );
    });

    it("returns health data with existing check and issues", async () => {
      db.retailer.findUnique.mockResolvedValue({ id: "retailer-1" });
      db.catalogHealthCheck.findFirst.mockResolvedValue({
        overallScore: 85,
        totalProducts: 50,
        issuesFound: 3,
        staleProducts: 1,
        missingFields: 1,
        brokenImages: 0,
        pricingIssues: 1,
        checkedAt: new Date("2025-01-01"),
      });
      db.catalogIssue.groupBy
        .mockResolvedValueOnce([
          { severity: "HIGH", _count: 2 },
          { severity: "MEDIUM", _count: 1 },
        ])
        .mockResolvedValueOnce([
          { issueType: "STALE_STOCK", _count: 1 },
          { issueType: "MISSING_FIELDS", _count: 2 },
        ]);

      const result = await callProcedure(catalogRouter.getCatalogHealth, {
        ctx: retailerCtx(db),
      });

      expect(
        (result as { latestCheck: { overallScore: number } }).latestCheck
          .overallScore,
      ).toBe(85);
      expect((result as { openIssues: { HIGH: number } }).openIssues.HIGH).toBe(
        2,
      );
    });
  });

  // ─── runHealthCheck (admin) ───

  describe("runHealthCheck", () => {
    it("rejects when retailer not found", async () => {
      db.retailer.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(catalogRouter.runHealthCheck, {
          ctx: adminCtx(db),
          input: { retailerId: "r-missing" },
        }),
      ).rejects.toThrow("Retailer not found");
    });

    it("runs health check and creates issues", async () => {
      db.retailer.findUnique.mockResolvedValue({
        id: "r1",
        status: "APPROVED",
      });
      db.retailerProduct.findMany.mockResolvedValue([
        {
          id: "p1",
          sku: "S1",
          name: "Sofa",
          photos: [],
          priceFils: 100000,
          stockQuantity: 5,
          materials: ["wood"],
          colors: ["brown"],
          updatedAt: new Date(), // recent, not stale
        },
        {
          id: "p2",
          sku: "S2",
          name: "Zero Price Item",
          photos: ["https://example.com/p.jpg"],
          priceFils: 0,
          stockQuantity: 5,
          materials: [],
          colors: [],
          updatedAt: new Date(),
        },
      ]);
      db.catalogHealthCheck.create.mockResolvedValue({ id: "hc-1" });
      db.catalogIssue.updateMany.mockResolvedValue({});
      db.catalogIssue.createMany.mockResolvedValue({});

      const result = await callProcedure(catalogRouter.runHealthCheck, {
        ctx: adminCtx(db),
        input: { retailerId: "r1" },
      });

      expect(result).toEqual(
        expect.objectContaining({
          healthCheckId: "hc-1",
          totalProducts: 2,
        }),
      );
      // p1 has no photos (missing fields), p2 has zero price (pricing anomaly) and no materials
      expect((result as { issuesFound: number }).issuesFound).toBeGreaterThan(
        0,
      );
      expect(db.catalogIssue.createMany).toHaveBeenCalled();
    });
  });
});
