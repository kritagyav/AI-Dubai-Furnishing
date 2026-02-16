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
    project: { findFirst: vi.fn(), update: vi.fn() },
    userPreference: { upsert: vi.fn(), findUnique: vi.fn() },
    investorPreference: { upsert: vi.fn() },
    childSafetyPreference: { upsert: vi.fn() },
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

const PROJECT_ID = "4bad894b-b73a-49f6-8e57-43a6940d19cb";

// ═══════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════

describe("preference.getPreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user preferences", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    db.userPreference.findUnique.mockResolvedValue({
      id: "pref-1",
      budgetMinFils: 10000,
      budgetMaxFils: 500000,
      familySize: 4,
      hasPets: false,
      stylePreferences: ["modern"],
      investorPreference: null,
      childSafetyPreference: null,
    });

    const result = await caller.preference.getPreferences({
      projectId: PROJECT_ID,
    });

    expect(result).toBeDefined();
    expect(result!.budgetMaxFils).toBe(500000);
    expect(result!.familySize).toBe(4);
  });

  it("returns null when no preferences exist", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    db.userPreference.findUnique.mockResolvedValue(null);

    const result = await caller.preference.getPreferences({
      projectId: PROJECT_ID,
    });

    expect(result).toBeNull();
  });

  it("throws NOT_FOUND when project does not exist", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue(null);

    await expect(
      caller.preference.getPreferences({ projectId: PROJECT_ID }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("preference.saveLifestyleQuiz", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts preferences", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    db.userPreference.upsert.mockResolvedValue({
      id: "pref-1",
      quizStep: 2,
      quizCompleted: false,
      budgetMinFils: 10000,
      budgetMaxFils: 200000,
      familySize: 3,
      childrenAges: [2, 5],
      hasPets: true,
      stylePreferences: ["minimalist"],
      updatedAt: new Date(),
    });

    const result = await caller.preference.saveLifestyleQuiz({
      projectId: PROJECT_ID,
      budgetMinFils: 10000,
      budgetMaxFils: 200000,
      familySize: 3,
      childrenAges: [2, 5],
      hasPets: true,
      stylePreferences: ["minimalist"],
      quizStep: 2,
    });

    expect(result.quizStep).toBe(2);
    expect(result.budgetMaxFils).toBe(200000);
    expect(db.userPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_projectId: { userId: "user-1", projectId: PROJECT_ID },
        },
      }),
    );
  });
});

describe("preference.setProfileType", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets profile type on project and preference", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    db.project.update.mockResolvedValue({});
    db.userPreference.upsert.mockResolvedValue({
      id: "pref-1",
      profileType: "RELOCATOR",
    });

    const result = await caller.preference.setProfileType({
      projectId: PROJECT_ID,
      profileType: "RELOCATOR",
    });

    expect(result.profileType).toBe("RELOCATOR");
    expect(db.project.update).toHaveBeenCalledWith({
      where: { id: PROJECT_ID },
      data: { profileType: "RELOCATOR" },
    });
  });
});

describe("preference.saveInvestorPreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves investor preferences when profile is AIRBNB_INVESTOR", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    db.userPreference.findUnique.mockResolvedValue({
      id: "pref-1",
      profileType: "AIRBNB_INVESTOR",
    });
    db.investorPreference.upsert.mockResolvedValue({
      id: "inv-1",
      targetDemographics: ["business_travelers"],
    });

    const result = await caller.preference.saveInvestorPreferences({
      projectId: PROJECT_ID,
      targetDemographics: ["business_travelers"],
    });

    expect(result).toBeDefined();
    expect(db.investorPreference.upsert).toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when profile type is not AIRBNB_INVESTOR", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    db.userPreference.findUnique.mockResolvedValue({
      id: "pref-1",
      profileType: "RELOCATOR",
    });

    await expect(
      caller.preference.saveInvestorPreferences({
        projectId: PROJECT_ID,
        targetDemographics: ["luxury_tourists"],
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("throws BAD_REQUEST when preference does not exist", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    db.userPreference.findUnique.mockResolvedValue(null);

    await expect(
      caller.preference.saveInvestorPreferences({
        projectId: PROJECT_ID,
        targetDemographics: ["luxury_tourists"],
      }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("preference.saveChildSafety", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves child safety preferences", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    db.userPreference.findUnique.mockResolvedValue({
      id: "pref-1",
      childrenAges: [2, 5],
    });
    db.childSafetyPreference.upsert.mockResolvedValue({
      id: "cs-1",
      hasChildren: true,
      youngestChildAge: 2,
      ageBasedProfile: "toddler",
    });

    const result = await caller.preference.saveChildSafety({
      projectId: PROJECT_ID,
      youngestChildAge: 2,
      safetyFeatures: ["ROUNDED_CORNERS", "SAFETY_LOCKS"],
    });

    expect(result.ageBasedProfile).toBe("toddler");
    expect(db.childSafetyPreference.upsert).toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when preference does not exist", async () => {
    const db = createMockDb();
    const ctx = authedCtx(db);
    const caller = createCaller(ctx);

    db.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    db.userPreference.findUnique.mockResolvedValue(null);

    await expect(
      caller.preference.saveChildSafety({
        projectId: PROJECT_ID,
        safetyFeatures: ["ROUNDED_CORNERS"],
      }),
    ).rejects.toThrow(TRPCError);
  });
});
