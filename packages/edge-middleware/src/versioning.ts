import type { MiddlewareHandler } from "hono";

/**
 * API versioning middleware — sets X-API-Version header for
 * mobile backward compatibility (NFR-I4).
 */
export const API_VERSION = "1.0.0";

export const versioning: MiddlewareHandler = async (c, next) => {
  c.header("X-API-Version", API_VERSION);
  await next();
};
