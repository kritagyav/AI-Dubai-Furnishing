import type { MiddlewareHandler } from "hono";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limit middleware — Upstash Redis sliding-window rate limiter.
 *
 * In production (when UPSTASH_REDIS_URL is set), uses @upstash/ratelimit
 * with a sliding window algorithm. In local dev (no UPSTASH_REDIS_URL),
 * falls back to an in-memory sliding window counter.
 */

// ─── In-Memory Fallback (Dev) ───

const cleanupIntervalMs = 5 * 60_000; // 5 minutes

function createInMemoryLimiter(maxReqs: number, windowMs: number) {
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

  return {
    limit(key: string) {
      const now = Date.now();

      if (now - lastCleanup > cleanupIntervalMs) {
        cleanupExpired(now);
      }

      let entry = hits.get(key);
      if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        hits.set(key, entry);
      }

      entry.count++;

      return {
        success: entry.count <= maxReqs,
        limit: maxReqs,
        remaining: Math.max(0, maxReqs - entry.count),
        reset: entry.resetAt,
      };
    },
  };
}

// ─── Types ───

type DurationUnit = "ms" | "s" | "m" | "h" | "d";
type Duration = `${number} ${DurationUnit}` | `${number}${DurationUnit}`;

interface RateLimitOptions {
  /** Maximum requests allowed in the window. Default: 100 */
  maxRequests?: number;
  /** Window duration string for Upstash (e.g. "60 s"). Default: "60 s" */
  window?: Duration;
  /** Window duration in ms for in-memory fallback. Default: 60_000 */
  windowMs?: number;
  /** Upstash rate limit prefix. Default: "dubai:edge-ratelimit" */
  prefix?: string;
}

// ─── Factory ───

let cachedRedis: Redis | null = null;

function getRedis(): Redis | null {
  if (cachedRedis) return cachedRedis;

  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;

  if (!url) return null;

  cachedRedis = token ? new Redis({ url, token }) : Redis.fromEnv();
  return cachedRedis;
}

/**
 * Create a rate limit middleware with custom options.
 *
 * Falls back to an in-memory implementation when UPSTASH_REDIS_URL
 * is not configured (local dev).
 */
export function createRateLimit(opts?: RateLimitOptions): MiddlewareHandler {
  const maxRequests = opts?.maxRequests ?? 100;
  const window: Duration = opts?.window ?? "60 s";
  const windowMs = opts?.windowMs ?? 60_000;
  const prefix = opts?.prefix ?? "dubai:edge-ratelimit";

  // Lazily initialised so env vars are read at request time, not import time
  let upstashLimiter: Ratelimit | null | undefined;
  let memoryLimiter: ReturnType<typeof createInMemoryLimiter> | undefined;

  function getLimiter() {
    if (upstashLimiter !== undefined || memoryLimiter !== undefined) {
      return { upstash: upstashLimiter, memory: memoryLimiter };
    }

    const redis = getRedis();
    if (redis) {
      upstashLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxRequests, window),
        analytics: true,
        prefix,
      });
      memoryLimiter = undefined;
    } else {
      upstashLimiter = null;
      memoryLimiter = createInMemoryLimiter(maxRequests, windowMs);
    }

    return { upstash: upstashLimiter, memory: memoryLimiter };
  }

  return async (c, next) => {
    const key =
      c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";

    const { upstash, memory } = getLimiter();

    if (upstash) {
      const { success, limit, remaining, reset } = await upstash.limit(key);

      c.header("X-RateLimit-Limit", limit.toString());
      c.header("X-RateLimit-Remaining", remaining.toString());
      c.header("X-RateLimit-Reset", reset.toString());

      if (!success) {
        return c.json({ error: "Too many requests" }, 429);
      }
    } else if (memory) {
      const { success, limit, remaining, reset } = memory.limit(key);

      c.header("X-RateLimit-Limit", limit.toString());
      c.header("X-RateLimit-Remaining", remaining.toString());
      c.header("X-RateLimit-Reset", reset.toString());

      if (!success) {
        return c.json({ error: "Too many requests" }, 429);
      }
    }

    await next();
  };
}

/**
 * Default rate limit middleware — 100 requests per 60 seconds.
 */
export const rateLimit: MiddlewareHandler = createRateLimit();
