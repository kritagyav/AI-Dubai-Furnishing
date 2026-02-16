import type { NotificationSendPayload } from "@dubai/queue";

import { handleNotificationSend } from "./notification";

// ─── Mocks ───

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

vi.mock("@dubai/db", () => ({
  prisma: {
    notification: { create: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("../logger", () => ({
  logger: { child: vi.fn(() => mockLog) },
}));

const mockSendTransactional = vi.fn();
const mockSendReEngagement = vi.fn();

vi.mock("@dubai/email", () => ({
  emailClient: {
    sendTransactional: (...args: unknown[]) => mockSendTransactional(...args),
    sendReEngagement: (...args: unknown[]) => mockSendReEngagement(...args),
  },
}));

const { prisma } = await import("@dubai/db");

const db = prisma as unknown as {
  notification: { create: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
};

// ─── Helpers ───

function payload(overrides?: Partial<NotificationSendPayload>): NotificationSendPayload {
  return {
    userId: "user-1",
    type: "SYSTEM",
    title: "Test Title",
    body: "Test Body",
    ...overrides,
  };
}

// ─── Tests ───

describe("handleNotificationSend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.notification.create.mockResolvedValue({});
  });

  it("creates in-app notification", async () => {
    await handleNotificationSend(payload());

    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        type: "SYSTEM",
        channel: "IN_APP",
        title: "Test Title",
        body: "Test Body",
      }),
    });
  });

  it("sends email for ORDER_UPDATE type", async () => {
    db.user.findUnique.mockResolvedValue({ email: "user@test.com", name: "Test User" });
    mockSendTransactional.mockResolvedValue({ success: true, id: "email-1" });

    await handleNotificationSend(
      payload({ type: "ORDER_UPDATE", title: "Order Shipped", body: "Your order is on its way" }),
    );

    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: "EMAIL",
        type: "ORDER_UPDATE",
      }),
    });

    expect(mockSendTransactional).toHaveBeenCalledWith(
      "user@test.com",
      "Order Shipped",
      "Your order is on its way",
    );
  });

  it("sends email for DELIVERY_UPDATE type", async () => {
    db.user.findUnique.mockResolvedValue({ email: "user@test.com", name: "Test User" });
    mockSendTransactional.mockResolvedValue({ success: true, id: "email-2" });

    await handleNotificationSend(payload({ type: "DELIVERY_UPDATE" }));

    expect(mockSendTransactional).toHaveBeenCalled();
  });

  it("sends re-engagement email for PROMOTION type", async () => {
    db.user.findUnique.mockResolvedValue({ email: "user@test.com", name: "Test User" });
    mockSendReEngagement.mockResolvedValue({ success: true, id: "email-3" });

    await handleNotificationSend(
      payload({
        type: "PROMOTION",
        data: { step: 2, cartItems: [{ name: "Chair", priceFils: 5000 }] },
      }),
    );

    expect(mockSendReEngagement).toHaveBeenCalledWith(
      "user@test.com",
      "Test User",
      2,
      [{ name: "Chair", priceFils: 5000 }],
    );
  });

  it("handles missing user gracefully", async () => {
    db.user.findUnique.mockResolvedValue(null);

    await handleNotificationSend(payload({ type: "ORDER_UPDATE" }));

    // Notification record is still created
    expect(db.notification.create).toHaveBeenCalledOnce();
    // But no email is sent
    expect(mockSendTransactional).not.toHaveBeenCalled();
    expect(mockLog.warn).toHaveBeenCalledWith(
      "User not found for email delivery — skipping email",
    );
  });

  it("does not fail job if email send fails", async () => {
    db.user.findUnique.mockResolvedValue({ email: "user@test.com", name: "Test User" });
    mockSendTransactional.mockRejectedValue(new Error("SMTP down"));

    // Should not throw
    await expect(
      handleNotificationSend(payload({ type: "ORDER_UPDATE" })),
    ).resolves.toBeUndefined();

    expect(db.notification.create).toHaveBeenCalledOnce();
    expect(mockLog.error).toHaveBeenCalledWith(
      { error: "SMTP down" },
      "Email delivery failed — notification record created but email not sent",
    );
  });

  it("does not send email for SYSTEM type", async () => {
    await handleNotificationSend(payload({ type: "SYSTEM" }));

    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(mockSendTransactional).not.toHaveBeenCalled();
  });

  it("does not send email for SURVEY type", async () => {
    await handleNotificationSend(payload({ type: "SURVEY" }));

    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(mockSendTransactional).not.toHaveBeenCalled();
  });

  it("logs error when transactional email returns failure", async () => {
    db.user.findUnique.mockResolvedValue({ email: "user@test.com", name: "Test User" });
    mockSendTransactional.mockResolvedValue({ success: false, error: "Bounce" });

    await handleNotificationSend(payload({ type: "PACKAGE_READY" }));

    expect(mockLog.error).toHaveBeenCalledWith(
      { error: "Bounce" },
      "Failed to send transactional email",
    );
  });
});
