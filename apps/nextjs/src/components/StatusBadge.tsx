"use client";

import { cn } from "@dubai/ui";

/**
 * Maps status strings to semantic token-based classes.
 * Replaces the 5+ duplicated `statusColors` maps across pages.
 */
const STATUS_VARIANT_MAP: Record<string, string> = {
  // Order statuses
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_PAYMENT: "bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]",
  PAID: "bg-[var(--color-info-light)] text-[var(--color-info-dark)]",
  PROCESSING: "bg-accent text-accent-foreground",
  SHIPPED: "bg-accent text-accent-foreground",
  DELIVERED: "bg-[var(--color-success-light)] text-[var(--color-success-dark)]",
  CANCELLED: "bg-[var(--color-error-light)] text-[var(--color-error-dark)]",
  REFUNDED: "bg-muted text-muted-foreground",

  // Package statuses
  GENERATING: "bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]",
  READY: "bg-[var(--color-info-light)] text-[var(--color-info-dark)]",
  ACCEPTED: "bg-[var(--color-success-light)] text-[var(--color-success-dark)]",
  REJECTED: "bg-[var(--color-error-light)] text-[var(--color-error-dark)]",
  EXPIRED: "bg-muted text-muted-foreground",

  // Support ticket statuses
  OPEN: "bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]",
  IN_PROGRESS: "bg-[var(--color-info-light)] text-[var(--color-info-dark)]",
  WAITING_ON_CUSTOMER: "bg-accent text-accent-foreground",
  RESOLVED: "bg-[var(--color-success-light)] text-[var(--color-success-dark)]",
  CLOSED: "bg-muted text-muted-foreground",

  // Retailer statuses
  ACTIVE: "bg-[var(--color-success-light)] text-[var(--color-success-dark)]",
  PENDING: "bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]",
  APPROVED: "bg-[var(--color-success-light)] text-[var(--color-success-dark)]",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_VARIANT_MAP[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
