import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DUMMY_AUTH_COOKIE } from "@/lib/dummy-auth";

const protectedPrefixes = [
  "/dashboard",
  "/coach",
  "/workouts",
  "/workout-plans",
  "/nutrition",
  "/progress",
  "/achievements",
  "/settings",
  "/onboarding",
];

const SESSION_COOKIE_NAMES = ["better-auth.session_token", "__Secure-better-auth.session_token", DUMMY_AUTH_COOKIE];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasSession = SESSION_COOKIE_NAMES.some((name) => Boolean(request.cookies.get(name)?.value));
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = pathname === "/login" || pathname === "/signup";

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
