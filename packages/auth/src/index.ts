import { createClient } from "@supabase/supabase-js";

import { authEnv } from "../env";

export function createSupabaseClient() {
  const env = authEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createSupabaseServiceClient() {
  const env = authEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for service client");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
