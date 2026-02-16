import type { OfflineSyncPayload } from "@dubai/queue";

import { handleOfflineSync } from "./offline-sync";

// ─── Mocks ───

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

vi.mock("@dubai/db", () => ({
  prisma: {
    offlineAction: { findUnique: vi.fn(), update: vi.fn() },
    cart: { upsert: vi.fn() },
    cartItem: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    userPreference: { upsert: vi.fn() },
    project: { findFirst: vi.fn() },
    room: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("../logger", () => ({
  logger: { child: vi.fn(() => mockLog) },
}));

const { prisma } = await import("@dubai/db");

const db = prisma as unknown as {
  offlineAction: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  cart: { upsert: ReturnType<typeof vi.fn> };
  cartItem: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  userPreference: { upsert: ReturnType<typeof vi.fn> };
  project: { findFirst: ReturnType<typeof vi.fn> };
  room: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};

// ─── Helpers ───

function payload(overrides?: Partial<OfflineSyncPayload>): OfflineSyncPayload {
  return { actionId: "action-1", userId: "user-1", ...overrides };
}

// ─── Tests ───

describe("handleOfflineSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.offlineAction.update.mockResolvedValue({});
  });

  it("skips when action not found", async () => {
    db.offlineAction.findUnique.mockResolvedValue(null);

    await handleOfflineSync(payload());

    expect(mockLog.warn).toHaveBeenCalledWith("Offline action not found, skipping");
    expect(db.offlineAction.update).not.toHaveBeenCalled();
  });

  it("skips when action is not pending", async () => {
    db.offlineAction.findUnique.mockResolvedValue({
      id: "action-1",
      userId: "user-1",
      action: "add_to_cart",
      payload: {},
      status: "completed",
    });

    await handleOfflineSync(payload());

    expect(db.offlineAction.update).not.toHaveBeenCalled();
    expect(mockLog.info).toHaveBeenCalledWith(
      { status: "completed" },
      "Action not pending, skipping",
    );
  });

  it("processes add_to_cart action — creates new cart item", async () => {
    db.offlineAction.findUnique.mockResolvedValue({
      id: "action-1",
      userId: "user-1",
      action: "add_to_cart",
      payload: { productId: "prod-1", quantity: 2, priceFils: 5000 },
      status: "pending",
    });
    db.cart.upsert.mockResolvedValue({ id: "cart-1" });
    db.cartItem.findUnique.mockResolvedValue(null);
    db.cartItem.create.mockResolvedValue({});

    await handleOfflineSync(payload());

    expect(db.cart.upsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: { userId: "user-1" },
      update: {},
      select: { id: true },
    });
    expect(db.cartItem.create).toHaveBeenCalledWith({
      data: {
        cartId: "cart-1",
        productId: "prod-1",
        quantity: 2,
        priceFils: 5000,
      },
    });
    expect(db.offlineAction.update).toHaveBeenCalledWith({
      where: { id: "action-1" },
      data: expect.objectContaining({
        status: "completed",
      }),
    });
  });

  it("processes add_to_cart action — increments existing cart item", async () => {
    db.offlineAction.findUnique.mockResolvedValue({
      id: "action-1",
      userId: "user-1",
      action: "add_to_cart",
      payload: { productId: "prod-1", quantity: 3, priceFils: 5000 },
      status: "pending",
    });
    db.cart.upsert.mockResolvedValue({ id: "cart-1" });
    db.cartItem.findUnique.mockResolvedValue({ id: "item-1", quantity: 2 });
    db.cartItem.update.mockResolvedValue({});

    await handleOfflineSync(payload());

    expect(db.cartItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { quantity: 5 }, // 2 + 3
    });
  });

  it("processes update_preferences action", async () => {
    db.offlineAction.findUnique.mockResolvedValue({
      id: "action-1",
      userId: "user-1",
      action: "update_preferences",
      payload: {
        projectId: "proj-1",
        stylePreferences: ["modern", "minimalist"],
        budgetMaxFils: 100000,
        hasPets: true,
      },
      status: "pending",
    });
    db.userPreference.upsert.mockResolvedValue({});

    await handleOfflineSync(payload());

    expect(db.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId_projectId: { userId: "user-1", projectId: "proj-1" } },
      create: expect.objectContaining({
        userId: "user-1",
        projectId: "proj-1",
        stylePreferences: ["modern", "minimalist"],
        budgetMaxFils: 100000,
        hasPets: true,
      }),
      update: expect.objectContaining({
        stylePreferences: ["modern", "minimalist"],
        budgetMaxFils: 100000,
        hasPets: true,
      }),
    });

    expect(db.offlineAction.update).toHaveBeenCalledWith({
      where: { id: "action-1" },
      data: expect.objectContaining({ status: "completed" }),
    });
  });

  it("processes create_room action", async () => {
    db.offlineAction.findUnique.mockResolvedValue({
      id: "action-1",
      userId: "user-1",
      action: "create_room",
      payload: { projectId: "proj-1", name: "Living Room", type: "LIVING_ROOM" },
      status: "pending",
    });
    db.project.findFirst.mockResolvedValue({ id: "proj-1" });
    db.room.findFirst.mockResolvedValue({ orderIndex: 2 });
    db.room.create.mockResolvedValue({});

    await handleOfflineSync(payload());

    expect(db.project.findFirst).toHaveBeenCalledWith({
      where: { id: "proj-1", userId: "user-1" },
      select: { id: true },
    });
    expect(db.room.create).toHaveBeenCalledWith({
      data: {
        projectId: "proj-1",
        name: "Living Room",
        type: "LIVING_ROOM",
        orderIndex: 3,
      },
    });
    expect(db.offlineAction.update).toHaveBeenCalledWith({
      where: { id: "action-1" },
      data: expect.objectContaining({ status: "completed" }),
    });
  });

  it("marks as failed on unknown action type", async () => {
    db.offlineAction.findUnique.mockResolvedValue({
      id: "action-1",
      userId: "user-1",
      action: "delete_everything",
      payload: {},
      status: "pending",
    });

    await handleOfflineSync(payload());

    expect(db.offlineAction.update).toHaveBeenCalledWith({
      where: { id: "action-1" },
      data: expect.objectContaining({
        status: "failed",
        errorMessage: "Unknown action type: delete_everything",
      }),
    });
    expect(mockLog.warn).toHaveBeenCalledWith(
      { actionType: "delete_everything" },
      "Unknown action type",
    );
  });

  it("handles missing action payload gracefully (add_to_cart missing productId)", async () => {
    db.offlineAction.findUnique.mockResolvedValue({
      id: "action-1",
      userId: "user-1",
      action: "add_to_cart",
      payload: { quantity: 1 }, // missing productId and priceFils
      status: "pending",
    });
    db.cart.upsert.mockResolvedValue({ id: "cart-1" });

    await handleOfflineSync(payload());

    expect(db.offlineAction.update).toHaveBeenCalledWith({
      where: { id: "action-1" },
      data: expect.objectContaining({
        status: "failed",
        errorMessage: "add_to_cart requires productId and priceFils",
      }),
    });
  });
});
