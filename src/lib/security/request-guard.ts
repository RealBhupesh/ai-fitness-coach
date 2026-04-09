import { NextResponse } from "next/server";
import { getTrustedOrigins } from "@/lib/env";

type MutationGuardOptions = {
  bucket: string;
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

declare global {
  var __fitcoachRateLimitStore: Map<string, RateLimitState> | undefined;
}

const rateLimitStore = globalThis.__fitcoachRateLimitStore ?? new Map<string, RateLimitState>();

if (process.env.NODE_ENV !== "production") {
  globalThis.__fitcoachRateLimitStore = rateLimitStore;
}

export function getRequestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function enforceTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }

  const trustedOrigins = getTrustedOrigins();
  if (!trustedOrigins.includes(origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  return null;
}

function enforceRateLimit({ bucket, key, limit, windowMs }: MutationGuardOptions) {
  const now = Date.now();
  const storeKey = `${bucket}:${key}`;
  const existing = rateLimitStore.get(storeKey);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(storeKey, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (existing.count >= limit) {
    return NextResponse.json(
      {
        error: "Too many requests",
        retryAfterMs: Math.max(0, existing.resetAt - now),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((existing.resetAt - now) / 1000)),
        },
      },
    );
  }

  existing.count += 1;
  rateLimitStore.set(storeKey, existing);
  return null;
}

export function guardMutationRequest(request: Request, options: MutationGuardOptions) {
  const originFailure = enforceTrustedOrigin(request);
  if (originFailure) {
    return originFailure;
  }

  return enforceRateLimit(options);
}
