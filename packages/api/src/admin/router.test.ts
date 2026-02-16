import { TRPCError } from "@trpc/server";
import { vi } from "vitest";

// ─── Import the router and create caller factory ───

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

// ─── Mock external dependencies before importing router ───

vi.mock("@dubai/db", () => ({
  prisma: {},
  scopedClient: vi.fn(),
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60000,
    }),
  })),
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(),
}));

vi.mock("../audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./payout-service", () => ({
  payoutService: {
    initiateBankTransfer: vi.fn(),
    checkTransferStatus: vi.fn(),
  },
}));

const createCaller = createCallerFactory(appRouter);

// ─── Helpers ───

function createMockDb() {
  return {
    order: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    retailer: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    supportTicket: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    commission: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      updateMany: vi.fn(),
    },
    settlement: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ledgerEntry: {
      create: vi.fn(),
    },
    notification: {
      count: vi.fn(),
    },
    inventorySyncJob: {
      findFirst: vi.fn(),
    },
    reEngagementSequence: {
      count: vi.fn(),
    },
    orderLineItem: {
      groupBy: vi.fn(),
    },
    retailerProduct: {
      findMany: vi.fn(),
    },
    catalogHealthCheck: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    catalogIssue: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    corporateAccount: {
      findMany: vi.fn(),
    },
    agentPartner: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

function adminCtx(db: ReturnType<typeof createMockDb>) {
  // Set up user lookup for auth middleware
  db.user.findUnique.mockResolvedValue({
    id: "adm-1",
    role: "PLATFORM_ADMIN",
    tenantId: null,
    email: "admin@test.com",
    name: "Admin User",
  });

  return {
    session: { user: { id: "supabase-admin-1" } },
    headers: new Headers(),
    db: db as any,
    supabase: { auth: { getSession: vi.fn() } } as any,
    source: "test",
    correlationId: "test-corr",
  };
}

function nonAdminCtx(db: ReturnType<typeof createMockDb>) {
  db.user.findUnique.mockResolvedValue({
    id: "user-1",
    role: "USER",
    tenantId: null,
    email: "user@test.com",
    name: "Normal User",
  });

  return {
    session: { user: { id: "supabase-user-1" } },
    headers: new Headers(),
    db: db as any,
    supabase: { auth: { getSession: vi.fn() } } as any,
    source: "test",
    correlationId: "test-corr",
  };
}

function unauthCtx(db: ReturnType<typeof createMockDb>) {
  return {
    session: null,
    headers: new Headers(),
    db: db as any,
    supabase: { auth: { getSession: vi.fn() } } as any,
    source: "test",
    correlationId: "test-corr",
  };
}

// ═══════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════

describe("admin.platformStats", () => {
  it("returns order, retailer, and ticket counts", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.order.count.mockResolvedValue(42);
    db.order.aggregate.mockResolvedValue({ _sum: { totalFils: 1_000_000 } });
    db.retailer.groupBy.mockResolvedValue([
      { status: "APPROVED", _count: { _all: 10 } },
      { status: "PENDING", _count: { _all: 5 } },
      { status: "REJECTED", _count: { _all: 2 } },
    ]);
    db.supportTicket.groupBy.mockResolvedValue([
      { status: "OPEN", _count: { _all: 8 } },
      { status: "IN_PROGRESS", _count: { _all: 3 } },
    ]);

    const result = await caller.admin.platformStats();

    expect(result.orders.total).toBe(42);
    expect(result.orders.revenueFils).toBe(1_000_000);
    expect(result.retailers.approved).toBe(10);
    expect(result.retailers.pending).toBe(5);
    expect(result.retailers.total).toBe(17);
    expect(result.tickets.open).toBe(8);
    expect(result.tickets.inProgress).toBe(3);
  });

  it("handles null revenue sum", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.order.count.mockResolvedValue(0);
    db.order.aggregate.mockResolvedValue({ _sum: { totalFils: null } });
    db.retailer.groupBy.mockResolvedValue([]);
    db.supportTicket.groupBy.mockResolvedValue([]);

    const result = await caller.admin.platformStats();

    expect(result.orders.revenueFils).toBe(0);
    expect(result.retailers.total).toBe(0);
  });

  it("rejects non-admin users", async () => {
    const db = createMockDb();
    const ctx = nonAdminCtx(db);
    const caller = createCaller(ctx);

    await expect(caller.admin.platformStats()).rejects.toThrow(TRPCError);
  });

  it("rejects unauthenticated users", async () => {
    const db = createMockDb();
    const ctx = unauthCtx(db);
    const caller = createCaller(ctx);

    await expect(caller.admin.platformStats()).rejects.toThrow(TRPCError);
  });
});

