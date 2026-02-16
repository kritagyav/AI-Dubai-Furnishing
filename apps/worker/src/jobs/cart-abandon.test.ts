import type { CartAbandonCheckPayload } from "@dubai/queue";

import { handleCartAbandonCheck } from "./cart-abandon";

// ─── Mocks ───

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

vi.mock("@dubai/db", () => ({
  prisma: {
    cart: { findUnique: vi.fn() },
    abandonedCart: { create: vi.fn() },
    reEngagementSequence: { create: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

vi.mock("../logger", () => ({
  logger: { child: vi.fn(() => mockLog) },
}));

const { prisma } = await import("@dubai/db");

const db = prisma as unknown as {
  cart: { findUnique: ReturnType<typeof vi.fn> };
  abandonedCart: { create: ReturnType<typeof vi.fn> };
  reEngagementSequence: { create: ReturnType<typeof vi.fn> };
  notification: { create: ReturnType<typeof vi.fn> };
};

// ─── Helpers ───

function payload(overrides?: Partial<CartAbandonCheckPayload>): CartAbandonCheckPayload {
  return { userId: "user-1", cartId: "cart-1", ...overrides };
}

// ─── Tests ───

describe("handleCartAbandonCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.abandonedCart.create.mockResolvedValue({});
    db.reEngagementSequence.create.mockResolvedValue({});
    db.notification.create.mockResolvedValue({});
  });

  it("sends notification for abandoned cart", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    db.cart.findUnique.mockResolvedValue({
      id: "cart-1",
      userId: "user-1",
      updatedAt: threeHoursAgo,
      items: [
        { productId: "prod-1", quantity: 2, priceFils: 5000 },
        { productId: "prod-2", quantity: 1, priceFils: 10000 },
      ],
    });

    await handleCartAbandonCheck(payload());

    expect(db.abandonedCart.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        totalFils: 20000, // 2*5000 + 1*10000
      }),
    });

    expect(db.reEngagementSequence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        trigger: "cart_abandoned",
        status: "ACTIVE",
        totalSteps: 3,
      }),
    });

    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        type: "SYSTEM",
        channel: "IN_APP",
        title: "You left items in your cart",
        body: "Complete your order before items sell out!",
        data: { cartId: "cart-1", totalFils: 20000 },
      }),
    });
  });

  it("skips if cart is not found", async () => {
    db.cart.findUnique.mockResolvedValue(null);

    await handleCartAbandonCheck(payload());

    expect(db.abandonedCart.create).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
    expect(mockLog.info).toHaveBeenCalledWith("Cart empty or not found, skipping");
  });

  it("skips if cart is empty", async () => {
    db.cart.findUnique.mockResolvedValue({
      id: "cart-1",
      userId: "user-1",
      updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      items: [],
    });

    await handleCartAbandonCheck(payload());

    expect(db.abandonedCart.create).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
    expect(mockLog.info).toHaveBeenCalledWith("Cart empty or not found, skipping");
  });

  it("skips if user recently active", async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    db.cart.findUnique.mockResolvedValue({
      id: "cart-1",
      userId: "user-1",
      updatedAt: thirtyMinutesAgo,
      items: [{ productId: "prod-1", quantity: 1, priceFils: 5000 }],
    });

    await handleCartAbandonCheck(payload());

    expect(db.abandonedCart.create).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
    expect(mockLog.info).toHaveBeenCalledWith("Cart recently active, not abandoned");
  });
});
