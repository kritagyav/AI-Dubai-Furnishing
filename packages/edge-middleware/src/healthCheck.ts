import type { MiddlewareHandler } from "hono";

import { API_VERSION } from "./versioning";

export const healthCheck: MiddlewareHandler = async (c, next) => {
  if (c.req.path === "/health" || c.req.path === "/api/health") {
    return c.json({
      status: "ok",
      version: API_VERSION,
      timestamp: new Date().toISOString(),
    });
  }
  await next();
};
