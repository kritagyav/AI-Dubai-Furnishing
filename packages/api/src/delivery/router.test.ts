import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// Mock external dependencies
vi.mock("@dubai/queue", () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
  trackEvent: vi.fn(),
}));

import { deliveryRouter } from "./router";

// ─── Helpers ───

function createMockDb() {
  return {
    deliverySlot: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    deliverySchedule: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    deliveryIssue: {
      create: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

function authedCtx(db: MockDb) {
  return {
    user: {
      id: "user-1",
      supabaseId: "supa-1",
      role: "USER",
      tenantId: null,
      email: "test@example.com",
      name: "Test User",
    },
    db: db as unknown,
    correlationId: "test-corr",
  };
}

function adminCtx(db: MockDb) {
  return {
    user: {
      id: "admin-1",
      supabaseId: "supa-admin",
      role: "PLATFORM_ADMIN",
      tenantId: null,
      email: "admin@example.com",
      name: "Admin User",
    },
    db: db as unknown,
    correlationId: "test-corr",
  };
}

function createMockTx() {
  return {
    deliverySlot: {
      update: vi.fn(),
    },
    deliverySchedule: {
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

async function callProcedure(
  procedure: { _def: { resolver?: unknown } },
  opts: { ctx: unknown; input?: unknown },
) {
  const handler = procedure._def.resolver;
  if (!handler) throw new Error("No handler found");
  return (handler as (opts: { ctx: unknown; input: unknown }) => unknown)(opts);
}

// ═══════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════

describe("delivery router", () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  // ─── listSlots ───

  describe("listSlots", () => {
    it("returns available slots for a date", async () => {
      const slots = [
        {
          id: "slot-1",
          date: new Date("2025-03-15"),
          startTime: "09:00",
          endTime: "12:00",
          capacity: 10,
          booked: 3,
          area: "Dubai Marina",
        },
        {
          id: "slot-2",
          date: new Date("2025-03-15"),
          startTime: "12:00",
          endTime: "15:00",
          capacity: 10,
          booked: 10,
          area: "Dubai Marina",
        },
      ];
      db.deliverySlot.findMany.mockResolvedValue(slots);

      const result = await callProcedure(deliveryRouter.listSlots, {
        ctx: authedCtx(db),
        input: { date: "2025-03-15" },
      });

      const items = result as Array<{ available: number }>;
      expect(items).toHaveLength(2);
      expect(items[0]!.available).toBe(7); // 10 - 3
      expect(items[1]!.available).toBe(0); // 10 - 10
    });

    it("filters by area", async () => {
      db.deliverySlot.findMany.mockResolvedValue([]);

      await callProcedure(deliveryRouter.listSlots, {
        ctx: authedCtx(db),
        input: { date: "2025-03-15", area: "JBR" },
      });

      expect(db.deliverySlot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ area: "JBR" }),
        }),
      );
    });

    it("only returns active slots", async () => {
      db.deliverySlot.findMany.mockResolvedValue([]);

      await callProcedure(deliveryRouter.listSlots, {
        ctx: authedCtx(db),
        input: { date: "2025-03-15" },
      });

      expect(db.deliverySlot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it("sorts by start time ascending", async () => {
      db.deliverySlot.findMany.mockResolvedValue([]);

      await callProcedure(deliveryRouter.listSlots, {
        ctx: authedCtx(db),
        input: { date: "2025-03-15" },
      });

      expect(db.deliverySlot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { startTime: "asc" },
        }),
      );
    });
  });

  // ─── schedule ───

  describe("schedule", () => {
    it("rejects when order not found", async () => {
      db.order.findFirst.mockResolvedValue(null);

      await expect(
        callProcedure(deliveryRouter.schedule, {
          ctx: authedCtx(db),
          input: { orderId: "order-missing", slotId: "slot-1" },
        }),
      ).rejects.toThrow("Order not found");
    });

    it("rejects unpaid order", async () => {
      db.order.findFirst.mockResolvedValue({
        id: "order-1",
        status: "PENDING_PAYMENT",
      });

      await expect(
        callProcedure(deliveryRouter.schedule, {
          ctx: authedCtx(db),
          input: { orderId: "order-1", slotId: "slot-1" },
        }),
      ).rejects.toThrow("Order must be paid before scheduling delivery");
    });

    it("rejects when slot not found", async () => {
      db.order.findFirst.mockResolvedValue({
        id: "order-1",
        status: "PAID",
      });
      db.deliverySlot.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(deliveryRouter.schedule, {
          ctx: authedCtx(db),
          input: { orderId: "order-1", slotId: "slot-missing" },
        }),
      ).rejects.toThrow("Delivery slot not found");
    });

    it("rejects full slot", async () => {
      db.order.findFirst.mockResolvedValue({
        id: "order-1",
        status: "PAID",
      });
      db.deliverySlot.findUnique.mockResolvedValue({
        id: "slot-1",
        date: new Date("2025-03-15"),
        startTime: "09:00",
        endTime: "12:00",
        capacity: 10,
        booked: 10,
      });

      await expect(
        callProcedure(deliveryRouter.schedule, {
          ctx: authedCtx(db),
          input: { orderId: "order-1", slotId: "slot-1" },
        }),
      ).rejects.toThrow("Delivery slot is fully booked");
    });

    it("books a slot successfully", async () => {
      db.order.findFirst.mockResolvedValue({
        id: "order-1",
        status: "PAID",
      });
      db.deliverySlot.findUnique.mockResolvedValue({
        id: "slot-1",
        date: new Date("2025-03-15"),
        startTime: "09:00",
        endTime: "12:00",
        capacity: 10,
        booked: 5,
      });

      const mockTx = createMockTx();
      mockTx.deliverySchedule.create.mockResolvedValue({
        id: "del-1",
        scheduledDate: new Date("2025-03-15"),
        scheduledSlot: "09:00-12:00",
        status: "SCHEDULED",
      });

      db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockTx),
      );

      const result = await callProcedure(deliveryRouter.schedule, {
        ctx: authedCtx(db),
        input: { orderId: "order-1", slotId: "slot-1", notes: "Ring bell" },
      });

      // Verify slot booking increment
      expect(mockTx.deliverySlot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "slot-1" },
          data: { booked: { increment: 1 } },
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: "del-1",
          status: "SCHEDULED",
          scheduledSlot: "09:00-12:00",
        }),
      );
    });

    it("accepts PROCESSING order status", async () => {
      db.order.findFirst.mockResolvedValue({
        id: "order-1",
        status: "PROCESSING",
      });
      db.deliverySlot.findUnique.mockResolvedValue({
        id: "slot-1",
        date: new Date("2025-03-15"),
        startTime: "09:00",
        endTime: "12:00",
        capacity: 10,
        booked: 2,
      });

      const mockTx = createMockTx();
      mockTx.deliverySchedule.create.mockResolvedValue({
        id: "del-1",
        scheduledDate: new Date("2025-03-15"),
        scheduledSlot: "09:00-12:00",
        status: "SCHEDULED",
      });

      db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockTx),
      );

      // Should not throw
      const result = await callProcedure(deliveryRouter.schedule, {
        ctx: authedCtx(db),
        input: { orderId: "order-1", slotId: "slot-1" },
      });

      expect((result as { status: string }).status).toBe("SCHEDULED");
    });
  });

  // ─── reschedule ───

  describe("reschedule", () => {
    it("rejects when delivery not found", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(deliveryRouter.reschedule, {
          ctx: authedCtx(db),
          input: { deliveryId: "del-missing", slotId: "slot-2" },
        }),
      ).rejects.toThrow("Delivery not found");
    });

    it("rejects when order ownership check fails", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        orderId: "order-other",
        slotId: "slot-1",
        status: "SCHEDULED",
      });
      db.order.findFirst.mockResolvedValue(null);

      await expect(
        callProcedure(deliveryRouter.reschedule, {
          ctx: authedCtx(db),
          input: { deliveryId: "del-1", slotId: "slot-2" },
        }),
      ).rejects.toThrow("Order not found");
    });

    it("rejects when delivery status is not reschedulable", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        orderId: "order-1",
        slotId: "slot-1",
        status: "DELIVERED",
      });
      db.order.findFirst.mockResolvedValue({ id: "order-1" });

      await expect(
        callProcedure(deliveryRouter.reschedule, {
          ctx: authedCtx(db),
          input: { deliveryId: "del-1", slotId: "slot-2" },
        }),
      ).rejects.toThrow("Delivery cannot be rescheduled");
    });

    it("rejects when new slot is not available", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        orderId: "order-1",
        slotId: "slot-1",
        status: "SCHEDULED",
      });
      db.order.findFirst.mockResolvedValue({ id: "order-1" });
      db.deliverySlot.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(deliveryRouter.reschedule, {
          ctx: authedCtx(db),
          input: { deliveryId: "del-1", slotId: "slot-missing" },
        }),
      ).rejects.toThrow("New slot is not available");
    });

    it("rejects when new slot is fully booked", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        orderId: "order-1",
        slotId: "slot-1",
        status: "SCHEDULED",
      });
      db.order.findFirst.mockResolvedValue({ id: "order-1" });
      db.deliverySlot.findUnique.mockResolvedValue({
        id: "slot-2",
        date: new Date("2025-03-16"),
        startTime: "12:00",
        endTime: "15:00",
        capacity: 10,
        booked: 10,
      });

      await expect(
        callProcedure(deliveryRouter.reschedule, {
          ctx: authedCtx(db),
          input: { deliveryId: "del-1", slotId: "slot-2" },
        }),
      ).rejects.toThrow("New slot is not available");
    });

    it("reschedules successfully, releasing old slot", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        orderId: "order-1",
        slotId: "slot-1",
        status: "SCHEDULED",
      });
      db.order.findFirst.mockResolvedValue({ id: "order-1" });
      db.deliverySlot.findUnique.mockResolvedValue({
        id: "slot-2",
        date: new Date("2025-03-16"),
        startTime: "12:00",
        endTime: "15:00",
        capacity: 10,
        booked: 5,
      });

      const mockTx = createMockTx();
      mockTx.deliverySchedule.update.mockResolvedValue({
        id: "del-1",
        scheduledDate: new Date("2025-03-16"),
        scheduledSlot: "12:00-15:00",
        status: "RESCHEDULED",
      });

      db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockTx),
      );

      const result = await callProcedure(deliveryRouter.reschedule, {
        ctx: authedCtx(db),
        input: { deliveryId: "del-1", slotId: "slot-2" },
      });

      // Old slot decremented
      expect(mockTx.deliverySlot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "slot-1" },
          data: { booked: { decrement: 1 } },
        }),
      );
      // New slot incremented
      expect(mockTx.deliverySlot.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "slot-2" },
          data: { booked: { increment: 1 } },
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          status: "RESCHEDULED",
          scheduledSlot: "12:00-15:00",
        }),
      );
    });

    it("allows rescheduling FAILED deliveries", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        orderId: "order-1",
        slotId: "slot-1",
        status: "FAILED",
      });
      db.order.findFirst.mockResolvedValue({ id: "order-1" });
      db.deliverySlot.findUnique.mockResolvedValue({
        id: "slot-2",
        date: new Date("2025-03-17"),
        startTime: "15:00",
        endTime: "18:00",
        capacity: 10,
        booked: 0,
      });

      const mockTx = createMockTx();
      mockTx.deliverySchedule.update.mockResolvedValue({
        id: "del-1",
        scheduledDate: new Date("2025-03-17"),
        scheduledSlot: "15:00-18:00",
        status: "RESCHEDULED",
      });

      db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn(mockTx),
      );

      const result = await callProcedure(deliveryRouter.reschedule, {
        ctx: authedCtx(db),
        input: { deliveryId: "del-1", slotId: "slot-2" },
      });

      expect((result as { status: string }).status).toBe("RESCHEDULED");
    });
  });

  // ─── assignDriver ───

  describe("assignDriver", () => {
    it("rejects when delivery not found", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(deliveryRouter.assignDriver, {
          ctx: adminCtx(db),
          input: {
            deliveryId: "del-missing",
            driverName: "Ali",
            driverPhone: "+971501234567",
          },
        }),
      ).rejects.toThrow("Delivery not found");
    });

    it("rejects wrong status (not SCHEDULED or RESCHEDULED)", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        status: "DELIVERED",
      });

      await expect(
        callProcedure(deliveryRouter.assignDriver, {
          ctx: adminCtx(db),
          input: {
            deliveryId: "del-1",
            driverName: "Ali",
            driverPhone: "+971501234567",
          },
        }),
      ).rejects.toThrow("Cannot assign driver to delivery in DELIVERED status");
    });

    it("rejects EN_ROUTE status", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        status: "EN_ROUTE",
      });

      await expect(
        callProcedure(deliveryRouter.assignDriver, {
          ctx: adminCtx(db),
          input: {
            deliveryId: "del-1",
            driverName: "Ali",
            driverPhone: "+971501234567",
          },
        }),
      ).rejects.toThrow("Cannot assign driver");
    });

    it("assigns driver to SCHEDULED delivery", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        status: "SCHEDULED",
      });
      db.deliverySchedule.update.mockResolvedValue({
        id: "del-1",
        status: "ASSIGNED",
        driverName: "Ali",
        driverPhone: "+971501234567",
        vehiclePlate: "A-12345",
      });

      const result = await callProcedure(deliveryRouter.assignDriver, {
        ctx: adminCtx(db),
        input: {
          deliveryId: "del-1",
          driverName: "Ali",
          driverPhone: "+971501234567",
          vehiclePlate: "A-12345",
        },
      });

      expect(db.deliverySchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            driverName: "Ali",
            driverPhone: "+971501234567",
            vehiclePlate: "A-12345",
            status: "ASSIGNED",
          }),
        }),
      );
      expect((result as { status: string }).status).toBe("ASSIGNED");
    });

    it("assigns driver to RESCHEDULED delivery", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        status: "RESCHEDULED",
      });
      db.deliverySchedule.update.mockResolvedValue({
        id: "del-1",
        status: "ASSIGNED",
        driverName: "Omar",
        driverPhone: "+971509999999",
        vehiclePlate: null,
      });

      const result = await callProcedure(deliveryRouter.assignDriver, {
        ctx: adminCtx(db),
        input: {
          deliveryId: "del-1",
          driverName: "Omar",
          driverPhone: "+971509999999",
        },
      });

      expect((result as { status: string }).status).toBe("ASSIGNED");
    });
  });

  // ─── unassignDriver ───

  describe("unassignDriver", () => {
    it("rejects when delivery not found", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(deliveryRouter.unassignDriver, {
          ctx: adminCtx(db),
          input: { deliveryId: "del-missing" },
        }),
      ).rejects.toThrow("Delivery not found");
    });

    it("rejects when not in ASSIGNED status", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        status: "SCHEDULED",
      });

      await expect(
        callProcedure(deliveryRouter.unassignDriver, {
          ctx: adminCtx(db),
          input: { deliveryId: "del-1" },
        }),
      ).rejects.toThrow(
        "Cannot unassign driver from delivery in SCHEDULED status",
      );
    });

    it("rejects when delivery is EN_ROUTE", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        status: "EN_ROUTE",
      });

      await expect(
        callProcedure(deliveryRouter.unassignDriver, {
          ctx: adminCtx(db),
          input: { deliveryId: "del-1" },
        }),
      ).rejects.toThrow(
        "Cannot unassign driver from delivery in EN_ROUTE status",
      );
    });

    it("clears driver info and resets status", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        status: "ASSIGNED",
      });
      db.deliverySchedule.update.mockResolvedValue({
        id: "del-1",
        status: "SCHEDULED",
        driverName: null,
        driverPhone: null,
      });

      const result = await callProcedure(deliveryRouter.unassignDriver, {
        ctx: adminCtx(db),
        input: { deliveryId: "del-1" },
      });

      expect(db.deliverySchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            driverName: null,
            driverPhone: null,
            vehiclePlate: null,
            status: "SCHEDULED",
          },
        }),
      );
      expect((result as { status: string }).status).toBe("SCHEDULED");
      expect((result as { driverName: string | null }).driverName).toBeNull();
    });
  });

  // ─── updateDriverStatus ───

  describe("updateDriverStatus", () => {
    it("rejects when delivery not found", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(deliveryRouter.updateDriverStatus, {
          ctx: adminCtx(db),
          input: { deliveryId: "del-missing", status: "EN_ROUTE" },
        }),
      ).rejects.toThrow("Delivery not found");
    });

    it("transitions to EN_ROUTE status", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        status: "ASSIGNED",
        notes: null,
      });
      db.deliverySchedule.update.mockResolvedValue({
        id: "del-1",
        status: "EN_ROUTE",
        driverName: "Ali",
        driverPhone: "+971501234567",
        vehiclePlate: "A-12345",
        deliveredAt: null,
        notes: null,
      });

      const result = await callProcedure(deliveryRouter.updateDriverStatus, {
        ctx: adminCtx(db),
        input: { deliveryId: "del-1", status: "EN_ROUTE" },
      });

      expect(db.deliverySchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "EN_ROUTE" }),
        }),
      );
      expect((result as { status: string }).status).toBe("EN_ROUTE");
    });

    it("transitions ARRIVED to IN_TRANSIT status", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        status: "EN_ROUTE",
        notes: null,
      });
      db.deliverySchedule.update.mockResolvedValue({
        id: "del-1",
        status: "IN_TRANSIT",
        driverName: "Ali",
        driverPhone: "+971501234567",
        vehiclePlate: "A-12345",
        deliveredAt: null,
        notes: null,
      });

      const result = await callProcedure(deliveryRouter.updateDriverStatus, {
        ctx: adminCtx(db),
        input: { deliveryId: "del-1", status: "ARRIVED" },
      });

      expect(db.deliverySchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "IN_TRANSIT" }),
        }),
      );
      expect((result as { status: string }).status).toBe("IN_TRANSIT");
    });

    it("sets deliveredAt on COMPLETED status", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        status: "IN_TRANSIT",
        notes: null,
      });
      db.deliverySchedule.update.mockResolvedValue({
        id: "del-1",
        status: "DELIVERED",
        driverName: "Ali",
        driverPhone: "+971501234567",
        vehiclePlate: "A-12345",
        deliveredAt: new Date(),
        notes: null,
      });

      const result = await callProcedure(deliveryRouter.updateDriverStatus, {
        ctx: adminCtx(db),
        input: { deliveryId: "del-1", status: "COMPLETED" },
      });

      expect(db.deliverySchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "DELIVERED",
            deliveredAt: expect.any(Date),
          }),
        }),
      );
      expect(
        (result as { deliveredAt: Date | null }).deliveredAt,
      ).not.toBeNull();
    });

    it("appends notes to existing notes", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        status: "ASSIGNED",
        notes: "Previous note",
      });
      db.deliverySchedule.update.mockResolvedValue({
        id: "del-1",
        status: "EN_ROUTE",
        driverName: "Ali",
        driverPhone: "+971501234567",
        vehiclePlate: "A-12345",
        deliveredAt: null,
        notes: "Previous note\n[...] Left warehouse",
      });

      await callProcedure(deliveryRouter.updateDriverStatus, {
        ctx: adminCtx(db),
        input: {
          deliveryId: "del-1",
          status: "EN_ROUTE",
          notes: "Left warehouse",
        },
      });

      const updateCall = db.deliverySchedule.update.mock.calls[0]![0];
      // Notes should contain both old and new
      expect(updateCall.data.notes).toContain("Previous note");
      expect(updateCall.data.notes).toContain("Left warehouse");
    });

    it("sets notes when no previous notes exist", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        status: "ASSIGNED",
        notes: null,
      });
      db.deliverySchedule.update.mockResolvedValue({
        id: "del-1",
        status: "EN_ROUTE",
        driverName: "Ali",
        driverPhone: "+971501234567",
        vehiclePlate: "A-12345",
        deliveredAt: null,
        notes: "Started route",
      });

      await callProcedure(deliveryRouter.updateDriverStatus, {
        ctx: adminCtx(db),
        input: {
          deliveryId: "del-1",
          status: "EN_ROUTE",
          notes: "Started route",
        },
      });

      const updateCall = db.deliverySchedule.update.mock.calls[0]![0];
      expect(updateCall.data.notes).toContain("Started route");
    });
  });

  // ─── updateStatus (admin) ───

  describe("updateStatus", () => {
    it("rejects when delivery not found", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(deliveryRouter.updateStatus, {
          ctx: adminCtx(db),
          input: { deliveryId: "del-missing", status: "EN_ROUTE" },
        }),
      ).rejects.toThrow("Delivery not found");
    });

    it("updates delivery status", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({ id: "del-1" });
      db.deliverySchedule.update.mockResolvedValue({
        id: "del-1",
        status: "EN_ROUTE",
        driverName: "Ali",
        trackingUrl: "https://track.example.com/123",
        deliveredAt: null,
      });

      const result = await callProcedure(deliveryRouter.updateStatus, {
        ctx: adminCtx(db),
        input: {
          deliveryId: "del-1",
          status: "EN_ROUTE",
          trackingUrl: "https://track.example.com/123",
        },
      });

      expect((result as { status: string }).status).toBe("EN_ROUTE");
    });

    it("sets deliveredAt when status is DELIVERED", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({ id: "del-1" });
      db.deliverySchedule.update.mockResolvedValue({
        id: "del-1",
        status: "DELIVERED",
        driverName: "Ali",
        trackingUrl: null,
        deliveredAt: new Date(),
      });

      await callProcedure(deliveryRouter.updateStatus, {
        ctx: adminCtx(db),
        input: {
          deliveryId: "del-1",
          status: "DELIVERED",
        },
      });

      expect(db.deliverySchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "DELIVERED",
            deliveredAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ─── listAll (admin) ───

  describe("listAll", () => {
    it("returns paginated deliveries", async () => {
      const items = [
        {
          id: "d1",
          orderId: "o1",
          status: "SCHEDULED",
          scheduledDate: new Date(),
          scheduledSlot: "09:00-12:00",
          driverName: null,
          createdAt: new Date(),
        },
      ];
      db.deliverySchedule.findMany.mockResolvedValue(items);

      const result = await callProcedure(deliveryRouter.listAll, {
        ctx: adminCtx(db),
        input: { limit: 20 },
      });

      expect((result as { items: unknown[] }).items).toHaveLength(1);
      expect((result as { nextCursor: unknown }).nextCursor).toBeUndefined();
    });

    it("returns nextCursor when more items exist", async () => {
      const items = Array.from({ length: 3 }, (_, i) => ({
        id: `d${i}`,
        orderId: `o${i}`,
        status: "SCHEDULED",
        scheduledDate: new Date(),
        scheduledSlot: "09:00-12:00",
        driverName: null,
        createdAt: new Date(),
      }));
      db.deliverySchedule.findMany.mockResolvedValue(items);

      const result = await callProcedure(deliveryRouter.listAll, {
        ctx: adminCtx(db),
        input: { limit: 2 },
      });

      expect((result as { items: unknown[] }).items).toHaveLength(2);
      expect((result as { nextCursor: string }).nextCursor).toBe("d2");
    });

    it("filters by status", async () => {
      db.deliverySchedule.findMany.mockResolvedValue([]);

      await callProcedure(deliveryRouter.listAll, {
        ctx: adminCtx(db),
        input: { limit: 20, status: "SCHEDULED" },
      });

      expect(db.deliverySchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "SCHEDULED" }),
        }),
      );
    });
  });

  // ─── getByOrder ───

  describe("getByOrder", () => {
    it("rejects when order not owned by user", async () => {
      db.order.findFirst.mockResolvedValue(null);

      await expect(
        callProcedure(deliveryRouter.getByOrder, {
          ctx: authedCtx(db),
          input: { orderId: "order-other" },
        }),
      ).rejects.toThrow("Order not found");
    });

    it("returns delivery info for order", async () => {
      db.order.findFirst.mockResolvedValue({ id: "order-1" });
      db.deliverySchedule.findMany.mockResolvedValue([
        {
          id: "del-1",
          status: "DELIVERED",
          scheduledDate: new Date(),
          scheduledSlot: "09:00-12:00",
          driverName: "Ali",
          driverPhone: "+971501234567",
          trackingUrl: null,
          deliveredAt: new Date(),
          notes: null,
          createdAt: new Date(),
          issues: [],
        },
      ]);

      const result = await callProcedure(deliveryRouter.getByOrder, {
        ctx: authedCtx(db),
        input: { orderId: "order-1" },
      });

      expect(result).toHaveLength(1);
      expect((result as Array<{ status: string }>)[0]!.status).toBe(
        "DELIVERED",
      );
    });
  });

  // ─── reportIssue ───

  describe("reportIssue", () => {
    it("rejects when delivery not found", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue(null);

      await expect(
        callProcedure(deliveryRouter.reportIssue, {
          ctx: authedCtx(db),
          input: {
            deliveryId: "del-missing",
            type: "DAMAGED",
            description: "Box was dented",
          },
        }),
      ).rejects.toThrow("Delivery not found");
    });

    it("rejects when order not owned by user", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        orderId: "order-other",
      });
      db.order.findFirst.mockResolvedValue(null);

      await expect(
        callProcedure(deliveryRouter.reportIssue, {
          ctx: authedCtx(db),
          input: {
            deliveryId: "del-1",
            type: "DAMAGED",
            description: "Box was dented",
          },
        }),
      ).rejects.toThrow("Order not found");
    });

    it("creates issue report successfully", async () => {
      db.deliverySchedule.findUnique.mockResolvedValue({
        id: "del-1",
        orderId: "order-1",
      });
      db.order.findFirst.mockResolvedValue({ id: "order-1" });
      db.deliveryIssue.create.mockResolvedValue({
        id: "issue-1",
        type: "DAMAGED",
        description: "Box was dented",
        createdAt: new Date(),
      });

      const result = await callProcedure(deliveryRouter.reportIssue, {
        ctx: authedCtx(db),
        input: {
          deliveryId: "del-1",
          type: "DAMAGED",
          description: "Box was dented",
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: "issue-1",
          type: "DAMAGED",
        }),
      );
    });
  });

  // ─── listDriverAssignments ───

  describe("listDriverAssignments", () => {
    it("returns enriched delivery assignments", async () => {
      db.deliverySchedule.findMany.mockResolvedValue([
        {
          id: "d1",
          orderId: "o1",
          status: "ASSIGNED",
          scheduledDate: new Date(),
          scheduledSlot: "09:00-12:00",
          driverName: "Ali",
          driverPhone: "+971501234567",
          vehiclePlate: "A-12345",
          deliveredAt: null,
          notes: null,
          createdAt: new Date(),
        },
      ]);
      db.order.findMany.mockResolvedValue([
        {
          id: "o1",
          orderRef: "ORD-001",
          totalFils: 50000,
          shippingAddress: { line1: "123 Main" },
        },
      ]);

      const result = await callProcedure(deliveryRouter.listDriverAssignments, {
        ctx: adminCtx(db),
        input: { limit: 20 },
      });

      const items = (result as { items: Array<{ order: unknown }> }).items;
      expect(items).toHaveLength(1);
      expect(items[0]!.order).toEqual(
        expect.objectContaining({ orderRef: "ORD-001" }),
      );
    });

    it("filters by date range", async () => {
      db.deliverySchedule.findMany.mockResolvedValue([]);
      db.order.findMany.mockResolvedValue([]);

      await callProcedure(deliveryRouter.listDriverAssignments, {
        ctx: adminCtx(db),
        input: {
          limit: 20,
          fromDate: "2025-03-01",
          toDate: "2025-03-31",
        },
      });

      expect(db.deliverySchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledDate: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });
});
