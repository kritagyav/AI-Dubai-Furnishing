"use client";

import { cn } from "@dubai/ui";

// ═══════════════════════════════════════════
// 1. INLINE SPINNER — Short operations (<5s)
// ═══════════════════════════════════════════

export interface SpinnerProps {
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Accessible label */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

export function Spinner({ size = "md", label = "Loading", className }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-3",
  };

  return (
    <div role="status" aria-label={label} className={cn("inline-flex", className)}>
      <div
        className={cn(
          "border-muted-foreground/25 border-t-primary animate-spin rounded-full",
          sizeClasses[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════
// 2. SKELETON SCREEN — Medium operations (2-3min, e.g., room scanning)
// ═══════════════════════════════════════════

export interface SkeletonProps {
  /** Additional CSS classes */
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-muted animate-pulse rounded-md",
        className,
      )}
    />
  );
}

export interface SkeletonScreenProps {
  /** Number of skeleton rows */
  rows?: number;
  /** Show a header skeleton */
  header?: boolean;
  /** Progress message */
  message?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Skeleton screen for medium-duration operations.
 * Shows a contextual progress indication while keeping the UI layout visible.
 */
export function SkeletonScreen({
  rows = 3,
  header = true,
  message,
  className,
}: SkeletonScreenProps) {
  return (
    <div role="status" aria-label={message ?? "Loading content"} className={cn("space-y-4", className)}>
      {message && (
        <p className="text-muted-foreground text-sm">{message}</p>
      )}
      {header && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">{message ?? "Loading content"}</span>
    </div>
  );
}

// ═══════════════════════════════════════════
// 3. ENGAGING CONTENT — Long operations (~5min, e.g., AI generation)
// ═══════════════════════════════════════════

export interface EngagingWaitProps {
  /** Current progress step (0-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Step labels */
  steps: string[];
  /** Optional tips to rotate through */
  tips?: string[];
  /** Current tip index */
  currentTip?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Engaging wait screen for long AI operations.
 * Shows progress milestones and rotating tips/inspiration content.
 */
export function EngagingWait({
  currentStep,
  totalSteps,
  steps,
  tips,
  currentTip = 0,
  className,
}: EngagingWaitProps) {
  const progress = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

  return (
    <div
      role="status"
      aria-label={`Processing: ${steps[currentStep] ?? "working"}`}
      className={cn("flex flex-col items-center py-12 px-4 text-center", className)}
    >
      {/* Progress bar */}
      <div className="mb-6 w-full max-w-sm">
        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Step {currentStep + 1} of {totalSteps}
        </p>
      </div>

      {/* Current step */}
      <div className="mb-6 space-y-1">
        <Spinner size="lg" className="mb-3" />
        <p className="text-foreground font-medium">
          {steps[currentStep] ?? "Processing..."}
        </p>
      </div>

      {/* Step list */}
      <div className="mb-8 w-full max-w-xs space-y-2 text-left">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-2 text-sm">
            {i < currentStep ? (
              <span className="text-primary text-xs">&#x2713;</span>
            ) : i === currentStep ? (
              <Spinner size="sm" />
            ) : (
              <span className="text-muted-foreground/50 text-xs">&#x25CB;</span>
            )}
            <span
              className={cn(
                i < currentStep
                  ? "text-muted-foreground line-through"
                  : i === currentStep
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/60",
              )}
            >
              {step}
            </span>
          </div>
        ))}
      </div>

      {/* Rotating tips */}
      {tips && tips.length > 0 && (
        <div className="bg-accent/50 max-w-sm rounded-lg p-4">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Did you know?
          </p>
          <p className="text-foreground mt-1 text-sm">
            {tips[currentTip % tips.length]}
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// 4. QUEUED OPERATION — Extended wait (30+ min, e.g., human review)
// ═══════════════════════════════════════════

export interface QueuedWaitProps {
  /** Title of the queued operation */
  title: string;
  /** Description of what's happening */
  description: string;
  /** Estimated time */
  estimatedTime?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Queued operation wait — for extended operations (30+ minutes).
 * Informs the user they'll be notified when complete and can safely leave.
 */
export function QueuedWait({
  title,
  description,
  estimatedTime,
  className,
}: QueuedWaitProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center py-12 px-4 text-center",
        className,
      )}
    >
      <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        <span className="text-2xl" aria-hidden="true">
          &#x1F514;
        </span>
      </div>
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
        {description}
      </p>
      {estimatedTime && (
        <p className="text-muted-foreground mt-1 text-xs">
          Estimated time: {estimatedTime}
        </p>
      )}
      <p className="text-primary mt-4 text-sm font-medium">
        We&apos;ll notify you when it&apos;s ready. You can safely leave this page.
      </p>
    </div>
  );
}
