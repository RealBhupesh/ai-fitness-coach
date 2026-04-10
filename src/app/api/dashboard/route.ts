import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { getDashboardSummary } from "@/lib/server/app-data";

const EMPTY_DASHBOARD = {
  totalWorkouts: 0,
  totalCalories: 0,
  averageScore: 0,
  currentStreak: 0,
  recentSessions: [],
  weightTrend: [],
};

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id)) {
      return NextResponse.json(EMPTY_DASHBOARD);
    }
    const summary = await getDashboardSummary(session.user.id);
    return NextResponse.json(summary);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
