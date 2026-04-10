import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";
import { hasDemoCookie, buildDemoServerSession } from "@/lib/dummy-auth";

type RequestLike = NextRequest | Request | Headers | undefined;

function toHeaders(source?: RequestLike): Headers {
  if (!source) {
    return new Headers();
  }
  if (source instanceof Headers) {
    return source;
  }
  if ("headers" in source) {
    return new Headers(source.headers);
  }
  return new Headers();
}

export async function getServerSession(source?: RequestLike) {
  const requestHeaders = source ? toHeaders(source) : new Headers(await headers());

  try {
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (session?.user?.id) return session;
  } catch {}

  const cookieHeader = requestHeaders.get("cookie") || "";
  if (hasDemoCookie(cookieHeader)) {
    return buildDemoServerSession() as any;
  }

  return null;
}

export async function requireServerSession(source?: RequestLike) {
  const session = await getServerSession(source);
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export function hasSessionCookie(source: RequestLike) {
  const requestHeaders = toHeaders(source);
  return Boolean(getSessionCookie(requestHeaders));
}
