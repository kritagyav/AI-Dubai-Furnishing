"use client";

/**
 * React hooks for cross-device session sync — Story 1.9.
 *
 * useDeviceSession: Registers the current device and tracks activity.
 * useResumableState: Provides "Continue where you left off" data.
 * useOfflineSync: Flushes queued offline actions on reconnect.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  clearOfflineQueue,
  detectDeviceType,
  getDeviceName,
  getOfflineQueue,
  removeFromOfflineQueue,
} from "./session";

interface DeviceSessionOptions {
  /** tRPC mutation to register device — caller passes api.session.registerDevice.mutate */
  registerDevice: (input: {
    deviceType: "mobile" | "tablet" | "desktop";
    deviceName?: string | undefined;
    userAgent?: string | undefined;
  }) => Promise<{ id: string }>;

  /** tRPC mutation to update activity state */
  updateActivityState: (input: {
    sessionId: string;
    currentPath: string;
    currentScreen?: string | undefined;
    contextData?: Record<string, unknown> | undefined;
  }) => Promise<{ success: boolean }>;

  /** Whether the user is authenticated */
  isAuthenticated: boolean;
}

/**
 * Registers the current device session and tracks navigation activity.
 * Returns the current sessionId for use in other session operations.
 */
export function useDeviceSession(opts: DeviceSessionOptions) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const registeredRef = useRef(false);

  // Register device on mount when authenticated
  useEffect(() => {
    if (!opts.isAuthenticated || registeredRef.current || isRegistering) return;

    setIsRegistering(true);
    registeredRef.current = true;

    void opts
      .registerDevice({
        deviceType: detectDeviceType(),
        deviceName: getDeviceName(),
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      })
      .then((result) => {
        setSessionId(result.id);
      })
      .catch(() => {
        registeredRef.current = false;
      })
      .finally(() => {
        setIsRegistering(false);
      });
  }, [opts.isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track navigation changes
  const trackNavigation = useCallback(
    (
      path: string,
      screen?: string,
      contextData?: Record<string, unknown>,
    ) => {
      if (!sessionId) return;

      void opts.updateActivityState({
        sessionId,
        currentPath: path,
        currentScreen: screen,
        contextData,
      });
    },
    [sessionId, opts.updateActivityState], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { sessionId, trackNavigation, isRegistering };
}

interface ResumableState {
  deviceType: string | null;
  deviceName: string | null;
  lastActiveAt: Date;
  path: string;
  context: Record<string, unknown> | null;
}

interface UseResumableStateOptions {
  /** tRPC query to get resumable state */
  getResumableState: (input: {
    currentSessionId: string;
  }) => Promise<ResumableState | null>;

  /** Current session ID (from useDeviceSession) */
  sessionId: string | null;

  /** Whether the user is authenticated */
  isAuthenticated: boolean;
}

/**
 * Provides the "Continue where you left off" state from another device.
 */
export function useResumableState(opts: UseResumableStateOptions) {
  const [resumable, setResumable] = useState<ResumableState | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (
      !opts.isAuthenticated ||
      !opts.sessionId ||
      fetchedRef.current ||
      isLoading
    )
      return;

    fetchedRef.current = true;
    setIsLoading(true);

    void opts
      .getResumableState({ currentSessionId: opts.sessionId })
      .then((state) => {
        setResumable(state);
      })
      .catch(() => {
        // Silently fail — non-critical feature
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [opts.isAuthenticated, opts.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  return {
    resumable: isDismissed ? null : resumable,
    isLoading,
    dismiss,
  };
}

interface UseOfflineSyncOptions {
  /** tRPC mutation to submit offline actions */
  submitOfflineAction: (input: {
    idempotencyKey: string;
    action: string;
    payload: Record<string, unknown>;
  }) => Promise<{ id: string; status: string; deduplicated: boolean }>;

  /** Whether the user is authenticated */
  isAuthenticated: boolean;
}

/**
 * Flushes queued offline actions when connectivity resumes.
 */
export function useOfflineSync(opts: UseOfflineSyncOptions) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Check pending count on mount
  useEffect(() => {
    setPendingCount(getOfflineQueue().length);
  }, []);

  // Flush queue when online
  const flushQueue = useCallback(async () => {
    if (!opts.isAuthenticated || isSyncing) return;

    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);

    for (const item of queue) {
      try {
        await opts.submitOfflineAction({
          idempotencyKey: item.idempotencyKey,
          action: item.action,
          payload: item.payload,
        });
        removeFromOfflineQueue(item.idempotencyKey);
      } catch {
        // Stop flushing on first failure — will retry on next reconnect
        break;
      }
    }

    setPendingCount(getOfflineQueue().length);
    setIsSyncing(false);
  }, [opts.isAuthenticated, isSyncing, opts.submitOfflineAction]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-flush on online event
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => void flushQueue();

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushQueue]);

  // Flush on mount if online
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void flushQueue();
    }
  }, [opts.isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isSyncing,
    pendingCount,
    flushQueue,
    clearQueue: clearOfflineQueue,
  };
}
