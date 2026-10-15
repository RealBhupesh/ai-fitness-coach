import { NextResponse } from "next/server";
import { reportEvent } from "@/lib/server/observability";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function readJson(request: Request, maxBytes = 512 * 1024): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Use application/json");
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request is too large");
  if (!request.body) throw new ApiError(400, "INVALID_JSON", "JSON body is required");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request is too large"); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "INVALID_JSON", "Malformed JSON body");
  } finally { reader.releaseLock(); }
}

export function apiError(error: unknown, request?: Request) {
  const requestId = request?.headers.get("x-request-id") || crypto.randomUUID();
  const known: Record<string, [number, string]> = { UNAUTHORIZED: [401, "Sign in to continue"], DATABASE_UNAVAILABLE: [503, "Database temporarily unavailable"], SERVICE_NOT_CONFIGURED: [503, "Service configuration is incomplete"] };
  const match = known[error instanceof Error ? error.message : ""];
  const status = error instanceof ApiError ? error.status : match?.[0] ?? 500;
  const code = error instanceof ApiError ? error.code : match ? (error as Error).message : "INTERNAL_ERROR";
  reportEvent("api_failure", { requestId, status, code });
  return NextResponse.json({ error: error instanceof ApiError ? error.message : match?.[1] ?? "Request failed. Please retry.", code, requestId }, { status, headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" } });
}

export function pagination(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = params.has("limit") ? Number(params.get("limit")) : 25;
  const offset = params.has("offset") ? Number(params.get("offset")) : 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 100000) throw new ApiError(400, "INVALID_PAGINATION", "Invalid page parameters");
  return { limit, offset };
}
