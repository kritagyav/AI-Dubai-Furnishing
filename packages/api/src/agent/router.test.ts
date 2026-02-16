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
    agentPartner: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    referral: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    order: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
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

function adminCtx(db: ReturnType<typeof createMockDb>) {
  db.user.findUnique.mockResolvedValue({
    id: "admin-1",
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

const AGENT_ID = "4bad894b-b73a-49f6-8e57-43a6940d19cb";
const ORDER_ID = "5eacbd33-8b51-4280-ac2e-f7fca2d66ee8";

// ═══════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════

describe("agent.register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registers an agent partner", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.agentPartner.findUnique.mockResolvedValue(null);
    db.agentPartner.create.mockResolvedValue({
      id: AGENT_ID,
      userId: "user-1",
      companyName: "Agent Co",
      licenseNumber: "LIC-123",
      commissionRate: 500,
      status: "PENDING",
      createdAt: new Date(),
    });

    const result = await caller.agent.register({
      companyName: "Agent Co",
      licenseNumber: "LIC-123",
    });

    expect(result.id).toBe(AGENT_ID);
    expect(result.companyName).toBe("Agent Co");
    expect(result.status).toBe("PENDING");
  });

  it("throws CONFLICT when user is already registered as agent", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.agentPartner.findUnique.mockResolvedValue({ id: AGENT_ID });

    await expect(
      caller.agent.register({ companyName: "New Co" }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("agent.createReferralCode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates a unique referral code", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.agentPartner.findUnique.mockResolvedValue({
      id: AGENT_ID,
      status: "ACTIVE",
    });
    db.referral.create.mockResolvedValue({
      id: "ref-1",
      referralCode: "REF-ABCD1234",
      createdAt: new Date(),
    });

    const result = await caller.agent.createReferralCode();

    expect(result.referralCode).toMatch(/^REF-/);
    expect(db.referral.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentId: AGENT_ID,
        referralCode: expect.stringMatching(/^REF-[A-Z0-9]{8}$/),
      }),
      select: expect.any(Object),
    });
  });

  it("throws NOT_FOUND when agent not registered", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.agentPartner.findUnique.mockResolvedValue(null);

    await expect(caller.agent.createReferralCode()).rejects.toThrow(TRPCError);
  });

  it("throws FORBIDDEN when agent is not ACTIVE", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.agentPartner.findUnique.mockResolvedValue({
      id: AGENT_ID,
      status: "PENDING",
    });

    await expect(caller.agent.createReferralCode()).rejects.toThrow(TRPCError);
  });
});

describe("agent.convertReferral", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calculates commission and converts referral", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.referral.findUnique.mockResolvedValue({
      id: "ref-1",
      convertedAt: null,
      agent: { id: AGENT_ID, userId: "agent-user-1", commissionRate: 500 },
    });
    db.order.findUnique.mockResolvedValue({
      id: ORDER_ID,
      totalFils: 1000000, // 10,000 AED
    });

    // Mock $transaction to execute the callback
    db.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
      const tx = {
        referral: { update: vi.fn().mockResolvedValue({
          id: "ref-1",
          referralCode: "REF-ABCD1234",
          orderId: ORDER_ID,
          commissionFils: 50000,
          convertedAt: new Date(),
        }) },
        agentPartner: { update: vi.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    const result = await caller.agent.convertReferral({
      referralCode: "REF-ABCD1234",
      orderId: ORDER_ID,
    });

    expect(result.commissionFils).toBe(50000); // 1000000 * 500 / 10000
    expect(result.orderId).toBe(ORDER_ID);
  });

  it("throws NOT_FOUND when referral code does not exist", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.referral.findUnique.mockResolvedValue(null);

    await expect(
      caller.agent.convertReferral({
        referralCode: "REF-NONEXIST",
        orderId: ORDER_ID,
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("throws BAD_REQUEST when referral already converted", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.referral.findUnique.mockResolvedValue({
      id: "ref-1",
      convertedAt: new Date(),
      agent: { id: AGENT_ID, userId: "agent-user-1", commissionRate: 500 },
    });

    await expect(
      caller.agent.convertReferral({
        referralCode: "REF-ABCD1234",
        orderId: ORDER_ID,
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("throws NOT_FOUND when order does not exist", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.referral.findUnique.mockResolvedValue({
      id: "ref-1",
      convertedAt: null,
      agent: { id: AGENT_ID, userId: "agent-user-1", commissionRate: 500 },
    });
    db.order.findUnique.mockResolvedValue(null);

    await expect(
      caller.agent.convertReferral({
        referralCode: "REF-ABCD1234",
        orderId: ORDER_ID,
      }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("agent.updateStatus (admin)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("changes agent status", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.agentPartner.findUnique.mockResolvedValue({ id: AGENT_ID });
    db.agentPartner.update.mockResolvedValue({
      id: AGENT_ID,
      companyName: "Agent Co",
      status: "ACTIVE",
      updatedAt: new Date(),
    });

    const result = await caller.agent.updateStatus({
      agentId: AGENT_ID,
      status: "ACTIVE",
    });

    expect(result.status).toBe("ACTIVE");
    expect(db.agentPartner.update).toHaveBeenCalledWith({
      where: { id: AGENT_ID },
      data: { status: "ACTIVE" },
      select: expect.any(Object),
    });
  });

  it("throws NOT_FOUND when agent does not exist", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.agentPartner.findUnique.mockResolvedValue(null);

    await expect(
      caller.agent.updateStatus({ agentId: AGENT_ID, status: "SUSPENDED" }),
    ).rejects.toThrow(TRPCError);
  });

  it("rejects non-admin users", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db); // regular user
    const caller = createCaller(ctx);

    await expect(
      caller.agent.updateStatus({ agentId: AGENT_ID, status: "ACTIVE" }),
    ).rejects.toThrow(TRPCError);
  });
});