describe("admin.listPendingRetailers", () => {
  it("returns pending retailers with pagination", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    const retailers = [
      {
        id: "r-1",
        companyName: "Furnish Co",
        tradeLicenseNumber: "TL-1",
        contactEmail: "a@b.com",
        businessType: "FURNITURE",
        documentsUrl: null,
        createdAt: new Date(),
      },
      {
        id: "r-2",
        companyName: "Decor Inc",
        tradeLicenseNumber: "TL-2",
        contactEmail: "c@d.com",
        businessType: "DECOR",
        documentsUrl: null,
        createdAt: new Date(),
      },
    ];
    db.retailer.findMany.mockResolvedValue(retailers);

    const result = await caller.admin.listPendingRetailers({ limit: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeUndefined();
  });

  it("returns nextCursor when there are more items", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    // Return limit+1 items to indicate more pages
    const retailers = Array.from({ length: 3 }, (_, i) => ({
      id: `r-${i}`,
      companyName: `Company ${i}`,
      tradeLicenseNumber: `TL-${i}`,
      contactEmail: `e${i}@test.com`,
      businessType: "FURNITURE",
      documentsUrl: null,
      createdAt: new Date(),
    }));
    db.retailer.findMany.mockResolvedValue(retailers);

    const result = await caller.admin.listPendingRetailers({ limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("r-2");
  });

  it("rejects non-admin users", async () => {
    const db = createMockDb();
    const ctx = nonAdminCtx(db);
    const caller = createCaller(ctx);

    await expect(
      caller.admin.listPendingRetailers({ limit: 20 }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("admin.decideRetailer (approve)", () => {
  it("approves a PENDING retailer", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.retailer.findUnique.mockResolvedValue({ id: "r-1", status: "PENDING" });
    db.retailer.update.mockResolvedValue({
      id: "r-1",
      companyName: "Test Co",
      status: "APPROVED",
      rejectionReason: null,
    });
    db.auditLog.create.mockResolvedValue({});

    const result = await caller.admin.decideRetailer({
      retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      decision: "APPROVED",
    });

    expect(result.status).toBe("APPROVED");
    expect(result.rejectionReason).toBeNull();
  });

  it("rejects already-approved retailer", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.retailer.findUnique.mockResolvedValue({ id: "r-1", status: "APPROVED" });
    db.auditLog.create.mockResolvedValue({});

    await expect(
      caller.admin.decideRetailer({
        retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        decision: "APPROVED",
      }),
    ).rejects.toThrow("already approved");
  });

  it("throws NOT_FOUND for unknown retailer", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.retailer.findUnique.mockResolvedValue(null);
    db.auditLog.create.mockResolvedValue({});

    await expect(
      caller.admin.decideRetailer({
        retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        decision: "APPROVED",
      }),
    ).rejects.toThrow("Retailer not found");
  });
});

describe("admin.decideRetailer (reject)", () => {
  it("rejects a PENDING retailer with a reason", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.retailer.findUnique.mockResolvedValue({ id: "r-1", status: "PENDING" });
    db.retailer.update.mockResolvedValue({
      id: "r-1",
      companyName: "Test Co",
      status: "REJECTED",
      rejectionReason: "Missing docs",
    });
    db.auditLog.create.mockResolvedValue({});

    const result = await caller.admin.decideRetailer({
      retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      decision: "REJECTED",
      reason: "Missing docs",
    });

    expect(result.status).toBe("REJECTED");
    expect(result.rejectionReason).toBe("Missing docs");
  });

  it("rejects an already-rejected retailer", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.retailer.findUnique.mockResolvedValue({ id: "r-1", status: "REJECTED" });
    db.auditLog.create.mockResolvedValue({});

    await expect(
      caller.admin.decideRetailer({
        retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        decision: "REJECTED",
      }),
    ).rejects.toThrow("already rejected");
  });
});

describe("admin.platformHealth", () => {
  it("returns API/DB/worker status", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.order.count.mockResolvedValue(5);
    db.notification.count.mockResolvedValue(12);
    db.inventorySyncJob.findFirst.mockResolvedValue({
      status: "COMPLETED",
      startedAt: new Date(), // recent => "Running"
    });
    db.reEngagementSequence.count.mockResolvedValue(3);

    const result = await caller.admin.platformHealth();

    expect(result.api).toBe("Operational");
    expect(result.database).toBe("Operational");
    expect(result.worker).toBe("Running");
    expect(result.recentOrders).toBe(5);
    expect(result.unreadNotifications).toBe(12);
    expect(result.activeSequences).toBe(3);
  });

  it("returns Idle worker when last sync is old", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.order.count.mockResolvedValue(0);
    db.notification.count.mockResolvedValue(0);
    db.inventorySyncJob.findFirst.mockResolvedValue({
      status: "COMPLETED",
      startedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 min ago => Idle
    });
    db.reEngagementSequence.count.mockResolvedValue(0);

    const result = await caller.admin.platformHealth();

    expect(result.worker).toBe("Idle");
  });

  it("returns Unknown worker when no sync jobs exist", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.order.count.mockResolvedValue(0);
    db.notification.count.mockResolvedValue(0);
    db.inventorySyncJob.findFirst.mockResolvedValue(null);
    db.reEngagementSequence.count.mockResolvedValue(0);

    const result = await caller.admin.platformHealth();

    expect(result.worker).toBe("Unknown");
  });
});

