import { vi, describe, it, expect, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ─── Mock external dependencies ───

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    analyticsEvent: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    orderLineItem: {
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("@dubai/db", () => ({
  prisma: mockPrisma,
  scopedClient: vi.fn(),
  Prisma: { DbNull: Symbol("DbNull") },
}));

vi.mock("@dubai/queue", () => ({
  trackEvent: vi.fn(),
  enqueue: vi.fn().mockResolvedValue(undefined),
  getQueue: vi.fn(),
}));

import { analyticsRouter } from "./router";
import { trackEvent } from "@dubai/queue";

// ─── Helpers ───

function createMockDb() {
  return {
    retailer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    commission: {
      findMany: vi.fn(),
    },
    retailerProduct: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    inventorySyncConfig: {
      findUnique: vi.fn(),
    },
    catalogHealthCheck: {
      findFirst: vi.fn(),
    },
  };
}

type MockDb = ReturnType<typeof createMockDb>;

function retailerCtx(db: MockDb) {
  return {
    user: {
      id: "ret-user-1",
      supabaseId: "supa-ret-1",
      role: "RETAILER_ADMIN",
      tenantId: "tenant-1",
      email: "retailer@test.com",
      name: "Retailer Admin",
    },
    db: db as unknown,
    tenantId: "tenant-1",
    correlationId: "test-corr",
  };
}

function userCtx(db: MockDb) {
  return {
    user: {
      id: "user-1",
      supabaseId: "supa-user-1",
      role: "USER",
      tenantId: null,
      email: "user@test.com",
      name: "Test User",
    },
    db: db as unknown,
    correlationId: "test-corr",
  };
}

/**
 * Direct procedure invocation: bypasses middleware, calls the resolver directly.
 * Same pattern used by the catalog router tests.
 */
async function callProcedure(
  procedure: { _def: { resolver?: unknown } },
  opts: { ctx: unknown; input?: unknown },
) {
  const handler = procedure._def.resolver;
  if (!handler) throw new Error("No handler found");
  return (handler as (opts: { ctx: unknown; input: unknown }) => unknown)(opts);
}

// ═══════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════

describe("analytics.getDashboardMetrics", () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  it("returns commission-based and event-based metrics for time range", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue({ id: "ret-1", status: "APPROVED" });
    db.commission.findMany
      .mockResolvedValueOnce([
        // current period
        { netAmountFils: 10_000, amountFils: 1_000 },
        { netAmountFils: 20_000, amountFils: 2_000 },
      ])
      .mockResolvedValueOnce([
        // previous period
        { netAmountFils: 5_000, amountFils: 500 },
      ]);

    db.retailerProduct.groupBy.mockResolvedValue([
      { validationStatus: "ACTIVE", _count: 8 },
      { validationStatus: "PENDING", _count: 2 },
    ]);

    db.inventorySyncConfig.findUnique.mockResolvedValue({
      lastSyncAt: new Date(),
      consecutiveFailures: 0,
      isActive: true,
    });

    db.catalogHealthCheck.findFirst.mockResolvedValue({
      overallScore: 85,
      issuesFound: 3,
      checkedAt: new Date(),
    });

    db.retailerProduct.findMany.mockResolvedValue([
      { id: "prod-1" },
      { id: "prod-2" },
    ]);

    // Mock unscoped prisma analytics queries
    mockPrisma.analyticsEvent.count
      .mockResolvedValueOnce(100) // impressions
      .mockResolvedValueOnce(25) // packageSelections
      .mockResolvedValueOnce(10) // conversions
      .mockResolvedValueOnce(8); // confirmedOrders

    const result = await callProcedure(analyticsRouter.getDashboardMetrics, {
      ctx,
      input: { timeRange: "30d" },
    }) as any;

    expect(result.metrics.totalOrders).toBe(2);
    expect(result.metrics.prevTotalOrders).toBe(1);
    expect(result.metrics.revenueFils).toBe(30_000);
    expect(result.metrics.prevRevenueFils).toBe(5_000);
    expect(result.metrics.commissionPaidFils).toBe(3_000);
    expect(result.eventMetrics.impressions).toBe(100);
    expect(result.eventMetrics.packageSelections).toBe(25);
    expect(result.eventMetrics.conversions).toBe(10);
    expect(result.eventMetrics.confirmedOrders).toBe(8);
    expect(result.catalog.totalProducts).toBe(10);
    expect(result.catalog.activeProducts).toBe(8);
    expect(result.catalog.healthScore).toBe(85);
    expect(result.sync.isActive).toBe(true);
    expect(result.period).toHaveProperty("from");
    expect(result.period).toHaveProperty("to");
  });

  it("rejects non-approved retailers", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue({ id: "ret-1", status: "PENDING" });

    await expect(
      callProcedure(analyticsRouter.getDashboardMetrics, {
        ctx,
        input: { timeRange: "7d" },
      }),
    ).rejects.toThrow("Retailer account not approved");
  });

  it("rejects if retailer not found", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue(null);

    await expect(
      callProcedure(analyticsRouter.getDashboardMetrics, {
        ctx,
        input: { timeRange: "7d" },
      }),
    ).rejects.toThrow("Retailer account not approved");
  });

  it("handles null sync config gracefully", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue({ id: "ret-1", status: "APPROVED" });
    db.commission.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    db.retailerProduct.groupBy.mockResolvedValue([]);
    db.inventorySyncConfig.findUnique.mockResolvedValue(null);
    db.catalogHealthCheck.findFirst.mockResolvedValue(null);
    db.retailerProduct.findMany.mockResolvedValue([]);

    mockPrisma.analyticsEvent.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const result = await callProcedure(analyticsRouter.getDashboardMetrics, {
      ctx,
      input: { timeRange: "30d" },
    }) as any;

    expect(result.sync.lastSyncAt).toBeNull();
    expect(result.sync.consecutiveFailures).toBe(0);
    expect(result.sync.isActive).toBe(false);
    expect(result.catalog.healthScore).toBeNull();
  });

  it("handles custom time range", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue({ id: "ret-1", status: "APPROVED" });
    db.commission.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    db.retailerProduct.groupBy.mockResolvedValue([]);
    db.inventorySyncConfig.findUnique.mockResolvedValue(null);
    db.catalogHealthCheck.findFirst.mockResolvedValue(null);
    db.retailerProduct.findMany.mockResolvedValue([]);

    mockPrisma.analyticsEvent.count.mockResolvedValue(0);

    const result = await callProcedure(analyticsRouter.getDashboardMetrics, {
      ctx,
      input: {
        timeRange: "custom",
        fromDate: "2025-01-01T00:00:00Z",
        toDate: "2025-01-31T23:59:59Z",
      },
    }) as any;

    expect(result.period.from).toContain("2025-01-01");
    expect(result.period.to).toContain("2025-01-31");
  });
});

