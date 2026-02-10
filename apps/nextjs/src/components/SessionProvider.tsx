"use client";

/**
 * SessionProvider — integrates cross-device session continuity into the Next.js app.
 * Story 1.9: Registers device, tracks navigation, shows "Continue where you left off",
 * and syncs offline actions.
 */

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "@dubai/auth/hooks";
import {
  useDeviceSession,
  useOfflineSync,
  useResumableState,
} from "@dubai/auth/session-sync";
import { ContinueBanner, OfflineIndicator } from "@dubai/ui";

import { useTRPC } from "~/trpc/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const isAuthenticated = !loading && !!user;
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();

  // Device session registration
  const { sessionId, trackNavigation } = useDeviceSession({
    registerDevice: async (input) => {
      const result = await trpc.session.registerDevice.mutate(input);
      return result;
    },
    updateActivityState: async (input) => {
      const result = await trpc.session.updateActivityState.mutate(input);
      return result;
    },
    isAuthenticated,
  });

  // Track navigation changes (debounced)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    if (!isAuthenticated || !sessionId || !pathname) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      trackNavigation(pathname);
    }, 1000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [pathname, isAuthenticated, sessionId, trackNavigation]);

  // Resumable state from other devices
  const { resumable, dismiss } = useResumableState({
    getResumableState: async (input) => {
      const result = await trpc.session.getResumableState.query(input);
      return result;
    },
    sessionId,
    isAuthenticated,
  });

  // Offline sync
  const { pendingCount } = useOfflineSync({
    submitOfflineAction: async (input) => {
      const result = await trpc.session.submitOfflineAction.mutate(input);
      return result;
    },
    isAuthenticated,
  });

  const handleContinue = useCallback(
    (path: string) => {
      dismiss();
      router.push(path);
    },
    [dismiss, router],
  );

  return (
    <>
      <OfflineIndicator pendingCount={pendingCount} />
      {resumable && (
        <ContinueBanner
          deviceType={resumable.deviceType}
          deviceName={resumable.deviceName}
          lastActiveAt={resumable.lastActiveAt}
          path={resumable.path}
          onContinue={handleContinue}
          onDismiss={dismiss}
          className="mx-auto max-w-7xl px-4 mt-2"
        />
      )}
      {children}
    </>
  );
}
