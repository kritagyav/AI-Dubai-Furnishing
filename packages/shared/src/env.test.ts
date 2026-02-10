import { describe, expect, it } from "vitest";
import { serverEnv, clientEnv } from "./env";

describe("serverEnv schema", () => {
  it("accepts valid server environment variables", () => {
    const result = serverEnv.safeParse({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
      CHECKOUT_COM_SECRET_KEY: "sk_test_123",
      BULLMQ_REDIS_URL: "redis://localhost:6379",
      UPSTASH_REDIS_URL: "redis://localhost:6380",
      AI_SERVICE_URL: "http://localhost:8000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing DATABASE_URL", () => {
    const result = serverEnv.safeParse({
      SUPABASE_SERVICE_ROLE_KEY: "key",
      CHECKOUT_COM_SECRET_KEY: "key",
      BULLMQ_REDIS_URL: "redis://localhost:6379",
      UPSTASH_REDIS_URL: "redis://localhost:6380",
      AI_SERVICE_URL: "http://localhost:8000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid DATABASE_URL format", () => {
    const result = serverEnv.safeParse({
      DATABASE_URL: "not-a-url",
      SUPABASE_SERVICE_ROLE_KEY: "key",
      CHECKOUT_COM_SECRET_KEY: "key",
      BULLMQ_REDIS_URL: "redis://localhost:6379",
      UPSTASH_REDIS_URL: "redis://localhost:6380",
      AI_SERVICE_URL: "http://localhost:8000",
    });
    expect(result.success).toBe(false);
  });
});

describe("clientEnv schema", () => {
  it("accepts valid client environment variables", () => {
    const result = clientEnv.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-123",
      NEXT_PUBLIC_SENTRY_DSN: "https://abc@sentry.io/123",
      NEXT_PUBLIC_MIXPANEL_TOKEN: "mp-token-456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = clientEnv.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid SUPABASE_URL format", () => {
    const result = clientEnv.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "key",
      NEXT_PUBLIC_SENTRY_DSN: "https://sentry.io",
      NEXT_PUBLIC_MIXPANEL_TOKEN: "token",
    });
    expect(result.success).toBe(false);
  });
});
