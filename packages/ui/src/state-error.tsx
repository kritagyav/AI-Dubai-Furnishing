"use client";

import { cn } from "@dubai/ui";

import { Button } from "./button";

export interface ErrorStateProps {
  /** User-friendly error title */
  title?: string;
  /** Error description */
  message: string;
  /** Primary recovery action label */
  retryLabel?: string;
  /** Primary recovery action callback */
  onRetry?: () => void;
  /** Secondary action label */
  secondaryLabel?: string;
  /** Secondary action callback */
  onSecondary?: () => void;
  /** Correlation ID for support reference */
  correlationId?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Error state component — Story 1.11.
 * Shows a user-friendly error message with recovery actions.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  retryLabel = "Try again",
  onRetry,
  secondaryLabel,
  onSecondary,
  correlationId,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center px-4 py-12 text-center",
        className,
      )}
    >
      <div className="bg-destructive/10 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
        <span className="text-destructive text-xl" aria-hidden="true">
          !
        </span>
      </div>

      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
        {message}
      </p>

      <div className="mt-6 flex items-center gap-3">
        {onRetry && <Button onClick={onRetry}>{retryLabel}</Button>}
        {secondaryLabel && onSecondary && (
          <Button variant="outline" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        )}
      </div>

      {correlationId && (
        <p className="text-muted-foreground mt-6 text-xs">
          Reference: {correlationId}
        </p>
      )}
    </div>
  );
}