describe("admin.revenueMetrics", () => {
  it("returns revenue with period comparison for 7d", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.order.count.mockResolvedValue(10);
    db.order.aggregate.mockResolvedValue({ _sum: { totalFils: 500_000 } });
    db.commission.aggregate.mockResolvedValue({ _sum: { amountFils: 50_000 } });
    db.orderLineItem.groupBy.mockResolvedValue([]);
    db.retailer.findMany.mockResolvedValue([]);
    db.order.findMany.mockResolvedValue([]);

    const result = await caller.admin.revenueMetrics({ period: "7d" });

    expect(result.revenueFils).toBe(500_000);
    expect(result.commissionsFils).toBe(50_000);
    expect(result.netPayoutFils).toBe(450_000);
    expect(result.orderCount).toBe(10);
    expect(result.averageOrderFils).toBe(50_000);
    expect(result).toHaveProperty("dailyRevenue");
    expect(result).toHaveProperty("topRetailers");
  });

  it("handles zero orders for averageOrderFils", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.order.count.mockResolvedValue(0);
    db.order.aggregate.mockResolvedValue({ _sum: { totalFils: null } });
    db.commission.aggregate.mockResolvedValue({ _sum: { amountFils: null } });
    db.orderLineItem.groupBy.mockResolvedValue([]);
    db.retailer.findMany.mockResolvedValue([]);
    db.order.findMany.mockResolvedValue([]);

    const result = await caller.admin.revenueMetrics({ period: "30d" });

    expect(result.averageOrderFils).toBe(0);
    expect(result.revenueFils).toBe(0);
  });

  it("resolves top retailer names", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.order.count.mockResolvedValue(5);
    db.order.aggregate.mockResolvedValue({ _sum: { totalFils: 200_000 } });
    db.commission.aggregate.mockResolvedValue({ _sum: { amountFils: 20_000 } });
    db.orderLineItem.groupBy.mockResolvedValue([
      {
        retailerId: "ret-1",
        _sum: { totalFils: 150_000 },
        _count: { orderId: 3 },
      },
    ]);
    db.retailer.findMany.mockResolvedValue([
      { id: "ret-1", companyName: "Furnish Co" },
    ]);
    db.order.findMany.mockResolvedValue([]);

    const result = await caller.admin.revenueMetrics({ period: "90d" });

    expect(result.topRetailers).toHaveLength(1);
    expect(result.topRetailers[0]!.companyName).toBe("Furnish Co");
    expect(result.topRetailers[0]!.revenueFils).toBe(150_000);
  });
});

