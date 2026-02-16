import type { MiddlewareHandler } from "hono";

/**
 * Pino-compatible numeric log levels for edge runtime.
 * Pino cannot run in Edge Runtime, so we emit structured JSON
 * with matching numeric levels for seamless Axiom aggregation.
 */
const LEVELS = { info: 30, warn: 40, error: 50 } as const;

/**
 * Structured JSON request/response logging middleware.
 * Edge-safe — uses console.log with Pino-compatible JSON format.
 */
export const logging: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const correlationId =
    (c.get("correlationId") as string | undefined) ?? "unknown";
  const userAgent = c.req.header("user-agent") ?? "unknown";

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;
  const levelName = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  console.log(
    JSON.stringify({
      level: LEVELS[levelName],
      levelName,
      msg: `${method} ${path}`,
      service: "edge-middleware",
      method,
      path,
      status,
      duration,
      correlationId,
      userAgent,
      time: new Date().toISOString(),
    }),
  );
};
