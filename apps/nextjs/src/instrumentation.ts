/* eslint-disable no-restricted-properties -- Instrumentation runs before env validation */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { createLogger } = await import("@dubai/shared/logger");
    const logger = createLogger("nextjs");
    logger.info("Next.js instrumentation registered");
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
