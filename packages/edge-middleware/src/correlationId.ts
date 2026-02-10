import type { MiddlewareHandler } from "hono";

/**
 * Correlation ID middleware — generates a time-sortable correlation ID
 * and sets it as X-Correlation-ID response header (NFR-O1).
 *
 * Uses crypto.randomUUID() which is available in Edge Runtime.
 */
export const correlationId: MiddlewareHandler = async (c, next) => {
  const id =
    c.req.header("x-correlation-id") ??
    `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

  c.set("correlationId", id);
  c.header("X-Correlation-ID", id);

  await next();
};
