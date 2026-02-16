"use client";

/**
 * Cross-device session management — Story 1.9.
 *
 * Provides device detection, session registration, activity tracking,
 * and "Continue where you left off" state management.
 */

/**
 * Detect the current device type based on screen width and user agent.
 */
export function detectDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";

  const width = window.innerWidth;
  const ua = navigator.userAgent.toLowerCase();

  if (/ipad|tablet|playbook|silk/i.test(ua) || (width >= 600 && width < 1024)) {
    return "tablet";
  }
  if (
    /mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua) ||
    width < 600
  ) {
    return "mobile";
  }
  return "desktop";
}

/**
 * Generate a friendly device name from the user agent.
 */
export function getDeviceName(): string {
  if (typeof navigator === "undefined") return "Unknown Device";

  const ua = navigator.userAgent;

  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) {
    if (/Mobile/i.test(ua)) return "Android Phone";
    return "Android Tablet";
  }
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux";

  return "Unknown Device";
}

/**
 * Generate a client-side idempotency key for offline action queuing.
 * Format: {timestamp}-{random} to be time-sortable and unique.
 */
export function generateIdempotencyKey(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Simple in-memory offline action queue.
 * Stores actions when offline and flushes them when connectivity resumes.
 */
export interface QueuedAction {
  idempotencyKey: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

const STORAGE_KEY = "dubai_offline_queue";

export function getOfflineQueue(): QueuedAction[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineAction(
  action: string,
  payload: Record<string, unknown>,
): QueuedAction {
  const item: QueuedAction = {
    idempotencyKey: generateIdempotencyKey(),
    action,
    payload,
    createdAt: Date.now(),
  };

  const queue = getOfflineQueue();
  queue.push(item);

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }

  return item;
}

export function removeFromOfflineQueue(idempotencyKey: string): void {
  const queue = getOfflineQueue().filter(
    (item) => item.idempotencyKey !== idempotencyKey,
  );

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }
}

export function clearOfflineQueue(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
