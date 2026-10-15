import { NextResponse } from "next/server";
import { dbPool } from "@/db";
import { validateServerEnv } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!validateServerEnv().ok || !dbPool) return NextResponse.json({ ok: false, status: "unavailable" }, { status: 503 });
  try {
    await dbPool.query("select 1");
    return NextResponse.json({ ok: true, status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ ok: false, status: "unavailable" }, { status: 503 }); }
}
