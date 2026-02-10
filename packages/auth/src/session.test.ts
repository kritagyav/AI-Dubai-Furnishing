/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from "vitest";

import {
  clearOfflineQueue,
  detectDeviceType,
  enqueueOfflineAction,
  generateIdempotencyKey,
  getDeviceName,
  getOfflineQueue,
  removeFromOfflineQueue,
} from "./session";

describe("detectDeviceType", () => {
  it("returns desktop when window is undefined (SSR)", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error — simulate SSR
    delete globalThis.window;

    expect(detectDeviceType()).toBe("desktop");

    globalThis.window = originalWindow;
  });

  it("returns desktop for wide screens", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 1440,
      writable: true,
    });
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Macintosh)",
      configurable: true,
    });

    expect(detectDeviceType()).toBe("desktop");
  });

  it("returns mobile for narrow screens with mobile UA", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 390,
      writable: true,
    });
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS)",
      configurable: true,
    });

    expect(detectDeviceType()).toBe("mobile");
  });

  it("returns tablet for iPad UA", () => {
    Object.defineProperty(window, "innerWidth", {
      value: 768,
      writable: true,
    });
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPad; CPU OS)",
      configurable: true,
    });

    expect(detectDeviceType()).toBe("tablet");
  });
});

describe("getDeviceName", () => {
  it("returns iPhone for iPhone UA", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
      configurable: true,
    });
    expect(getDeviceName()).toBe("iPhone");
  });

  it("returns Mac for Macintosh UA", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      configurable: true,
    });
    expect(getDeviceName()).toBe("Mac");
  });

  it("returns Windows PC for Windows UA", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      configurable: true,
    });
    expect(getDeviceName()).toBe("Windows PC");
  });
});

describe("generateIdempotencyKey", () => {
  it("generates unique keys", () => {
    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();

    expect(key1).not.toBe(key2);
  });

  it("generates keys in expected format (timestamp-random)", () => {
    const key = generateIdempotencyKey();
    expect(key).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
  });
});

describe("offline queue", () => {
  beforeEach(() => {
    clearOfflineQueue();
  });

  it("starts empty", () => {
    expect(getOfflineQueue()).toEqual([]);
  });

  it("enqueues and retrieves actions", () => {
    const action = enqueueOfflineAction("updateProfile", { name: "Test" });

    const queue = getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]?.action).toBe("updateProfile");
    expect(queue[0]?.idempotencyKey).toBe(action.idempotencyKey);
  });

  it("removes specific actions from queue", () => {
    const a1 = enqueueOfflineAction("action1", {});
    enqueueOfflineAction("action2", {});

    removeFromOfflineQueue(a1.idempotencyKey);

    const queue = getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]?.action).toBe("action2");
  });

  it("clears the entire queue", () => {
    enqueueOfflineAction("action1", {});
    enqueueOfflineAction("action2", {});

    clearOfflineQueue();

    expect(getOfflineQueue()).toEqual([]);
  });
});
