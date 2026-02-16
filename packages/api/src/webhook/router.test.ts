import { createHmac } from "node:crypto";

import { vi } from "vitest";
import { TRPCError } from "@trpc/server";

// ─── Mock external dependencies before importing router ───

vi.mock("@dubai/db", () => ({
  prisma: {},
  scopedClient: vi.fn(),
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: Date.now() + 60000 }),
  })),
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(),
}));

vi.mock("../audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import the router and create caller factory ───

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

const createCaller = createCallerFactory(appRouter);

// ─── Helpers ───

function createMockDb() {
  return {
    inventorySyncConfig: { findFirst: vi.fn(), update: vi.fn() },
    inventorySyncJob: { create: vi.fn() },
    retailerProduct: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  };
}

function publicCtx(db: ReturnType<typeof createMockDb>) {
  return {
    session: null,
    headers: new Headers(),
    db: db as any,
    supabase: { auth: { getSession: vi.fn() } } as any,
    source: "test",
    correlationId: "test-corr",
  };
}

const RETAILER_ID = "4bad894b-b73a-49f6-8e57-43a6940d19cb";

// ═══════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════

describe("webhook.receiveInventoryWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Remove signing secret by default
    delete process.env.WEBHOOK_SIGNING_SECRET;
  });

  it("updates stock for PREMIUM tier retailer", async () => {
    const db = createMockDb();
    const ctx = publicCtx(db);
    const caller = createCaller(ctx);

    db.inventorySyncConfig.findFirst.mockResolvedValue({
      id: "config-1",
      retailerId: RETAILER_ID,
      tier: "PREMIUM",
      webhookSecret: null,
    });
    db.retailerProduct.findUnique.mockResolvedValue({ id: "prod-1" });
    db.retailerProduct.update.mockResolvedValue({});
    db.inventorySyncJob.create.mockResolvedValue({});
    db.inventorySyncConfig.update.mockResolvedValue({});

    const result = await caller.webhook.receiveInventoryWebhook({
      retailerId: RETAILER_ID,
      products: [
        { sku: "SKU-001", stockQuantity: 25, priceFils: 5000 },
      ],
    });

    expect(result.updated).toBe(1);
    expect(result.notFound).toHaveLength(0);
    expect(db.retailerProduct.update).toHaveBeenCalledWith({
      where: { id: "prod-1" },
      data: { stockQuantity: 25, priceFils: 5000 },
    });
    expect(db.inventorySyncJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        retailerId: RETAILER_ID,
        status: "COMPLETED",
        productsUpdated: 1,
        productsErrored: 0,
      }),
    });
  });

  it("tracks not-found SKUs", async () => {
    const db = createMockDb();
    const ctx = publicCtx(db);
    const caller = createCaller(ctx);

    db.inventorySyncConfig.findFirst.mockResolvedValue({
      id: "config-1",
      retailerId: RETAILER_ID,
      tier: "PREMIUM",
      webhookSecret: null,
    });
    db.retailerProduct.findUnique.mockResolvedValue(null);
    db.inventorySyncJob.create.mockResolvedValue({});
    db.inventorySyncConfig.update.mockResolvedValue({});

    const result = await caller.webhook.receiveInventoryWebhook({
      retailerId: RETAILER_ID,
      products: [
        { sku: "UNKNOWN-SKU", stockQuantity: 10 },
      ],
    });

    expect(result.updated).toBe(0);
    expect(result.notFound).toEqual(["UNKNOWN-SKU"]);
  });

  it("rejects non-PREMIUM tier", async () => {
    const db = createMockDb();
    const ctx = publicCtx(db);
    const caller = createCaller(ctx);

    db.inventorySyncConfig.findFirst.mockResolvedValue({
      id: "config-1",
      retailerId: RETAILER_ID,
      tier: "BASIC",
      webhookSecret: null,
    });

    await expect(
      caller.webhook.receiveInventoryWebhook({
        retailerId: RETAILER_ID,
        products: [{ sku: "SKU-001", stockQuantity: 10 }],
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("rejects when no sync config exists", async () => {
    const db = createMockDb();
    const ctx = publicCtx(db);
    const caller = createCaller(ctx);

    db.inventorySyncConfig.findFirst.mockResolvedValue(null);

    await expect(
      caller.webhook.receiveInventoryWebhook({
        retailerId: RETAILER_ID,
        products: [{ sku: "SKU-001", stockQuantity: 10 }],
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("validates signature when webhook secret is configured", async () => {
    const db = createMockDb();

    const secret = "test-webhook-secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyObj = {
      retailerId: RETAILER_ID,
      products: [{ sku: "SKU-001", stockQuantity: 15 }],
    };
    const bodyStr = JSON.stringify(bodyObj);
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${bodyStr}`)
      .digest("hex");

    const headers = new Headers();
    headers.set("x-webhook-signature", signature);
    headers.set("x-webhook-timestamp", timestamp);

    const ctx = {
      session: null,
      headers,
      db: db as any,
      supabase: { auth: { getSession: vi.fn() } } as any,
      source: "test",
      correlationId: "test-corr",
    };

    const caller = createCaller(ctx);

    db.inventorySyncConfig.findFirst.mockResolvedValue({
      id: "config-1",
      retailerId: RETAILER_ID,
      tier: "PREMIUM",
      webhookSecret: secret,
    });
    db.retailerProduct.findUnique.mockResolvedValue({ id: "prod-1" });
    db.retailerProduct.update.mockResolvedValue({});
    db.inventorySyncJob.create.mockResolvedValue({});
    db.inventorySyncConfig.update.mockResolvedValue({});

    const result = await caller.webhook.receiveInventoryWebhook({
      retailerId: RETAILER_ID,
      products: [{ sku: "SKU-001", stockQuantity: 15 }],
    });

    expect(result.updated).toBe(1);
  });

  it("rejects invalid signature", async () => {
    const db = createMockDb();

    const secret = "test-webhook-secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const headers = new Headers();
    headers.set("x-webhook-signature", "invalid-signature");
    headers.set("x-webhook-timestamp", timestamp);

    const ctx = {
      session: null,
      headers,
      db: db as any,
      supabase: { auth: { getSession: vi.fn() } } as any,
      source: "test",
      correlationId: "test-corr",
    };

    const caller = createCaller(ctx);

    db.inventorySyncConfig.findFirst.mockResolvedValue({
      id: "config-1",
      retailerId: RETAILER_ID,
      tier: "PREMIUM",
      webhookSecret: secret,
    });

    await expect(
      caller.webhook.receiveInventoryWebhook({
        retailerId: RETAILER_ID,
        products: [{ sku: "SKU-001", stockQuantity: 10 }],
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("rejects missing signature when secret is configured", async () => {
    const db = createMockDb();
    const ctx = publicCtx(db);
    const caller = createCaller(ctx);

    db.inventorySyncConfig.findFirst.mockResolvedValue({
      id: "config-1",
      retailerId: RETAILER_ID,
      tier: "PREMIUM",
      webhookSecret: "some-secret",
    });

    await expect(
      caller.webhook.receiveInventoryWebhook({
        retailerId: RETAILER_ID,
        products: [{ sku: "SKU-001", stockQuantity: 10 }],
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("updates only stockQuantity when priceFils not provided", async () => {
    const db = createMockDb();
    const ctx = publicCtx(db);
    const caller = createCaller(ctx);

    db.inventorySyncConfig.findFirst.mockResolvedValue({
      id: "config-1",
      retailerId: RETAILER_ID,
      tier: "PREMIUM",
      webhookSecret: null,
    });
    db.retailerProduct.findUnique.mockResolvedValue({ id: "prod-1" });
    db.retailerProduct.update.mockResolvedValue({});
    db.inventorySyncJob.create.mockResolvedValue({});
    db.inventorySyncConfig.update.mockResolvedValue({});

    await caller.webhook.receiveInventoryWebhook({
      retailerId: RETAILER_ID,
      products: [{ sku: "SKU-001", stockQuantity: 50 }],
    });

    expect(db.retailerProduct.update).toHaveBeenCalledWith({
      where: { id: "prod-1" },
      data: { stockQuantity: 50 },
    });
  });
});
