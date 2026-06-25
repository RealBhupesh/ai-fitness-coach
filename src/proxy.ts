import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isDemoModeEnabled } from "@/lib/env";

const protectedPrefixes = [
  "/dashboard",
  "/review-lab",
  "/profiles",
  "/coach",
  "/workouts",
  "/workout-plans",
  "/nutrition",
  "/progress",
  "/achievements",
  "/settings",
  "/onboarding",
];

const SESSION_COOKIE_NAMES = ["better-auth.session_token", "__Secure-better-auth.session_token", "__session", "__client_uat"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasRealSession = SESSION_COOKIE_NAMES.some((name) => Boolean(request.cookies.get(name)?.value));
  const hasDemoSession = isDemoModeEnabled() && Boolean(request.cookies.get("fitcoach_demo")?.value);
  const hasSession = hasRealSession || hasDemoSession;
  const isPublicReviewMethodology = pathname === "/review-lab/methodology";
  const isProtected = !isPublicReviewMethodology && protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = pathname === "/login" || pathname === "/signup" || pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  if (isProtected && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next|favicon.ico|.*\\..*).*)"],
};
