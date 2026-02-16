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

const createCaller = createCallerFactory(appRouter);

// ─── Helpers ───

function createMockDb() {
  return {
    corporateAccount: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    corporateEmployee: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
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

const ACCOUNT_ID = "4bad894b-b73a-49f6-8e57-43a6940d19cb";
const USER_ID = "5eacbd33-8b51-4280-ac2e-f7fca2d66ee8";
const EMPLOYEE_ID = "0c6a2996-5eba-44d2-be0d-4cd7e10df275";

// ═══════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════

describe("corporate.createAccount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a corporate account", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.corporateAccount.create.mockResolvedValue({
      id: ACCOUNT_ID,
      tenantId: "tenant-1",
      companyName: "Acme Corp",
      contactEmail: "corp@acme.com",
      contactPhone: "+9711234567",
      maxEmployees: 50,
      discountBps: 500,
      isActive: true,
      createdAt: new Date(),
    });

    const result = await caller.corporate.createAccount({
      companyName: "Acme Corp",
      contactEmail: "corp@acme.com",
      contactPhone: "+9711234567",
      maxEmployees: 50,
      discountBps: 500,
    });

    expect(result.companyName).toBe("Acme Corp");
    expect(result.maxEmployees).toBe(50);
    expect(result.isActive).toBe(true);
    expect(db.corporateAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyName: "Acme Corp",
        contactEmail: "corp@acme.com",
        maxEmployees: 50,
        discountBps: 500,
      }),
      select: expect.any(Object),
    });
  });
});

describe("corporate.addEmployee", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds employee to corporate account", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.corporateAccount.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      maxEmployees: 50,
      _count: { employees: 10 },
    });
    db.corporateEmployee.create.mockResolvedValue({
      id: EMPLOYEE_ID,
      corporateId: ACCOUNT_ID,
      userId: USER_ID,
      employeeRef: "EMP-001",
      createdAt: new Date(),
    });

    const result = await caller.corporate.addEmployee({
      accountId: ACCOUNT_ID,
      userId: USER_ID,
      employeeRef: "EMP-001",
    });

    expect(result.userId).toBe(USER_ID);
    expect(result.employeeRef).toBe("EMP-001");
  });

  it("enforces maxEmployees limit", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.corporateAccount.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      maxEmployees: 5,
      _count: { employees: 5 },
    });

    await expect(
      caller.corporate.addEmployee({
        accountId: ACCOUNT_ID,
        userId: USER_ID,
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("throws NOT_FOUND when account does not exist", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.corporateAccount.findUnique.mockResolvedValue(null);

    await expect(
      caller.corporate.addEmployee({
        accountId: ACCOUNT_ID,
        userId: USER_ID,
      }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("corporate.removeEmployee", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes an employee", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.corporateEmployee.findUnique.mockResolvedValue({ id: EMPLOYEE_ID });
    db.corporateEmployee.delete.mockResolvedValue({});

    const result = await caller.corporate.removeEmployee({
      employeeId: EMPLOYEE_ID,
    });

    expect(result.success).toBe(true);
    expect(db.corporateEmployee.delete).toHaveBeenCalledWith({
      where: { id: EMPLOYEE_ID },
    });
  });

  it("throws NOT_FOUND when employee does not exist", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.corporateEmployee.findUnique.mockResolvedValue(null);

    await expect(
      caller.corporate.removeEmployee({ employeeId: EMPLOYEE_ID }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("corporate.toggleAccount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("flips isActive from true to false", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.corporateAccount.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      isActive: true,
    });
    db.corporateAccount.update.mockResolvedValue({
      id: ACCOUNT_ID,
      companyName: "Acme Corp",
      isActive: false,
      updatedAt: new Date(),
    });

    const result = await caller.corporate.toggleAccount({
      accountId: ACCOUNT_ID,
    });

    expect(result.isActive).toBe(false);
    expect(db.corporateAccount.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID },
      data: { isActive: false },
      select: expect.any(Object),
    });
  });

  it("flips isActive from false to true", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.corporateAccount.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      isActive: false,
    });
    db.corporateAccount.update.mockResolvedValue({
      id: ACCOUNT_ID,
      companyName: "Acme Corp",
      isActive: true,
      updatedAt: new Date(),
    });

    const result = await caller.corporate.toggleAccount({
      accountId: ACCOUNT_ID,
    });

    expect(result.isActive).toBe(true);
    expect(db.corporateAccount.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID },
      data: { isActive: true },
      select: expect.any(Object),
    });
  });

  it("throws NOT_FOUND when account does not exist", async () => {
    const db = createMockDb();
    const ctx = adminCtx(db);
    const caller = createCaller(ctx);

    db.corporateAccount.findUnique.mockResolvedValue(null);

    await expect(
      caller.corporate.toggleAccount({ accountId: ACCOUNT_ID }),
    ).rejects.toThrow(TRPCError);
  });
});
