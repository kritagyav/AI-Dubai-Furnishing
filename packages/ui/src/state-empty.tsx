"use client";

import { cn } from "@dubai/ui";

import { Button } from "./button";

export interface EmptyStateProps {
  /** Contextual title for the empty state */
  title: string;
  /** Description of what the user can do */
  description: string;
  /** Call-to-action button label */
  actionLabel?: string;
  /** Callback when CTA is clicked */
  onAction?: () => void;
  /** Optional icon/illustration (render prop) */
  icon?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Contextual empty state — Story 1.11.
 * Shows when a screen has no data yet with a relevant message
 * and a clear call-to-action guiding the user to the next step.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className,
      )}
    >
      {icon && (
        <div className="text-muted-foreground mb-4" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-6">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
