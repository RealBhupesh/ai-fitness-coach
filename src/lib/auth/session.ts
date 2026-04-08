import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";

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
  return auth.api.getSession({
    headers: requestHeaders,
  });
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