describe("admin.disputeMetrics", () => {
  it("returns dispute counts", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.commission.count
      .mockResolvedValueOnce(5) // totalDisputed
      .mockResolvedValueOnce(2); // resolvedDisputes

    db.supportTicket.groupBy
      .mockResolvedValueOnce([
        // disputeTicketCounts
        { status: "OPEN", _count: { _all: 3 } },
        { status: "RESOLVED", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        // ticketCategoryCounts
        { category: "DISPUTE", _count: { _all: 3 } },
        { category: "ORDER_ISSUE", _count: { _all: 2 } },
      ]);

    db.supportTicket.findMany.mockResolvedValue([]); // resolvedDisputeTickets

    const result = await caller.admin.disputeMetrics();

    expect(result.totalDisputes).toBe(9); // 5 + 4 ticket counts
    expect(result.resolved).toBe(3); // 2 commission + 1 ticket
    expect(result.pending).toBe(8); // 5 disputed + 3 open tickets
    expect(result.avgResolutionHours).toBe(0);
    expect(result.byReason).toHaveProperty("DISPUTE");
  });

  it("calculates average resolution hours from resolved tickets", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.commission.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    db.supportTicket.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const createdAt = new Date("2025-01-01T00:00:00Z");
    const resolvedAt = new Date("2025-01-01T24:00:00Z"); // 24 hours later

    db.supportTicket.findMany.mockResolvedValue([{ createdAt, resolvedAt }]);

    const result = await caller.admin.disputeMetrics();

    expect(result.avgResolutionHours).toBe(24);
  });
});

