import type { CommissionCalculatePayload } from "@dubai/queue";

import { handleCommissionCalculate } from "./commission";

// ─── Mocks ───

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

vi.mock("@dubai/db", () => ({
  prisma: {
    order: { findUnique: vi.fn() },
    commission: { findFirst: vi.fn(), create: vi.fn() },
    retailer: { findUnique: vi.fn() },
    ledgerEntry: { create: vi.fn() },
  },
}));

vi.mock("../logger", () => ({
  logger: { child: vi.fn(() => mockLog) },
}));

// Import after mocking so the module picks up the mocked prisma
const { prisma } = await import("@dubai/db");

const db = prisma as unknown as {
  order: { findUnique: ReturnType<typeof vi.fn> };
  commission: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  retailer: { findUnique: ReturnType<typeof vi.fn> };
  ledgerEntry: { create: ReturnType<typeof vi.fn> };
};

// ─── Helpers ───

function payload(
  overrides?: Partial<CommissionCalculatePayload>,
): CommissionCalculatePayload {
  return { orderId: "order-1", ...overrides };
}

// ─── Tests ───

describe("handleCommissionCalculate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips if order not found", async () => {
    db.order.findUnique.mockResolvedValue(null);

    await handleCommissionCalculate(payload());

    expect(db.order.findUnique).toHaveBeenCalledOnce();
    expect(db.commission.create).not.toHaveBeenCalled();
    expect(mockLog.warn).toHaveBeenCalledWith("Order not found, skipping");
  });

  it("skips if order not PAID", async () => {
    db.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderRef: "ORD-001",
      status: "PENDING_PAYMENT",
      lineItems: [],
    });

    await handleCommissionCalculate(payload());

    expect(db.commission.create).not.toHaveBeenCalled();
    expect(mockLog.warn).toHaveBeenCalledWith(
      { status: "PENDING_PAYMENT" },
      "Order not in PAID status, skipping",
    );
  });

  it("calculates commission for a single retailer", async () => {
    db.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderRef: "ORD-001",
      status: "PAID",
      lineItems: [{ retailerId: "ret-1", totalFils: 100000 }],
    });
    db.commission.findFirst.mockResolvedValue(null);
    db.retailer.findUnique.mockResolvedValue({ commissionRate: 1500 });
    db.commission.create.mockResolvedValue({});
    db.ledgerEntry.create.mockResolvedValue({});

    await handleCommissionCalculate(payload());

    // 100000 * 1500 / 10000 = 15000
    expect(db.commission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        retailerId: "ret-1",
        orderId: "order-1",
        orderRef: "ORD-001",
        amountFils: 15000,
        rateBps: 1500,
        netAmountFils: 85000,
        status: "PENDING",
      }),
    });

    expect(db.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        retailerId: "ret-1",
        type: "COMMISSION",
        amountFils: 15000,
        referenceId: "order-1",
        description: "Commission for order ORD-001",
      }),
    });
  });

  it("groups line items by retailer", async () => {
    db.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderRef: "ORD-002",
      status: "PAID",
      lineItems: [
        { retailerId: "ret-1", totalFils: 50000 },
        { retailerId: "ret-1", totalFils: 30000 },
        { retailerId: "ret-2", totalFils: 20000 },
      ],
    });
    db.commission.findFirst.mockResolvedValue(null);
    db.retailer.findUnique.mockResolvedValue({ commissionRate: 1200 });
    db.commission.create.mockResolvedValue({});
    db.ledgerEntry.create.mockResolvedValue({});

    await handleCommissionCalculate(payload());

    // Two retailers => two commissions
    expect(db.commission.create).toHaveBeenCalledTimes(2);

    // ret-1: (50000+30000) * 1200 / 10000 = 9600
    expect(db.commission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        retailerId: "ret-1",
        amountFils: 9600,
        netAmountFils: 70400,
      }),
    });

    // ret-2: 20000 * 1200 / 10000 = 2400
    expect(db.commission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        retailerId: "ret-2",
        amountFils: 2400,
        netAmountFils: 17600,
      }),
    });
  });

  it("skips if commission already exists (dedup)", async () => {
    db.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderRef: "ORD-003",
      status: "PAID",
      lineItems: [{ retailerId: "ret-1", totalFils: 100000 }],
    });
    db.commission.findFirst.mockResolvedValue({ id: "existing-comm" });

    await handleCommissionCalculate(payload());

    expect(db.commission.create).not.toHaveBeenCalled();
    expect(db.ledgerEntry.create).not.toHaveBeenCalled();
    expect(mockLog.info).toHaveBeenCalledWith(
      { retailerId: "ret-1" },
      "Commission already exists, skipping",
    );
  });

  it("uses default commission rate when retailer has none", async () => {
    db.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderRef: "ORD-004",
      status: "PAID",
      lineItems: [{ retailerId: "ret-1", totalFils: 100000 }],
    });
    db.commission.findFirst.mockResolvedValue(null);
    db.retailer.findUnique.mockResolvedValue(null); // no retailer found
    db.commission.create.mockResolvedValue({});
    db.ledgerEntry.create.mockResolvedValue({});

    await handleCommissionCalculate(payload());

    // Default rate: 1200 bps => 100000 * 1200 / 10000 = 12000
    expect(db.commission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rateBps: 1200,
        amountFils: 12000,
      }),
    });
  });
});
