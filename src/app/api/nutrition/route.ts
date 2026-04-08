import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { getNutritionOverview } from "@/lib/server/app-data";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    const overview = await getNutritionOverview(session.user.id);
    return NextResponse.json(overview);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