describe("admin.initiateSettlement", () => {
  it("bundles cleared commissions into settlement and creates ledger entry", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.retailer.findUnique.mockResolvedValue({
      id: "r-1",
      companyName: "Test Co",
    });
    db.commission.findMany.mockResolvedValue([
      { id: "c-1", netAmountFils: 10_000 },
      { id: "c-2", netAmountFils: 15_000 },
    ]);
    db.auditLog.create.mockResolvedValue({});

    const mockSettlement = {
      id: "s-1",
      totalAmountFils: 25_000,
      commissionCount: 2,
      status: "PENDING",
      createdAt: new Date(),
    };

    // $transaction receives a callback; we simulate it
    db.$transaction.mockImplementation(
      async (cb: (tx: any) => Promise<any>) => {
        const tx = {
          settlement: { create: vi.fn().mockResolvedValue(mockSettlement) },
          commission: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
          ledgerEntry: { create: vi.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      },
    );

    const result = await caller.admin.initiateSettlement({
      retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });

    expect(result.totalAmountFils).toBe(25_000);
    expect(result.commissionCount).toBe(2);
    expect(result.status).toBe("PENDING");
  });

  it("throws NOT_FOUND for unknown retailer", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.retailer.findUnique.mockResolvedValue(null);
    db.auditLog.create.mockResolvedValue({});

    await expect(
      caller.admin.initiateSettlement({
        retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      }),
    ).rejects.toThrow("Retailer not found");
  });

  it("throws BAD_REQUEST when no cleared commissions exist", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.retailer.findUnique.mockResolvedValue({
      id: "r-1",
      companyName: "Test Co",
    });
    db.commission.findMany.mockResolvedValue([]);
    db.auditLog.create.mockResolvedValue({});

    await expect(
      caller.admin.initiateSettlement({
        retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      }),
    ).rejects.toThrow("No cleared commissions");
  });

  it("rejects non-admin users", async () => {
    const db = createMockDb();
    const ctx = nonAdminCtx(db);
    const caller = createCaller(ctx);

    await expect(
      caller.admin.initiateSettlement({
        retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("admin.triggerCatalogHealthCheck", () => {
  it("scores products and creates issues for stale, missing fields, and pricing anomalies", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.retailer.findUnique.mockResolvedValue({
      id: "r-1",
      companyName: "Test Co",
    });

    const now = new Date();
    const staleDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days ago

    db.retailerProduct.findMany.mockResolvedValue([
      {
        id: "p-1",
        sku: "SKU-1",
        name: "Stale Product",
        photos: [],
        priceFils: 50,
        stockQuantity: 10,
        materials: ["wood"],
        updatedAt: staleDate,
      },
      {
        id: "p-2",
        sku: "SKU-2",
        name: "Good Product",
        photos: ["photo.jpg"],
        priceFils: 50000,
        stockQuantity: 5,
        materials: ["metal"],
        updatedAt: now,
      },
    ]);

    db.catalogHealthCheck.create.mockResolvedValue({ id: "hc-1" });
    db.catalogIssue.updateMany.mockResolvedValue({ count: 0 });
    db.catalogIssue.createMany.mockResolvedValue({ count: 3 });

    const result = await caller.admin.triggerCatalogHealthCheck({
      retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });

    expect(result.totalProducts).toBe(2);
    expect(result.issuesFound).toBeGreaterThan(0);
    expect(result.breakdown.staleProducts).toBe(1);
    expect(result.breakdown.missingFields).toBeGreaterThanOrEqual(1); // p-1 has no photos
    expect(result.breakdown.pricingIssues).toBe(1); // p-1 has priceFils < 100
    expect(result.overallScore).toBeLessThan(100);
    expect(result.healthCheckId).toBe("hc-1");
  });

  it("returns score 100 when no products exist", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.retailer.findUnique.mockResolvedValue({
      id: "r-1",
      companyName: "Test Co",
    });
    db.retailerProduct.findMany.mockResolvedValue([]);
    db.catalogHealthCheck.create.mockResolvedValue({ id: "hc-1" });
    db.catalogIssue.updateMany.mockResolvedValue({ count: 0 });

    const result = await caller.admin.triggerCatalogHealthCheck({
      retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });

    expect(result.totalProducts).toBe(0);
    expect(result.overallScore).toBe(100);
    expect(result.issuesFound).toBe(0);
  });

  it("throws NOT_FOUND for unknown retailer", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.retailer.findUnique.mockResolvedValue(null);

    await expect(
      caller.admin.triggerCatalogHealthCheck({
        retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      }),
    ).rejects.toThrow("Retailer not found");
  });

  it("detects pricing anomaly for very high price", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.retailer.findUnique.mockResolvedValue({
      id: "r-1",
      companyName: "Test Co",
    });

    db.retailerProduct.findMany.mockResolvedValue([
      {
        id: "p-1",
        sku: "SKU-1",
        name: "Expensive Product",
        photos: ["photo.jpg"],
        priceFils: 60_000_000, // > 50M
        stockQuantity: 1,
        materials: ["gold"],
        updatedAt: new Date(),
      },
    ]);

    db.catalogHealthCheck.create.mockResolvedValue({ id: "hc-1" });
    db.catalogIssue.updateMany.mockResolvedValue({ count: 0 });
    db.catalogIssue.createMany.mockResolvedValue({ count: 1 });

    const result = await caller.admin.triggerCatalogHealthCheck({
      retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });

    expect(result.breakdown.pricingIssues).toBe(1);
  });
});