describe("analytics.getProductPerformance", () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  it("returns per-product views, orders, conversion rate", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue({ id: "ret-1" });

    db.retailerProduct.findMany.mockResolvedValue([
      { id: "p-1", sku: "SKU-1", name: "Sofa", category: "SOFA", priceFils: 50_000, stockQuantity: 10 },
      { id: "p-2", sku: "SKU-2", name: "Table", category: "COFFEE_TABLE", priceFils: 20_000, stockQuantity: 5 },
    ]);

    // Mock view events
    mockPrisma.analyticsEvent.findMany.mockResolvedValue([
      { properties: { productId: "p-1" } },
      { properties: { productId: "p-1" } },
      { properties: { productId: "p-2" } },
    ]);

    // Mock order counts
    mockPrisma.orderLineItem.groupBy.mockResolvedValue([
      { productId: "p-1", _count: 2 },
    ]);

    const result = await callProcedure(analyticsRouter.getProductPerformance, {
      ctx,
      input: { limit: 20, sortBy: "revenue" },
    }) as any;

    expect(result.products).toHaveLength(2);

    const sofa = result.products.find((p: any) => p.id === "p-1");
    expect(sofa).toBeDefined();
    expect(sofa.views).toBe(2);
    expect(sofa.orders).toBe(2);
    expect(sofa.conversionRate).toBe(1); // 2/2

    const table = result.products.find((p: any) => p.id === "p-2");
    expect(table).toBeDefined();
    expect(table.views).toBe(1);
    expect(table.orders).toBe(0);
    expect(table.conversionRate).toBe(0);
  });

  it("throws NOT_FOUND when retailer not found", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue(null);

    await expect(
      callProcedure(analyticsRouter.getProductPerformance, {
        ctx,
        input: { limit: 20, sortBy: "revenue" },
      }),
    ).rejects.toThrow("Retailer not found");
  });

  it("handles zero views correctly (no division by zero)", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue({ id: "ret-1" });
    db.retailerProduct.findMany.mockResolvedValue([
      { id: "p-1", sku: "SKU-1", name: "Sofa", category: "SOFA", priceFils: 50_000, stockQuantity: 10 },
    ]);

    mockPrisma.analyticsEvent.findMany.mockResolvedValue([]);
    mockPrisma.orderLineItem.groupBy.mockResolvedValue([]);

    const result = await callProcedure(analyticsRouter.getProductPerformance, {
      ctx,
      input: { limit: 20, sortBy: "name" },
    }) as any;

    expect(result.products[0].conversionRate).toBe(0);
  });

  it("handles empty product list", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue({ id: "ret-1" });
    db.retailerProduct.findMany.mockResolvedValue([]);

    const result = await callProcedure(analyticsRouter.getProductPerformance, {
      ctx,
      input: { limit: 20, sortBy: "revenue" },
    }) as any;

    expect(result.products).toHaveLength(0);
  });
});

