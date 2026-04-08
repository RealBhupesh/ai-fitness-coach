import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { getDashboardSummary } from "@/lib/server/app-data";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    const summary = await getDashboardSummary(session.user.id);
    return NextResponse.json(summary);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
