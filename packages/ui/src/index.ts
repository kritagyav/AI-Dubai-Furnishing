import { cx } from "class-variance-authority";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: Parameters<typeof cx>) => twMerge(cx(inputs));

// Zone system
export { ZoneProvider, useZone } from "./zones";
export type { ZoneName } from "./zones";

// Session continuity (Story 1.9)
export { ContinueBanner } from "./continue-banner";
export type { ContinueBannerProps } from "./continue-banner";
export { OfflineIndicator } from "./offline-indicator";
export type { OfflineIndicatorProps } from "./offline-indicator";

// Contextual state system (Story 1.11)
export { EmptyState } from "./state-empty";
export type { EmptyStateProps } from "./state-empty";
export { ErrorState } from "./state-error";
export type { ErrorStateProps } from "./state-error";
export {
  EngagingWait,
  QueuedWait,
  Skeleton,
  SkeletonScreen,
  Spinner,
} from "./state-loading";
export type {
  EngagingWaitProps,
  QueuedWaitProps,
  SkeletonProps,
  SkeletonScreenProps,
  SpinnerProps,
} from "./state-loading";
