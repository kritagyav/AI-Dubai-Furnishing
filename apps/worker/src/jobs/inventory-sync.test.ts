import type { InventorySyncPayload } from "@dubai/queue";

import { handleInventorySync } from "./inventory-sync";

// ─── Mocks ───

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

vi.mock("@dubai/db", () => ({
  prisma: {
    inventorySyncConfig: { findUnique: vi.fn(), update: vi.fn() },
    inventorySyncJob: { create: vi.fn(), update: vi.fn() },
    retailerProduct: { findMany: vi.fn() },
  },
}));

vi.mock("../logger", () => ({
  logger: { child: vi.fn(() => mockLog) },
}));

const { prisma } = await import("@dubai/db");

const db = prisma as unknown as {
  inventorySyncConfig: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  inventorySyncJob: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  retailerProduct: { findMany: ReturnType<typeof vi.fn> };
};

// ─── Helpers ───

function payload(overrides?: Partial<InventorySyncPayload>): InventorySyncPayload {
  return {
    retailerId: "ret-1",
    configId: "config-1",
    tier: "BASIC",
    ...overrides,
  };
}

// ─── Tests ───

describe("handleInventorySync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Sensible defaults
    db.inventorySyncJob.create.mockResolvedValue({ id: "job-1" });
    db.inventorySyncJob.update.mockResolvedValue({});
    db.inventorySyncConfig.update.mockResolvedValue({});
  });

  it("skips when config not found", async () => {
    db.inventorySyncConfig.findUnique.mockResolvedValue(null);

    await handleInventorySync(payload());

    expect(db.inventorySyncJob.create).not.toHaveBeenCalled();
    expect(mockLog.warn).toHaveBeenCalledWith("Sync config not found or inactive, skipping");
  });

  it("skips when config is inactive", async () => {
    db.inventorySyncConfig.findUnique.mockResolvedValue({
      retailerId: "ret-1",
      tier: "BASIC",
      isActive: false,
      consecutiveFailures: 0,
      webhookUrl: null,
    });

    await handleInventorySync(payload());

    expect(db.inventorySyncJob.create).not.toHaveBeenCalled();
  });

  it("completes sync for BASIC tier with local query", async () => {
    db.inventorySyncConfig.findUnique.mockResolvedValue({
      retailerId: "ret-1",
      tier: "BASIC",
      isActive: true,
      consecutiveFailures: 0,
      webhookUrl: null,
    });

    const products = [
      { id: "p1", stockQuantity: 10, updatedAt: new Date() },
      { id: "p2", stockQuantity: 5, updatedAt: new Date() },
    ];
    // First findMany for BASIC local query, second for stale stock check
    db.retailerProduct.findMany
      .mockResolvedValueOnce(products)
      .mockResolvedValueOnce([]);

    await handleInventorySync(payload());

    expect(db.inventorySyncJob.create).toHaveBeenCalledOnce();
    expect(db.inventorySyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          productsUpdated: 2,
        }),
      }),
    );
    expect(db.inventorySyncConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consecutiveFailures: 0,
        }),
      }),
    );
  });

  it("attempts webhook fetch when URL configured", async () => {
    // Mock fetch globally
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "X-Response-Signature": "sig" }),
      json: () => Promise.resolve([{ sku: "A1", stock: 10 }, { sku: "A2", stock: 5 }]),
    });
    vi.stubGlobal("fetch", mockFetch);

    db.inventorySyncConfig.findUnique.mockResolvedValue({
      retailerId: "ret-1",
      tier: "BASIC",
      isActive: true,
      consecutiveFailures: 0,
      webhookUrl: "https://retailer.example.com/inventory",
    });
    db.retailerProduct.findMany.mockResolvedValue([]); // stale check

    await handleInventorySync(payload());

    expect(mockFetch).toHaveBeenCalledWith(
      "https://retailer.example.com/inventory",
      expect.objectContaining({ method: "GET" }),
    );
    expect(db.inventorySyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          productsUpdated: 2,
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it("falls back to local query when webhook fails", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    db.inventorySyncConfig.findUnique.mockResolvedValue({
      retailerId: "ret-1",
      tier: "BASIC",
      isActive: true,
      consecutiveFailures: 0,
      webhookUrl: "https://retailer.example.com/inventory",
    });

    const products = [{ id: "p1", stockQuantity: 10, updatedAt: new Date() }];
    db.retailerProduct.findMany
      .mockResolvedValueOnce(products) // fallback query
      .mockResolvedValueOnce([]); // stale check

    await handleInventorySync(payload());

    // Should fall back to local query
    expect(db.retailerProduct.findMany).toHaveBeenCalled();
    expect(db.inventorySyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          productsUpdated: 1,
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it("detects stale stock", async () => {
    db.inventorySyncConfig.findUnique.mockResolvedValue({
      retailerId: "ret-1",
      tier: "BASIC",
      isActive: true,
      consecutiveFailures: 0,
      webhookUrl: null,
    });

    const now = new Date();
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    db.retailerProduct.findMany
      .mockResolvedValueOnce([{ id: "p1", stockQuantity: 10, updatedAt: now }]) // main query
      .mockResolvedValueOnce([
        { id: "p2", sku: "STALE-SKU", name: "Old Product", updatedAt: eightDaysAgo },
      ]); // stale check

    await handleInventorySync(payload());

    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        staleCount: 1,
        staleSKUs: ["STALE-SKU"],
      }),
      "Stale stock detected: products not updated in 7+ days",
    );
  });

  it("increments failure count on error", async () => {
    db.inventorySyncConfig.findUnique.mockResolvedValue({
      retailerId: "ret-1",
      tier: "BASIC",
      isActive: true,
      consecutiveFailures: 1,
      webhookUrl: null,
    });

    db.retailerProduct.findMany.mockRejectedValue(new Error("DB error"));

    await expect(handleInventorySync(payload())).rejects.toThrow("DB error");

    expect(db.inventorySyncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: "DB error",
        }),
      }),
    );
    expect(db.inventorySyncConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consecutiveFailures: { increment: 1 },
        }),
      }),
    );
  });

  it("disables sync after 5 consecutive failures", async () => {
    db.inventorySyncConfig.findUnique.mockResolvedValue({
      retailerId: "ret-1",
      tier: "BASIC",
      isActive: true,
      consecutiveFailures: 4, // 4 previous + this one = 5
      webhookUrl: null,
    });

    db.retailerProduct.findMany.mockRejectedValue(new Error("DB error"));

    await expect(handleInventorySync(payload())).rejects.toThrow("DB error");

    // Should disable the config (third update call)
    const updateCalls = db.inventorySyncConfig.update.mock.calls;
    const disableCall = updateCalls.find(
      (call: unknown[]) =>
        (call[0] as Record<string, unknown>).data &&
        ((call[0] as Record<string, Record<string, unknown>>).data).isActive === false,
    );
    expect(disableCall).toBeDefined();
    expect(mockLog.error).toHaveBeenCalledWith("Sync disabled after 5 consecutive failures");
  });
});
