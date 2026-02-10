import type { MiddlewareHandler } from "hono";

/**
 * Security headers middleware.
 * Applies OWASP-recommended response headers to all responses.
 * HSTS is only applied in production to avoid issues with local dev.
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  // Only apply HSTS in production
  const isProduction =
    c.req.header("x-forwarded-proto") === "https" ||
    c.req.url.startsWith("https://");
  if (isProduction) {
    c.header(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
};
