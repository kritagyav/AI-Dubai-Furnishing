/**
 * tRPC server initialization and procedure hierarchy.
 *
 * Defines the context, middleware chain, and pre-built procedure types
 * per architecture decisions AC-1 through AC-4 and AS-2 (Three-Layer RBAC).
 *
 * Rule: Every tRPC router uses these pre-built procedures.
 * No custom auth logic in individual routers.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { initTRPC, TRPCError } from "@trpc/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import superjson from "superjson";
import { z, ZodError } from "zod/v4";

import type { PrismaClient } from "@dubai/db";
import { prisma, scopedClient } from "@dubai/db";

import { writeAuditLog } from "./audit";

// ═══════════════════════════════════════════
// 1. CONTEXT
// ═══════════════════════════════════════════

export const createTRPCContext = async (opts: {
  headers: Headers;
  supabase: SupabaseClient;
  correlationId?: string;
}) => {
  const {
    data: { session },
  } = await opts.supabase.auth.getSession();

  const source = opts.headers.get("x-trpc-source") ?? "unknown";

  return {
    supabase: opts.supabase,
    session,
    headers: opts.headers,
    db: prisma,
    source,
    correlationId: opts.correlationId,
  };
};

// ═══════════════════════════════════════════
// 2. INITIALIZATION
// ═══════════════════════════════════════════

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error, ctx }) => ({
    ...shape,
    data: {
      ...shape.data,
      correlationId:
        (ctx as Record<string, unknown> | undefined)?.correlationId ??
        "unknown",
      zodError:
        error.cause instanceof ZodError
          ? z.flattenError(error.cause as ZodError<Record<string, unknown>>)
          : null,
    },
  }),
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

// ═══════════════════════════════════════════
// 3. MIDDLEWARE
// ═══════════════════════════════════════════

/**
 * Correlation ID middleware — generates a time-sortable correlation ID
 * for request tracing across logs and error responses (NFR-O1).
 *
 * Format: `{base36-timestamp}-{uuid-slice}` — sortable by timestamp
 * prefix, unique via crypto.randomUUID() suffix.
 */
const correlationIdMiddleware = t.middleware(async ({ next }) => {
  const correlationId = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

  return next({
    ctx: { correlationId },
  });
});

/**
 * Rate limit middleware — Upstash Redis sliding-window rate limiter.
 *
 * Limits: 60 requests per 60-second window per user (or IP for public).
 * Falls back to pass-through if UPSTASH_REDIS_URL is not configured.
 */
let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;

  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;

  if (!url || !token || url.includes("placeholder")) {
    return null;
  }

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(60, "60 s"),
    analytics: true,
    prefix: "dubai:ratelimit",
  });

  return ratelimit;
}

