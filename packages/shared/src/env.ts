import { z } from "zod/v4";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  CHECKOUT_COM_SECRET_KEY: z.string(),
  BULLMQ_REDIS_URL: z.string().url(),
  UPSTASH_REDIS_URL: z.string().url(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),
  AI_SERVICE_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  WEBHOOK_SIGNING_SECRET: z.string().optional(),
  BANK_PAYOUT_API_KEY: z.string().optional(),
  BANK_PAYOUT_API_URL: z.string().url().optional(),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_MIXPANEL_TOKEN: z.string().optional(),
  NEXT_PUBLIC_CHECKOUT_COM_PUBLIC_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

export const serverEnv = serverEnvSchema;
export const clientEnv = clientEnvSchema;
