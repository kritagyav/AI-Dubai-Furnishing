import { Hono } from "hono";

import { correlationId } from "./correlationId";
import { cors } from "./cors";
import { healthCheck } from "./healthCheck";
import { logging } from "./logging";
import { rateLimit } from "./rateLimit";
import { securityHeaders } from "./securityHeaders";
import { versioning } from "./versioning";

export type { MiddlewareHandler } from "hono";
export { Hono } from "hono";

/**
 * Creates a Hono app with the full edge middleware chain applied:
 * 1. Health check (short-circuits /health before other middleware)
 * 2. Security headers
 * 3. CORS enforcement
 * 4. Correlation ID generation
 * 5. Rate limiting
 * 6. API versioning headers
 * 7. Structured logging
 *
 * Usage in Next.js API route:
 *   const app = createEdgeApp();
 *   app.all("/api/trpc/*", trpcHandler);
 *   export const GET = app.fetch;
 *   export const POST = app.fetch;
 */
export function createEdgeApp() {
  const app = new Hono();

  app.use("*", healthCheck);
  app.use("*", securityHeaders);
  app.use("*", cors);
  app.use("*", correlationId);
  app.use("*", rateLimit);
  app.use("*", versioning);
  app.use("*", logging);

  return app;
}

export { correlationId } from "./correlationId";
export { cors } from "./cors";
export { healthCheck } from "./healthCheck";
export { logging } from "./logging";
export { createRateLimit, rateLimit } from "./rateLimit";
export { securityHeaders } from "./securityHeaders";
export { versioning } from "./versioning";
