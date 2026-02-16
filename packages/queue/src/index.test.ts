import { describe, expect, it } from "vitest";

import type {
  InventorySyncPayload,
  NotificationSendPayload,
  CommissionCalculatePayload,
  DeliveryRemindPayload,
  PackageGeneratePayload,
  CartAbandonCheckPayload,
  AnalyticsTrackPayload,
  JobName,
  AnalyticsEventName,
  JobPayloadMap,
} from "./index";

// ═══════════════════════════════════════════
// Type-level tests (compile-time verification)
// ═══════════════════════════════════════════

describe("queue types", () => {
  it("JobName includes all expected job types", () => {
    const jobs: JobName[] = [
      "inventory.sync",
      "notification.send",
      "commission.calculate",
      "delivery.remind",
      "package.generate",
      "cart.abandon-check",
      "analytics.track",
    ];
    expect(jobs).toHaveLength(7);
  });

  it("AnalyticsEventName includes all expected events", () => {
    const events: AnalyticsEventName[] = [
      "order.created",
      "order.paid",
      "order.cancelled",
      "package.generated",
      "package.accepted",
      "cart.item_added",
      "cart.cleared",
      "product.viewed",
      "catalog.uploaded",
    ];
    expect(events).toHaveLength(9);
  });

  it("InventorySyncPayload has correct shape", () => {
    const payload: InventorySyncPayload = {
      retailerId: "r-1",
      configId: "c-1",
      tier: "BASIC",
    };
    expect(payload.tier).toBe("BASIC");

    const premium: InventorySyncPayload = {
      retailerId: "r-2",
      configId: "c-2",
      tier: "PREMIUM",
    };
    expect(premium.tier).toBe("PREMIUM");
  });

  it("NotificationSendPayload has correct shape", () => {
    const payload: NotificationSendPayload = {
      userId: "u-1",
      type: "ORDER_UPDATE",
      title: "Test",
      body: "Test body",
    };
    expect(payload.type).toBe("ORDER_UPDATE");

    const withData: NotificationSendPayload = {
      userId: "u-1",
      type: "PROMOTION",
      title: "Sale",
      body: "Big sale",
      data: { discount: 20 },
    };
    expect(withData.data).toEqual({ discount: 20 });
  });

  it("CommissionCalculatePayload has correct shape", () => {
    const payload: CommissionCalculatePayload = { orderId: "o-1" };
    expect(payload.orderId).toBe("o-1");
  });

  it("DeliveryRemindPayload has correct shape", () => {
    const payload: DeliveryRemindPayload = { deliveryId: "d-1" };
    expect(payload.deliveryId).toBe("d-1");
  });

  it("PackageGeneratePayload has correct shape", () => {
    const payload: PackageGeneratePayload = {
      packageId: "p-1",
      projectId: "proj-1",
      userId: "u-1",
    };
    expect(payload.packageId).toBe("p-1");

    const withOptionals: PackageGeneratePayload = {
      packageId: "p-2",
      projectId: "proj-2",
      userId: "u-2",
      roomId: "room-1",
      styleTag: "modern",
    };
    expect(withOptionals.roomId).toBe("room-1");
  });

  it("CartAbandonCheckPayload has correct shape", () => {
    const payload: CartAbandonCheckPayload = {
      userId: "u-1",
      cartId: "cart-1",
    };
    expect(payload.userId).toBe("u-1");
  });

  it("AnalyticsTrackPayload has correct shape", () => {
    const payload: AnalyticsTrackPayload = {
      event: "order.created",
      userId: "u-1",
      properties: { orderId: "o-1", totalFils: 50000 },
      timestamp: "2025-01-01T00:00:00.000Z",
    };
    expect(payload.event).toBe("order.created");
    expect(payload.timestamp).toBeDefined();
  });

  it("JobPayloadMap maps names to correct payloads", () => {
    // This is a compile-time type check
    type SyncPayload = JobPayloadMap["inventory.sync"];
    const sync: SyncPayload = {
      retailerId: "r-1",
      configId: "c-1",
      tier: "BASIC",
    };
    expect(sync).toBeDefined();

    type TrackPayload = JobPayloadMap["analytics.track"];
    const track: TrackPayload = {
      event: "order.paid",
      userId: "u-1",
      properties: {},
    };
    expect(track).toBeDefined();
  });
});

describe("QUEUE_NAME", () => {
  it("exports the queue name constant", async () => {
    const { QUEUE_NAME } = await import("./index");
    expect(QUEUE_NAME).toBe("dubai-jobs");
  });
});
