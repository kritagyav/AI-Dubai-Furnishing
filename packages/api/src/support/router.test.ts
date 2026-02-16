import { vi } from "vitest";
import { TRPCError } from "@trpc/server";

// ─── Mock external dependencies ───

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

// ─── Imports ───

import { appRouter } from "../root";
import { createCallerFactory } from "../trpc";

const createCaller = createCallerFactory(appRouter);

// ─── Helpers ───

function createMockDb() {
  return {
    supportTicket: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    ticketMessage: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };
}

function authedUserCtx(db: ReturnType<typeof createMockDb>) {
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

function supportAgentCtx(db: ReturnType<typeof createMockDb>) {
  db.user.findUnique.mockResolvedValue({
    id: "agent-1",
    role: "SUPPORT_AGENT",
    tenantId: null,
    email: "agent@test.com",
    name: "Agent User",
  });

  return {
    session: { user: { id: "supabase-agent-1" } },
    headers: new Headers(),
    db: db as any,
    supabase: { auth: { getSession: vi.fn() } } as any,
    source: "test",
    correlationId: "test-corr",
  };
}

function platformAdminCtx(db: ReturnType<typeof createMockDb>) {
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

function unauthCtx(db: ReturnType<typeof createMockDb>) {
  return {
    session: null,
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

describe("support.create", () => {
  it("creates a ticket with category and priority", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    const mockTicket = {
      id: "ticket-1",
      ticketRef: "TK-001",
      category: "ORDER_ISSUE",
      priority: "HIGH",
      status: "OPEN",
      subject: "My order is late",
      createdAt: new Date(),
    };
    db.supportTicket.create.mockResolvedValue(mockTicket);

    const result = await caller.support.create({
      category: "ORDER_ISSUE",
      subject: "My order is late",
      description: "I ordered 3 days ago and it has not arrived yet.",
      priority: "HIGH",
    });

    expect(result.id).toBe("ticket-1");
    expect(result.category).toBe("ORDER_ISSUE");
    expect(result.priority).toBe("HIGH");
    expect(result.status).toBe("OPEN");
  });

  it("creates a ticket with default priority", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.create.mockResolvedValue({
      id: "ticket-2",
      ticketRef: "TK-002",
      category: "GENERAL_INQUIRY",
      priority: "MEDIUM",
      status: "OPEN",
      subject: "Question",
      createdAt: new Date(),
    });

    const result = await caller.support.create({
      category: "GENERAL_INQUIRY",
      subject: "Question",
      description: "How do I return an item?",
    });

    expect(result.priority).toBe("MEDIUM");
  });

  it("creates a ticket with orderId", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.create.mockResolvedValue({
      id: "ticket-3",
      ticketRef: "TK-003",
      category: "DELIVERY_ISSUE",
      priority: "URGENT",
      status: "OPEN",
      subject: "Wrong item",
      createdAt: new Date(),
    });

    const result = await caller.support.create({
      category: "DELIVERY_ISSUE",
      subject: "Wrong item",
      description: "Received wrong item.",
      priority: "URGENT",
      orderId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });

    expect(result.id).toBe("ticket-3");
    expect(db.supportTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        }),
      }),
    );
  });

  it("rejects unauthenticated users", async () => {
    const db = createMockDb();
    const ctx = unauthCtx(db);
    const caller = createCaller(ctx);

    await expect(
      caller.support.create({
        category: "GENERAL_INQUIRY",
        subject: "Help",
        description: "Need help.",
      }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("support.listMine", () => {
  it("returns user's tickets paginated", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findMany.mockResolvedValue([
      {
        id: "t-1",
        ticketRef: "TK-001",
        category: "ORDER_ISSUE",
        priority: "HIGH",
        status: "OPEN",
        subject: "Issue",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await caller.support.listMine({ limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeUndefined();
  });

  it("filters by status", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findMany.mockResolvedValue([]);

    await caller.support.listMine({ limit: 20, status: "RESOLVED" });

    expect(db.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          status: "RESOLVED",
        }),
      }),
    );
  });

  it("returns nextCursor when more items exist", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    const items = Array.from({ length: 3 }, (_, i) => ({
      id: `t-${i}`,
      ticketRef: `TK-${i}`,
      category: "OTHER",
      priority: "LOW",
      status: "OPEN",
      subject: `Ticket ${i}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    db.supportTicket.findMany.mockResolvedValue(items);

    const result = await caller.support.listMine({ limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("t-2");
  });
});

describe("support.get", () => {
  it("returns ticket with messages", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findFirst.mockResolvedValue({
      id: "t-1",
      ticketRef: "TK-001",
      category: "ORDER_ISSUE",
      priority: "HIGH",
      status: "OPEN",
      subject: "Issue",
      description: "Detailed description",
      orderId: null,
      attachments: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [
        {
          id: "m-1",
          senderId: "user-1",
          senderRole: "customer",
          body: "Hello",
          attachments: null,
          createdAt: new Date(),
        },
      ],
    });

    const result = await caller.support.get({
      ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });

    expect(result.id).toBe("t-1");
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]!.body).toBe("Hello");
  });

  it("throws NOT_FOUND if ticket does not belong to user", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findFirst.mockResolvedValue(null);

    await expect(
      caller.support.get({ ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }),
    ).rejects.toThrow("Ticket not found");
  });
});

describe("support.addMessage", () => {
  it("adds message to an open ticket", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findFirst.mockResolvedValue({ id: "t-1", status: "OPEN" });
    db.ticketMessage.create.mockResolvedValue({
      id: "m-1",
      senderRole: "customer",
      body: "Follow up message",
      createdAt: new Date(),
    });

    const result = await caller.support.addMessage({
      ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      body: "Follow up message",
    });

    expect(result.id).toBe("m-1");
    expect(result.senderRole).toBe("customer");
  });

  it("re-opens ticket if status was WAITING_ON_CUSTOMER", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findFirst.mockResolvedValue({ id: "t-1", status: "WAITING_ON_CUSTOMER" });
    db.ticketMessage.create.mockResolvedValue({
      id: "m-2",
      senderRole: "customer",
      body: "Response",
      createdAt: new Date(),
    });
    db.supportTicket.update.mockResolvedValue({});

    await caller.support.addMessage({
      ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      body: "Response",
    });

    expect(db.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "IN_PROGRESS" },
      }),
    );
  });

  it("rejects adding message to a closed ticket", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findFirst.mockResolvedValue({ id: "t-1", status: "CLOSED" });

    await expect(
      caller.support.addMessage({
        ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        body: "Try to add message",
      }),
    ).rejects.toThrow("Cannot add messages to a closed ticket");
  });

  it("throws NOT_FOUND for non-existent ticket", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findFirst.mockResolvedValue(null);

    await expect(
      caller.support.addMessage({
        ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        body: "Hello",
      }),
    ).rejects.toThrow("Ticket not found");
  });
});

describe("support.reply (support agent)", () => {
  it("admin replies to ticket", async () => {
    const db = createMockDb();
    const ctx = platformAdminCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findUnique.mockResolvedValue({ id: "t-1", status: "IN_PROGRESS" });
    db.ticketMessage.create.mockResolvedValue({
      id: "m-3",
      senderRole: "support",
      body: "We are looking into this.",
      createdAt: new Date(),
    });
    db.supportTicket.update.mockResolvedValue({});

    const result = await caller.support.reply({
      ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      body: "We are looking into this.",
    });

    expect(result.senderRole).toBe("support");
  });

  it("auto-sets status to WAITING_ON_CUSTOMER when replying to IN_PROGRESS ticket", async () => {
    const db = createMockDb();
    const ctx = supportAgentCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findUnique.mockResolvedValue({ id: "t-1", status: "IN_PROGRESS" });
    db.ticketMessage.create.mockResolvedValue({
      id: "m-4",
      senderRole: "support",
      body: "Please provide more info.",
      createdAt: new Date(),
    });
    db.supportTicket.update.mockResolvedValue({});

    await caller.support.reply({
      ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      body: "Please provide more info.",
    });

    expect(db.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "WAITING_ON_CUSTOMER" },
      }),
    );
  });

  it("auto-sets status to WAITING_ON_CUSTOMER when replying to OPEN ticket", async () => {
    const db = createMockDb();
    const ctx = supportAgentCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findUnique.mockResolvedValue({ id: "t-1", status: "OPEN" });
    db.ticketMessage.create.mockResolvedValue({
      id: "m-5",
      senderRole: "support",
      body: "Hi there",
      createdAt: new Date(),
    });
    db.supportTicket.update.mockResolvedValue({});

    await caller.support.reply({
      ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      body: "Hi there",
    });

    expect(db.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "WAITING_ON_CUSTOMER" },
      }),
    );
  });

  it("throws NOT_FOUND for non-existent ticket", async () => {
    const db = createMockDb();
    const ctx = supportAgentCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findUnique.mockResolvedValue(null);

    await expect(
      caller.support.reply({
        ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        body: "Reply",
      }),
    ).rejects.toThrow("Ticket not found");
  });

  it("rejects non-support users", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    await expect(
      caller.support.reply({
        ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        body: "Reply",
      }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("support.updateStatus", () => {
  it("changes ticket status to RESOLVED", async () => {
    const db = createMockDb();
    const ctx = supportAgentCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findUnique.mockResolvedValue({ id: "t-1" });
    db.supportTicket.update.mockResolvedValue({
      id: "t-1",
      status: "RESOLVED",
      resolvedAt: new Date(),
      closedAt: null,
    });

    const result = await caller.support.updateStatus({
      ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      status: "RESOLVED",
    });

    expect(result.status).toBe("RESOLVED");
    expect(result.resolvedAt).not.toBeNull();
  });

  it("changes ticket status to CLOSED", async () => {
    const db = createMockDb();
    const ctx = supportAgentCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findUnique.mockResolvedValue({ id: "t-1" });
    db.supportTicket.update.mockResolvedValue({
      id: "t-1",
      status: "CLOSED",
      resolvedAt: null,
      closedAt: new Date(),
    });

    const result = await caller.support.updateStatus({
      ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      status: "CLOSED",
    });

    expect(result.status).toBe("CLOSED");
  });

  it("throws NOT_FOUND for non-existent ticket", async () => {
    const db = createMockDb();
    const ctx = supportAgentCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.findUnique.mockResolvedValue(null);

    await expect(
      caller.support.updateStatus({
        ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        status: "RESOLVED",
      }),
    ).rejects.toThrow("Ticket not found");
  });

  it("rejects non-support users", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    await expect(
      caller.support.updateStatus({
        ticketId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        status: "RESOLVED",
      }),
    ).rejects.toThrow(TRPCError);
  });
});

describe("support.metrics", () => {
  it("returns support metrics with statuses and priorities", async () => {
    const db = createMockDb();
    const ctx = supportAgentCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.groupBy
      .mockResolvedValueOnce([
        // statusCounts
        { status: "OPEN", _count: 5 },
        { status: "IN_PROGRESS", _count: 3 },
        { status: "WAITING_ON_CUSTOMER", _count: 2 },
        { status: "RESOLVED", _count: 10 },
        { status: "CLOSED", _count: 7 },
      ])
      .mockResolvedValueOnce([
        // priorityCounts
        { priority: "LOW", _count: 2 },
        { priority: "MEDIUM", _count: 4 },
        { priority: "HIGH", _count: 3 },
        { priority: "URGENT", _count: 1 },
      ]);

    const result = await caller.support.metrics();

    expect(result.statuses.open).toBe(5);
    expect(result.statuses.inProgress).toBe(3);
    expect(result.statuses.waitingOnCustomer).toBe(2);
    expect(result.statuses.resolved).toBe(10);
    expect(result.statuses.closed).toBe(7);
    expect(result.activePriorities.low).toBe(2);
    expect(result.activePriorities.medium).toBe(4);
    expect(result.activePriorities.high).toBe(3);
    expect(result.activePriorities.urgent).toBe(1);
  });

  it("returns zero counts when no tickets exist", async () => {
    const db = createMockDb();
    const ctx = supportAgentCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await caller.support.metrics();

    expect(result.statuses.open).toBe(0);
    expect(result.statuses.inProgress).toBe(0);
    expect(result.activePriorities.low).toBe(0);
    expect(result.activePriorities.urgent).toBe(0);
  });

  it("platform admin can also access metrics", async () => {
    const db = createMockDb();
    const ctx = platformAdminCtx(db);
    const caller = createCaller(ctx);

    db.supportTicket.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await caller.support.metrics();

    expect(result).toHaveProperty("statuses");
    expect(result).toHaveProperty("activePriorities");
  });

  it("rejects non-support users", async () => {
    const db = createMockDb();
    const ctx = authedUserCtx(db);
    const caller = createCaller(ctx);

    await expect(caller.support.metrics()).rejects.toThrow(TRPCError);
  });
});
