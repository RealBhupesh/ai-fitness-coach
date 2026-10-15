import { apiError } from "@/lib/server/api";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { getNutritionOverview } from "@/lib/server/app-data";
import { getDemoNutritionPlanFromCookie, isDemoUser } from "@/lib/dummy-auth";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id)) {
      const plan = getDemoNutritionPlanFromCookie<Record<string, unknown>>(request.headers.get("cookie") || "");
      return NextResponse.json({ plan, todaysFood: [] });
    }
    const overview = await getNutritionOverview(session.user.id);
    return NextResponse.json(overview);
  } catch (error) {
    return apiError(error, request);
  }
}
