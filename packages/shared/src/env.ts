import { z } from "zod/v4";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  CHECKOUT_COM_SECRET_KEY: z.string(),
  BULLMQ_REDIS_URL: z.string().url(),
  UPSTASH_REDIS_URL: z.string().url(),
  AI_SERVICE_URL: z.string().url(),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url(),
  NEXT_PUBLIC_MIXPANEL_TOKEN: z.string(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

export const serverEnv = serverEnvSchema;
export const clientEnv = clientEnvSchema;
