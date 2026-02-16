"use client";

import { useEffect, useState } from "react";

import { cn } from "@dubai/ui";

export interface OfflineIndicatorProps {
  /** Number of pending offline actions */
  pendingCount?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Non-intrusive offline indicator — shows when network is unavailable.
 * Part of Story 1.9 cross-device continuity (offline state handling).
 */
export function OfflineIndicator({
  pendingCount = 0,
  className,
}: OfflineIndicatorProps) {
  const [isOffline, setIsOffline] = useState(
    typeof window !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200",
        className,
      )}
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-yellow-500" />
      <span>
        You&apos;re offline — changes will sync when you reconnect
        {pendingCount > 0 && (
          <span className="text-yellow-600 dark:text-yellow-400">
            {" "}
            ({pendingCount} pending)
          </span>
        )}
      </span>
    </div>
  );
}
