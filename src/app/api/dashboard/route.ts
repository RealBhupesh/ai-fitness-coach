import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { DEMO_DASHBOARD_SUMMARY } from "@/lib/demo-performance";
import { getDashboardSummary } from "@/lib/server/app-data";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id)) {
      return NextResponse.json(DEMO_DASHBOARD_SUMMARY);
    }
    const summary = await getDashboardSummary(session.user.id);
    return NextResponse.json({
      ...summary,
      communityLeaderboard: DEMO_DASHBOARD_SUMMARY.communityLeaderboard,
      featuredAchievements: summary.totalWorkouts === 0 ? DEMO_DASHBOARD_SUMMARY.featuredAchievements : undefined,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
