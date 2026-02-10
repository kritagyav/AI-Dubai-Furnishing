import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% trace sampling in production, 100% in dev
  tracesSampleRate:
    process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
