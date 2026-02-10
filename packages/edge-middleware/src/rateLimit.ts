import type { MiddlewareHandler } from "hono";

/**
 * Rate limit middleware — stub implementation for development.
 * Actual Upstash Redis rate limiter will be added in Story 1.7.
 *
 * Uses an in-memory sliding window counter for local dev.
 */

const windowMs = 60_000; // 1 minute
const maxRequests = 100;
const cleanupIntervalMs = 5 * 60_000; // 5 minutes

const hits = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();

function cleanupExpired(now: number) {
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) {
      hits.delete(key);
    }
  }
  lastCleanup = now;
}

export const rateLimit: MiddlewareHandler = async (c, next) => {
  const key =
    c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";
  const now = Date.now();

  // Periodic cleanup to prevent unbounded Map growth
  if (now - lastCleanup > cleanupIntervalMs) {
    cleanupExpired(now);
  }

  let entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    hits.set(key, entry);
  }

  entry.count++;

  c.header("X-RateLimit-Limit", maxRequests.toString());
  c.header(
    "X-RateLimit-Remaining",
    Math.max(0, maxRequests - entry.count).toString(),
  );

  if (entry.count > maxRequests) {
    return c.json({ error: "Too many requests" }, 429);
  }

  await next();
};
