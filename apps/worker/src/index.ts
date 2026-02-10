// Background Worker Process
// Processes BullMQ jobs for async operations:
// - AI package generation
// - Inventory sync
// - Delivery coordination
// - Notification dispatch

import { initSentry } from "./sentry";
import { logger } from "./logger";
import { startHealthServer } from "./health";

initSentry();

logger.info("Worker starting...");

startHealthServer();

// Worker implementation will be added in later stories