const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  const limiter = getRatelimit();

  if (limiter) {
    const identifier =
      ctx.session?.user.id ??
      ctx.headers.get("x-forwarded-for") ??
      ctx.headers.get("x-real-ip") ??
      "anonymous";

    const { success, limit, remaining, reset } =
      await limiter.limit(identifier);

    if (!success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Try again in ${Math.ceil((reset - Date.now()) / 1000)}s`,
      });
    }

    return next({
      ctx: { rateLimit: { limit, remaining, reset } },
    });
  }

  return next();
});

/**
 * Auth middleware — verifies Supabase session and resolves the
 * application User from Prisma by supabaseAuthId. Sets ctx.user
 * with role and tenantId from the database record.
 */
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  const dbUser = await ctx.db.user.findUnique({
    where: { supabaseAuthId: ctx.session.user.id },
    select: { id: true, role: true, tenantId: true, email: true, name: true },
  });

  if (!dbUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User record not found",
    });
  }

  return next({
    ctx: {
      user: {
        id: dbUser.id,
        supabaseId: ctx.session.user.id,
        role: dbUser.role,
        tenantId: dbUser.tenantId,
        email: dbUser.email,
        name: dbUser.name,
      },
    },
  });
});

/**
 * Tenant middleware factory — verifies the authenticated user has
 * the required tenant role type and extracts tenantId.
 *
 * @param tenantType - "retailer" or "corporate"
 */
function tenantMiddleware(tenantType: "retailer" | "corporate") {
  const allowedRoles: Record<string, string[]> = {
    retailer: ["RETAILER_ADMIN", "RETAILER_STAFF"],
    corporate: ["CORPORATE_ADMIN", "CORPORATE_EMPLOYEE"],
  };

  return t.middleware(async ({ ctx, next }) => {
    const user = (ctx as Record<string, unknown>).user as {
      id: string;
      role: string;
      tenantId: string | null;
    };

    if (!allowedRoles[tenantType]?.includes(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `${tenantType} access required`,
      });
    }

    if (!user.tenantId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `No tenant association for ${tenantType} user`,
      });
    }

    return next({
      ctx: { tenantId: user.tenantId },
    });
  });
}

/**
 * Scoped DB middleware — replaces ctx.db with a tenant-scoped
 * Prisma client that automatically filters by tenantId (DA-1).
 */
const scopedDbMiddleware = t.middleware(async ({ ctx, next }) => {
  const tenantId = (ctx as Record<string, unknown>).tenantId as string;

  return next({
    ctx: { db: scopedClient(tenantId) as unknown as PrismaClient },
  });
});

/**
 * Corporate-scoped DB middleware — same as scopedDbMiddleware but scopes
 * on "corporateAccountId" instead of "retailerId" for corporate models.
 */
const corporateScopedDbMiddleware = t.middleware(async ({ ctx, next }) => {
  const tenantId = (ctx as Record<string, unknown>).tenantId as string;

  return next({
    ctx: {
      db: scopedClient(
        tenantId,
        "corporateAccountId",
      ) as unknown as PrismaClient,
    },
  });
});

/**
 * Role middleware factory — restricts access to specific roles.
 *
 * @param allowedRoles - Array of UserRole values that can access the procedure
 */
function roleMiddleware(allowedRoles: string[]) {
  return t.middleware(async ({ ctx, next }) => {
    const user = (ctx as Record<string, unknown>).user as {
      id: string;
      role: string;
    };

    if (!allowedRoles.includes(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      });
    }

    return next();
  });
}

// ═══════════════════════════════════════════
// 4. PROCEDURE HIERARCHY
// ═══════════════════════════════════════════

/**
 * Public procedure — no authentication required.
 * Includes correlation ID and rate limiting middleware.
 */
export const publicProcedure = t.procedure
  .use(correlationIdMiddleware)
  .use(rateLimitMiddleware);

/**
 * Authenticated procedure — requires valid Supabase session.
 * Sets ctx.user with role, tenantId, email, name.
 */
export const authedProcedure = publicProcedure.use(authMiddleware);

/**
 * Retailer procedure — requires RETAILER_ADMIN or RETAILER_STAFF role.
 * Sets ctx.tenantId and ctx.db = scopedClient(tenantId).
 */
export const retailerProcedure = authedProcedure
  .use(tenantMiddleware("retailer"))
  .use(scopedDbMiddleware);

/**
 * Corporate procedure — requires CORPORATE_ADMIN or CORPORATE_EMPLOYEE role.
 * Sets ctx.tenantId and ctx.db = scopedClient(tenantId).
 */
export const corporateProcedure = authedProcedure
  .use(tenantMiddleware("corporate"))
  .use(corporateScopedDbMiddleware);

/**
 * Admin procedure — requires PLATFORM_ADMIN role.
 */
export const adminProcedure = authedProcedure.use(
  roleMiddleware(["PLATFORM_ADMIN"]),
);

/**
 * Support procedure — requires SUPPORT_AGENT or PLATFORM_ADMIN role.
 */
export const supportProcedure = authedProcedure.use(
  roleMiddleware(["SUPPORT_AGENT", "PLATFORM_ADMIN"]),
);

/**
 * Agent procedure — requires AGENT role.
 */
export const agentProcedure = authedProcedure.use(roleMiddleware(["AGENT"]));

/**
 * Audit middleware — automatically captures audit logs for admin actions.
 * Expects the procedure input to include `resourceType` and `resourceId`.
 */
const auditMiddleware = t.middleware(async ({ ctx, next, path }) => {
  const result = await next();

  const user = (ctx as Record<string, unknown>).user as
    | {
        id: string;
        role: string;
      }
    | undefined;

  if (user) {
    const correlationId = (ctx as Record<string, unknown>).correlationId as
      | string
      | undefined;

    try {
      await writeAuditLog(ctx.db, {
        actorId: user.id,
        actorRole: user.role,
        action: path,
        resourceType: path.split(".")[0] ?? "unknown",
        resourceId: "unknown",
        correlationId: correlationId,
      });
    } catch {
      // Audit log write failure should not break the request
    }
  }

  return result;
});

/**
 * Audited procedure — admin procedure with automatic audit logging.
 * Use for sensitive admin operations that need an audit trail.
 */
export const auditedProcedure = adminProcedure.use(auditMiddleware);
