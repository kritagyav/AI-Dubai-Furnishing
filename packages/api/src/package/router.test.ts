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

const mockEnqueue = vi.fn().mockResolvedValue(undefined);
const mockTrackEvent = vi.fn();

vi.mock("@dubai/queue", () => ({
  enqueue: (...args: unknown[]) => mockEnqueue(...args),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

const createCaller = createCallerFactory(appRouter);

// ─── Helpers ───

function createMockDb() {
  return {
    project: { findFirst: vi.fn() },
    room: { findFirst: vi.fn() },
    userPreference: { findFirst: vi.fn() },
    package: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    packageReview: { upsert: vi.fn() },
    cart: { upsert: vi.fn() },
    cartItem: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  };
}

function authedCtx(db: ReturnType<typeof createMockDb>) {
  db.user.findUnique.mockResolvedValue({
    id: "user-1",
    role: "USER",
    tenantId: null,
    email: "user@test.com",
    name: "Test User",
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

// ═══════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════

describe("package.generate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates package and queues job", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({
      id: "proj-1",
      name: "My Apartment",
    });
    db.userPreference.findFirst.mockResolvedValue({
      budgetMinFils: 10000,
      budgetMaxFils: 200000,
      stylePreferences: ["modern"],
    });
    db.package.create.mockResolvedValue({
      id: "pkg-1",
      status: "GENERATING",
      createdAt: new Date(),
    });

    const result = await caller.package.generate({
      projectId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
    });

    expect(result.id).toBe("pkg-1");
    expect(result.status).toBe("GENERATING");
    expect(db.package.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        projectId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
        status: "GENERATING",
        name: "AI Package for My Apartment",
      }),
      select: expect.any(Object),
    });
    expect(mockEnqueue).toHaveBeenCalledWith(
      "package.generate",
      expect.objectContaining({
        packageId: "pkg-1",
        projectId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
        userId: "user-1",
      }),
    );
  });

  it("throws NOT_FOUND when project does not exist", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue(null);

    await expect(
      caller.package.generate({
        projectId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("throws NOT_FOUND when room is not in project", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({
      id: "proj-1",
      name: "My Apartment",
    });
    db.room.findFirst.mockResolvedValue(null);

    await expect(
      caller.package.generate({
        projectId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
        roomId: "5eacbd33-8b51-4280-ac2e-f7fca2d66ee8",
      }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("package.get", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns package with items", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    const pkg = {
      id: "pkg-1",
      name: "Package 1",
      description: null,
      status: "READY",
      totalPriceFils: 150000,
      styleTag: "modern",
      generatedAt: new Date(),
      expiresAt: null,
      createdAt: new Date(),
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          quantity: 1,
          unitPriceFils: 50000,
          roomPlacement: null,
        },
      ],
      previews: [],
      reviews: [],
    };
    db.package.findFirst.mockResolvedValue(pkg);

    const result = await caller.package.get({
      packageId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
    });

    expect(result.id).toBe("pkg-1");
    expect(result.items).toHaveLength(1);
    expect(result.status).toBe("READY");
  });

  it("throws NOT_FOUND when package does not exist", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.package.findFirst.mockResolvedValue(null);

    await expect(
      caller.package.get({ packageId: "4bad894b-b73a-49f6-8e57-43a6940d19cb" }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("package.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated packages", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    const items = [
      {
        id: "pkg-1",
        name: "P1",
        status: "READY",
        totalPriceFils: 100000,
        styleTag: "modern",
        createdAt: new Date(),
        _count: { items: 3 },
      },
      {
        id: "pkg-2",
        name: "P2",
        status: "GENERATING",
        totalPriceFils: null,
        styleTag: null,
        createdAt: new Date(),
        _count: { items: 0 },
      },
    ];
    db.package.findMany.mockResolvedValue(items);

    const result = await caller.package.list({ limit: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeUndefined();
  });

  it("returns nextCursor when more items exist", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    // Return limit + 1 items (3 items for limit=2)
    const items = [
      {
        id: "pkg-1",
        name: "P1",
        status: "READY",
        totalPriceFils: 100000,
        styleTag: null,
        createdAt: new Date(),
        _count: { items: 1 },
      },
      {
        id: "pkg-2",
        name: "P2",
        status: "READY",
        totalPriceFils: 200000,
        styleTag: null,
        createdAt: new Date(),
        _count: { items: 2 },
      },
      {
        id: "pkg-3",
        name: "P3",
        status: "READY",
        totalPriceFils: 300000,
        styleTag: null,
        createdAt: new Date(),
        _count: { items: 3 },
      },
    ];
    db.package.findMany.mockResolvedValue(items);

    const result = await caller.package.list({ limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("pkg-3");
  });
});

describe("package.updateStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a READY package", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.package.findFirst.mockResolvedValue({ id: "pkg-1", status: "READY" });
    db.package.update.mockResolvedValue({ id: "pkg-1", status: "ACCEPTED" });

    const result = await caller.package.updateStatus({
      packageId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
      status: "ACCEPTED",
    });

    expect(result.status).toBe("ACCEPTED");
    expect(mockTrackEvent).toHaveBeenCalledWith("package.accepted", "user-1", {
      packageId: "pkg-1",
    });
  });

  it("rejects a READY package", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.package.findFirst.mockResolvedValue({ id: "pkg-1", status: "READY" });
    db.package.update.mockResolvedValue({ id: "pkg-1", status: "REJECTED" });

    const result = await caller.package.updateStatus({
      packageId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
      status: "REJECTED",
    });

    expect(result.status).toBe("REJECTED");
    // trackEvent is only called for ACCEPTED
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when package is not READY", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.package.findFirst.mockResolvedValue({
      id: "pkg-1",
      status: "GENERATING",
    });

    await expect(
      caller.package.updateStatus({
        packageId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
        status: "ACCEPTED",
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("throws NOT_FOUND when package does not exist", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.package.findFirst.mockResolvedValue(null);

    await expect(
      caller.package.updateStatus({
        packageId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
        status: "ACCEPTED",
      }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("package.addPackageToCart", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds accepted package items to cart", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.package.findFirst.mockResolvedValue({
      id: "pkg-1",
      items: [
        { productId: "prod-1", quantity: 1, unitPriceFils: 50000 },
        { productId: "prod-2", quantity: 2, unitPriceFils: 30000 },
      ],
    });
    db.cart.upsert.mockResolvedValue({ id: "cart-1" });
    db.cartItem.findFirst.mockResolvedValue(null);
    db.cartItem.create.mockResolvedValue({});

    const result = await caller.package.addPackageToCart({
      packageId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
    });

    expect(result.added).toBe(2);
    expect(db.cartItem.create).toHaveBeenCalledTimes(2);
  });

  it("increments quantity for existing cart items", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.package.findFirst.mockResolvedValue({
      id: "pkg-1",
      items: [{ productId: "prod-1", quantity: 2, unitPriceFils: 50000 }],
    });
    db.cart.upsert.mockResolvedValue({ id: "cart-1" });
    db.cartItem.findFirst.mockResolvedValue({ id: "item-1", quantity: 3 });
    db.cartItem.update.mockResolvedValue({});

    const result = await caller.package.addPackageToCart({
      packageId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
    });

    expect(result.added).toBe(1);
    expect(db.cartItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { quantity: 5, priceFils: 50000 },
    });
  });

  it("throws NOT_FOUND when accepted package not found", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.package.findFirst.mockResolvedValue(null);

    await expect(
      caller.package.addPackageToCart({
        packageId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
      }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("package.review", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts a package review", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.package.findFirst.mockResolvedValue({ id: "pkg-1" });
    db.packageReview.upsert.mockResolvedValue({
      id: "review-1",
      rating: 5,
      comment: "Great selection!",
    });

    const result = await caller.package.review({
      packageId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
      rating: 5,
      comment: "Great selection!",
    });

    expect(result.rating).toBe(5);
    expect(result.comment).toBe("Great selection!");
    expect(db.packageReview.upsert).toHaveBeenCalledWith({
      where: {
        packageId_userId: {
          packageId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
          userId: "user-1",
        },
      },
      create: expect.objectContaining({
        packageId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
        userId: "user-1",
        rating: 5,
        comment: "Great selection!",
      }),
      update: expect.objectContaining({
        rating: 5,
        comment: "Great selection!",
      }),
      select: expect.any(Object),
    });
  });

  it("throws NOT_FOUND when package does not exist", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.package.findFirst.mockResolvedValue(null);

    await expect(
      caller.package.review({
        packageId: "4bad894b-b73a-49f6-8e57-43a6940d19cb",
        rating: 4,
      }),
    ).rejects.toThrow(TRPCError);
  });
});
