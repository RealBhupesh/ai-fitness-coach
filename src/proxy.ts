import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { isClerkAuthEnabled, isDemoModeEnabled, isLegacyAuthEnabled } from "@/lib/env";
const protectedPrefixes = ["/dashboard", "/review-lab", "/profiles", "/coach", "/workouts", "/workout-plans", "/nutrition", "/progress", "/achievements", "/settings", "/onboarding"];
function responseFor(request: NextRequest, signedIn: boolean) {
  const path = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  const requestId = crypto.randomUUID();
  requestHeaders.set("x-request-id", requestId);
  const protectedPage = path !== "/review-lab/methodology" && protectedPrefixes.some(p => path === p || path.startsWith(p + "/"));
  const response = protectedPage && !signedIn ? (() => { const url = new URL(isClerkAuthEnabled() ? "/sign-in" : "/login", request.url); url.searchParams.set("next", path); return NextResponse.redirect(url); })() : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Request-ID", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  if (path.startsWith("/api/")) response.headers.set("Cache-Control", "no-store");
  return response;
}
function localSession(request: NextRequest) {
  return (isDemoModeEnabled() && Boolean(request.cookies.get("fitcoach_demo")?.value)) || (isLegacyAuthEnabled() && Boolean(request.cookies.get("better-auth.session_token")?.value || request.cookies.get("__Secure-better-auth.session_token")?.value));
}
const clerkProxy = clerkMiddleware(async (auth, request) => responseFor(request, Boolean((await auth()).userId) || localSession(request)));
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  return isClerkAuthEnabled() ? clerkProxy(request, event) : responseFor(request, localSession(request));
}
export const config = { matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"] };
