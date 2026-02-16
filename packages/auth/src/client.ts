import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

let client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase browser client configured with @supabase/ssr
 * for automatic cookie-based session management.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;

  /* eslint-disable no-restricted-properties -- Browser client reads public env vars inlined at build time */
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  /* eslint-enable no-restricted-properties */

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  client = createBrowserClient(url, key) as SupabaseClient;
  return client;
}
