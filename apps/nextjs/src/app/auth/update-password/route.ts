import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { env } from "~/env";

/**
 * Password reset callback route handler.
 *
 * Supabase redirects here when a user clicks the reset-password link in
 * their email.  We exchange the authorization `code` for a session, persist
 * the session cookies, and send the user to the /update-password page where
 * they can enter a new password.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/update-password", request.url));
    }
  }

  // If no code or exchange failed, redirect to login with error
  return NextResponse.redirect(
    new URL("/login?error=oauth_failed", request.url),
  );
}
