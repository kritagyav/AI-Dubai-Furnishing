import { cors as honoCors } from "hono/cors";

/**
 * CORS middleware with strict origin allowlist from ALLOWED_ORIGINS env var.
 * Replaces the wildcard "*" CORS from the t3-turbo template.
 *
 * ALLOWED_ORIGINS should be a comma-separated list of origins:
 *   ALLOWED_ORIGINS=http://localhost:3000,https://dubai-furnishing.vercel.app
 *
 * Falls back to localhost:3000 + localhost:3001 in development.
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(",").map((o) => o.trim());
  }
  return ["http://localhost:3000", "http://localhost:3001"];
}

export const cors = honoCors({
  origin: getAllowedOrigins(),
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "X-Correlation-ID",
    "x-trpc-source",
  ],
  credentials: true,
  maxAge: 86400,
});
