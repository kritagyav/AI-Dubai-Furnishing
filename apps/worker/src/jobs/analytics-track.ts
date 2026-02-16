import type { AnalyticsTrackPayload } from "@dubai/queue";

import { logger } from "../logger";

/**
 * Analytics Track Job — processes analytics events.
 *
 * In production, this would forward events to an analytics service
 * (e.g., Segment, Mixpanel, BigQuery). Currently logs events for
 * observability and future aggregation.
 */
export function handleAnalyticsTrack(payload: AnalyticsTrackPayload): void {
  const log = logger.child({ job: "analytics.track", event: payload.event });

  log.info(
    {
      userId: payload.userId,
      event: payload.event,
      properties: payload.properties,
      timestamp: payload.timestamp,
    },
    "Analytics event tracked",
  );
}
