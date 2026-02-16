import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "@dubai/auth/middleware";

const PROTECTED_ROUTES = [
  "/settings",
  "/dashboard",
  "/onboarding",
  "/projects",
  "/retailer",
  "/cart",
  "/checkout",
  "/orders",
  "/support",
  "/saved",
];
const AUTH_ROUTES = [
  "/login",
  "/register",
  "/verify-email",
  "/reset-password",
  "/update-password",
  "/mfa-challenge",
];

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users away from protected routes
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth routes
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