describe("analytics.trackImpression", () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  it("fires analytics event and returns success", async () => {
    const ctx = userCtx(db);

    const result = await callProcedure(analyticsRouter.trackImpression, {
      ctx,
      input: { productId: "p-1", source: "gallery" },
    }) as any;

    expect(result.success).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith("product.viewed", "user-1", {
      productId: "p-1",
      source: "gallery",
    });
  });

  it("accepts 'search' as source", async () => {
    const ctx = userCtx(db);

    const result = await callProcedure(analyticsRouter.trackImpression, {
      ctx,
      input: { productId: "p-2", source: "search" },
    }) as any;

    expect(result.success).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith("product.viewed", "user-1", {
      productId: "p-2",
      source: "search",
    });
  });

  it("accepts 'package' as source", async () => {
    const ctx = userCtx(db);

    const result = await callProcedure(analyticsRouter.trackImpression, {
      ctx,
      input: { productId: "p-3", source: "package" },
    }) as any;

    expect(result.success).toBe(true);
  });
});

describe("analytics.getConversionFunnel", () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  it("returns funnel step counts and conversion rates", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue({ id: "ret-1", status: "APPROVED" });

    mockPrisma.analyticsEvent.count
      .mockResolvedValueOnce(1000) // impressions
      .mockResolvedValueOnce(200) // package_selections
      .mockResolvedValueOnce(100) // cart_additions
      .mockResolvedValueOnce(50) // orders
      .mockResolvedValueOnce(40); // paid_orders

    const result = await callProcedure(analyticsRouter.getConversionFunnel, {
      ctx,
      input: { timeRange: "30d" },
    }) as any;

    expect(result.funnel).toHaveLength(5);

    expect(result.funnel[0].step).toBe("impressions");
    expect(result.funnel[0].count).toBe(1000);
    expect(result.funnel[0].conversionRate).toBe(1);

    expect(result.funnel[1].step).toBe("package_selections");
    expect(result.funnel[1].count).toBe(200);
    expect(result.funnel[1].conversionRate).toBe(0.2);

    expect(result.funnel[2].step).toBe("cart_additions");
    expect(result.funnel[2].count).toBe(100);
    expect(result.funnel[2].conversionRate).toBe(0.5);

    expect(result.funnel[3].step).toBe("orders");
    expect(result.funnel[3].count).toBe(50);
    expect(result.funnel[3].conversionRate).toBe(0.5);

    expect(result.funnel[4].step).toBe("paid_orders");
    expect(result.funnel[4].count).toBe(40);
    expect(result.funnel[4].conversionRate).toBe(0.8);

    expect(result.overall.totalImpressions).toBe(1000);
    expect(result.overall.totalPaidOrders).toBe(40);
    expect(result.overall.overallConversionRate).toBe(0.04);
  });

  it("handles zero impressions without division error", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue({ id: "ret-1", status: "APPROVED" });

    mockPrisma.analyticsEvent.count.mockResolvedValue(0);

    const result = await callProcedure(analyticsRouter.getConversionFunnel, {
      ctx,
      input: { timeRange: "7d" },
    }) as any;

    expect(result.funnel[1].conversionRate).toBe(0);
    expect(result.overall.overallConversionRate).toBe(0);
  });

  it("rejects non-approved retailers", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue({ id: "ret-1", status: "PENDING" });

    await expect(
      callProcedure(analyticsRouter.getConversionFunnel, {
        ctx,
        input: { timeRange: "30d" },
      }),
    ).rejects.toThrow("Retailer account not approved");
  });

  it("returns period range in response", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue({ id: "ret-1", status: "APPROVED" });

    mockPrisma.analyticsEvent.count.mockResolvedValue(0);

    const result = await callProcedure(analyticsRouter.getConversionFunnel, {
      ctx,
      input: { timeRange: "90d" },
    }) as any;

    expect(result.period).toHaveProperty("from");
    expect(result.period).toHaveProperty("to");
  });

  it("supports custom time range", async () => {
    const ctx = retailerCtx(db);

    db.retailer.findUnique.mockResolvedValue({ id: "ret-1", status: "APPROVED" });

    mockPrisma.analyticsEvent.count.mockResolvedValue(0);

    const result = await callProcedure(analyticsRouter.getConversionFunnel, {
      ctx,
      input: {
        timeRange: "custom",
        fromDate: "2025-06-01T00:00:00Z",
        toDate: "2025-06-30T23:59:59Z",
      },
    }) as any;

    expect(result.period.from).toContain("2025-06-01");
    expect(result.period.to).toContain("2025-06-30");
  });
});
