import { NextResponse } from "next/server";
import { dbPool } from "@/db";
import { validateServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const envState = validateServerEnv();

  try {
    await dbPool.query("select 1");

    return NextResponse.json({
      ok: envState.ok,
      database: "connected",
      env: envState.ok ? "configured" : envState.invalid.length > 0 ? "invalid" : "missing",
      missing: envState.missing,
      invalid: envState.invalid,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: "disconnected",
        env: envState.ok ? "configured" : envState.invalid.length > 0 ? "invalid" : "missing",
        missing: envState.missing,
        invalid: envState.invalid,
        error: error instanceof Error ? error.message : "Database connectivity check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
