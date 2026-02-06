import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

import { env } from "~/env";

export function createSupabaseServerClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export const getSession = cache(async () => {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
});
