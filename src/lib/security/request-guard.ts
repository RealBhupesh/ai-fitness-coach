import { NextResponse } from "next/server";
import { getTrustedOrigins } from "@/lib/env";

type MutationGuardOptions = { bucket: string; key: string; limit: number; windowMs: number };
const local = new Map<string, { count: number; resetAt: number }>();
const SCRIPT = `local n = redis.call('INCRBY', KEYS[1], ARGV[2]); if n == tonumber(ARGV[2]) then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end; return {n, redis.call('PTTL', KEYS[1])}`;

export function getRequestIp(request: Request) {
  return process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() || "unknown" : "local";
}

export async function consumeLimit(key: string, limit: number, windowMs: number, units = 1) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(["EVAL", SCRIPT, "1", `fitcoach:${key}`, String(windowMs), String(units)]), signal: AbortSignal.timeout(1500), cache: "no-store" });
    if (!response.ok) throw new Error("QUOTA_UNAVAILABLE");
    const payload = await response.json();
    if (payload.error || !Array.isArray(payload.result) || payload.result.length !== 2 || payload.result.some((n: unknown) => typeof n !== "number" || !Number.isFinite(n))) throw new Error("QUOTA_UNAVAILABLE");
    return { allowed: payload.result[0] <= limit, retryAfterMs: Math.max(1, payload.result[1]) };
  }
  if (process.env.NODE_ENV === "production") throw new Error("QUOTA_UNAVAILABLE");
  const now = Date.now();
  if (local.size > 1000) for (const [k, v] of local) if (v.resetAt <= now) local.delete(k);
  const state = local.get(key);
  const next = !state || state.resetAt <= now ? { count: units, resetAt: now + windowMs } : { ...state, count: state.count + units };
  local.set(key, next);
  return { allowed: next.count <= limit, retryAfterMs: next.resetAt - now };
}

function limited(retryAfterMs: number) {
  return NextResponse.json({ error: "Request limit reached. Try again later.", code: "RATE_LIMITED", retryAfterMs }, { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } });
}

export async function guardMutationRequest(request: Request, options: MutationGuardOptions) {
  const origin = request.headers.get("origin");
  if ((!origin && process.env.NODE_ENV === "production" && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) || (origin && !getTrustedOrigins().includes(origin))) return NextResponse.json({ error: "Origin not allowed", code: "ORIGIN_NOT_ALLOWED" }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 512 * 1024) return NextResponse.json({ error: "Request is too large", code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  try {
    const result = await consumeLimit(`${options.bucket}:${options.key}`, options.limit, options.windowMs);
    if (!result.allowed) return limited(result.retryAfterMs);
    const daily = ({ chat: 20, "generate-workout-plan": 2, "generate-nutrition-plan": 2, "coach-summarize": 5, "coach-feedback": 30 } as Record<string, number>)[options.bucket];
    if (daily) {
      const quota = await consumeLimit(`daily:${new Date().toISOString().slice(0, 10)}:${options.bucket}:${options.key}`, daily, 86400000);
      if (!quota.allowed) return limited(quota.retryAfterMs);
    }
    return null;
  } catch {
    return NextResponse.json({ error: "Request limits temporarily unavailable. Please retry.", code: "QUOTA_UNAVAILABLE" }, { status: 503 });
  }
}
