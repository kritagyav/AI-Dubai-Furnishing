"use client";

import { cn } from "@dubai/ui";

import { Button } from "./button";

export interface ContinueBannerProps {
  /** Device type where the previous session was active */
  deviceType: string | null;
  /** Friendly device name */
  deviceName: string | null;
  /** When the other device was last active */
  lastActiveAt: Date;
  /** Path to navigate to for resuming */
  path: string;
  /** Called when user clicks "Continue" */
  onContinue: (path: string) => void;
  /** Called when user dismisses the banner */
  onDismiss: () => void;
  /** Additional CSS classes */
  className?: string;
}

function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return "yesterday";
}

function getDeviceIcon(deviceType: string | null): string {
  switch (deviceType) {
    case "mobile":
      return "\u{1F4F1}"; // phone emoji as fallback — replace with icon component
    case "tablet":
      return "\u{1F4CB}";
    default:
      return "\u{1F4BB}";
  }
}

/**
 * Banner that appears when the user has an active session on another device.
 * Powers the "Continue where you left off" cross-device handoff (Story 1.9).
 */
export function ContinueBanner({
  deviceType,
  deviceName,
  lastActiveAt,
  path,
  onContinue,
  onDismiss,
  className,
}: ContinueBannerProps) {
  const device = deviceName ?? deviceType ?? "another device";
  const icon = getDeviceIcon(deviceType);
  const timeAgo = formatTimeAgo(lastActiveAt);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "bg-accent/50 border-border flex items-center justify-between gap-3 rounded-lg border p-3",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg shrink-0" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-foreground text-sm font-medium truncate">
            Continue where you left off
          </p>
          <p className="text-muted-foreground text-xs truncate">
            Active on {device} {timeAgo}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
        <Button size="sm" onClick={() => onContinue(path)}>
          Continue
        </Button>
      </div>
    </div>
  );
}
