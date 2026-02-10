import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const SESSION_ID_KEY = "dubai_device_session_id";
const OFFLINE_QUEUE_KEY = "dubai_offline_queue";

/**
 * Detect the device type for the Expo app (always mobile or tablet).
 */
export function detectExpoDeviceType(): "mobile" | "tablet" {
  // On React Native, use Platform + screen dimensions heuristic
  if (Platform.OS === "ios" && Platform.isPad) return "tablet";
  return "mobile";
}

/**
 * Get a friendly device name for the current Expo device.
 */
export function getExpoDeviceName(): string {
  if (Platform.OS === "ios") {
    return Platform.isPad ? "iPad" : "iPhone";
  }
  if (Platform.OS === "android") return "Android";
  return "Mobile Device";
}

/**
 * Persist the device session ID in secure storage.
 */
export function storeSessionId(sessionId: string): void {
  SecureStore.setItem(SESSION_ID_KEY, sessionId);
}

/**
 * Retrieve the persisted device session ID.
 */
export function getStoredSessionId(): string | null {
  return SecureStore.getItem(SESSION_ID_KEY);
}

/**
 * Clear the stored session ID on sign-out.
 */
export async function clearSessionId(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_ID_KEY);
}

/**
 * Offline action queuing for React Native.
 * Uses SecureStore for persistence across app restarts.
 */
export interface QueuedAction {
  idempotencyKey: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

export function getOfflineQueue(): QueuedAction[] {
  try {
    const raw = SecureStore.getItem(OFFLINE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineAction(
  action: string,
  payload: Record<string, unknown>,
): QueuedAction {
  const idempotencyKey = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const item: QueuedAction = {
    idempotencyKey,
    action,
    payload,
    createdAt: Date.now(),
  };

  const queue = getOfflineQueue();
  queue.push(item);
  SecureStore.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

  return item;
}

export function removeFromOfflineQueue(idempotencyKey: string): void {
  const queue = getOfflineQueue().filter(
    (item) => item.idempotencyKey !== idempotencyKey,
  );
  SecureStore.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function clearOfflineQueue(): void {
  SecureStore.setItem(OFFLINE_QUEUE_KEY, "[]");
}
