import type { PackageGeneratePayload } from "@dubai/queue";

import { handlePackageGenerate } from "./package-generate";

// ─── Mocks ───

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

vi.mock("@dubai/db", () => ({
  prisma: {
    package: { findUnique: vi.fn(), update: vi.fn() },
    userPreference: { findFirst: vi.fn() },
    retailerProduct: { findMany: vi.fn() },
    packageItem: { createMany: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

vi.mock("../logger", () => ({
  logger: { child: vi.fn(() => mockLog) },
}));

const { mockGeneratePackageRecommendation } = vi.hoisted(() => {
  return { mockGeneratePackageRecommendation: vi.fn() };
});

vi.mock("@dubai/ai-client", () => {
  return {
    AIClient: class MockAIClient {
      generatePackageRecommendation = mockGeneratePackageRecommendation;
    },
  };
});

const { prisma } = await import("@dubai/db");

const db = prisma as unknown as {
  package: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  userPreference: { findFirst: ReturnType<typeof vi.fn> };
  retailerProduct: { findMany: ReturnType<typeof vi.fn> };
  packageItem: { createMany: ReturnType<typeof vi.fn> };
  notification: { create: ReturnType<typeof vi.fn> };
};

// ─── Helpers ───

function payload(
  overrides?: Partial<PackageGeneratePayload>,
): PackageGeneratePayload {
  return {
    packageId: "pkg-1",
    projectId: "proj-1",
    userId: "user-1",
    ...overrides,
  };
}

// ─── Tests ───

describe("handlePackageGenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.package.update.mockResolvedValue({});
    db.packageItem.createMany.mockResolvedValue({});
    db.notification.create.mockResolvedValue({});
  });

  it("skips when package not found", async () => {
    db.package.findUnique.mockResolvedValue(null);

    await handlePackageGenerate(payload());

    expect(mockLog.warn).toHaveBeenCalledWith("Package not found, skipping");
    expect(db.retailerProduct.findMany).not.toHaveBeenCalled();
  });

  it("skips when package not in GENERATING state", async () => {
    db.package.findUnique.mockResolvedValue({
      id: "pkg-1",
      status: "READY",
      projectId: "proj-1",
    });

    await handlePackageGenerate(payload());

    expect(mockLog.warn).toHaveBeenCalledWith(
      { status: "READY" },
      "Package not in GENERATING state, skipping",
    );
  });

  it("generates package with matching products", async () => {
    db.package.findUnique.mockResolvedValue({
      id: "pkg-1",
      status: "GENERATING",
      projectId: "proj-1",
    });
    db.userPreference.findFirst.mockResolvedValue({
      budgetMinFils: 10000,
      budgetMaxFils: 200000,
      stylePreferences: ["modern"],
    });

    const rawProducts = [
      {
        id: "prod-1",
        name: "Modern Sofa",
        priceFils: 50000,
        category: "SOFA",
        materials: ["fabric"],
        colors: ["grey"],
        stockQuantity: 5,
      },
      {
        id: "prod-2",
        name: "Coffee Table",
        priceFils: 20000,
        category: "TABLE",
        materials: ["wood"],
        colors: ["oak"],
        stockQuantity: 10,
      },
    ];
    db.retailerProduct.findMany.mockResolvedValue(rawProducts);

    mockGeneratePackageRecommendation.mockResolvedValue({
      selectedProducts: [
        { productId: "prod-1", quantity: 1, reasoning: "Matches modern style" },
        { productId: "prod-2", quantity: 1, reasoning: "Complements sofa" },
      ],
      totalPriceFils: 70000,
      packageReasoning: "Modern living room set",
      source: "ai",
    });

    await handlePackageGenerate(payload());

    expect(db.packageItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          packageId: "pkg-1",
          productId: "prod-1",
          quantity: 1,
          unitPriceFils: 50000,
        },
        {
          packageId: "pkg-1",
          productId: "prod-2",
          quantity: 1,
          unitPriceFils: 20000,
        },
      ],
    });

    expect(db.package.update).toHaveBeenCalledWith({
      where: { id: "pkg-1" },
      data: expect.objectContaining({
        status: "READY",
        totalPriceFils: 70000,
        aiModelVersion: "ai-v1",
      }),
    });

    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        type: "PACKAGE_READY",
      }),
    });
  });

  it("handles no matching products", async () => {
    db.package.findUnique.mockResolvedValue({
      id: "pkg-1",
      status: "GENERATING",
      projectId: "proj-1",
    });
    db.userPreference.findFirst.mockResolvedValue(null);
    db.retailerProduct.findMany.mockResolvedValue([]);

    await handlePackageGenerate(payload());

    expect(db.package.update).toHaveBeenCalledWith({
      where: { id: "pkg-1" },
      data: { status: "EXPIRED" },
    });
    expect(mockLog.warn).toHaveBeenCalledWith(
      "No matching products found, marking package as expired",
    );
    expect(db.packageItem.createMany).not.toHaveBeenCalled();
  });

  it("marks package as EXPIRED when AI returns no selections", async () => {
    db.package.findUnique.mockResolvedValue({
      id: "pkg-1",
      status: "GENERATING",
      projectId: "proj-1",
    });
    db.userPreference.findFirst.mockResolvedValue(null);
    db.retailerProduct.findMany.mockResolvedValue([
      {
        id: "prod-1",
        name: "Sofa",
        priceFils: 50000,
        category: "SOFA",
        materials: null,
        colors: null,
        stockQuantity: 5,
      },
    ]);
    mockGeneratePackageRecommendation.mockResolvedValue({
      selectedProducts: [],
      totalPriceFils: 0,
      packageReasoning: "No suitable match",
      source: "fallback",
    });

    await handlePackageGenerate(payload());

    expect(db.package.update).toHaveBeenCalledWith({
      where: { id: "pkg-1" },
      data: { status: "EXPIRED" },
    });
  });

  it("sets fallback model version when AI falls back", async () => {
    db.package.findUnique.mockResolvedValue({
      id: "pkg-1",
      status: "GENERATING",
      projectId: "proj-1",
    });
    db.userPreference.findFirst.mockResolvedValue(null);
    db.retailerProduct.findMany.mockResolvedValue([
      {
        id: "prod-1",
        name: "Chair",
        priceFils: 30000,
        category: "CHAIR",
        materials: [],
        colors: [],
        stockQuantity: 3,
      },
    ]);
    mockGeneratePackageRecommendation.mockResolvedValue({
      selectedProducts: [
        { productId: "prod-1", quantity: 1, reasoning: "Fallback" },
      ],
      totalPriceFils: 30000,
      packageReasoning: "Basic selection",
      source: "fallback",
    });

    await handlePackageGenerate(payload());

    expect(db.package.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aiModelVersion: "fallback-v1",
        }),
      }),
    );
  });

  it("marks package as expired on error", async () => {
    db.package.findUnique.mockResolvedValue({
      id: "pkg-1",
      status: "GENERATING",
      projectId: "proj-1",
    });
    db.userPreference.findFirst.mockResolvedValue(null);
    db.retailerProduct.findMany.mockRejectedValue(new Error("DB failure"));

    await handlePackageGenerate(payload());

    expect(db.package.update).toHaveBeenCalledWith({
      where: { id: "pkg-1" },
      data: { status: "EXPIRED" },
    });
    expect(mockLog.error).toHaveBeenCalled();
  });
});
