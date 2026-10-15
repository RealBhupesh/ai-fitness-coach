import { apiError } from "@/lib/server/api";
import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { DEMO_DASHBOARD_SUMMARY } from "@/lib/demo-performance";
import { loadPrimaryDanceRoutinePack } from "@/lib/dance/routine-pack";
import { buildHipHopTutorial } from "@/lib/dance/training-engine";
import { getDashboardSummary } from "@/lib/server/app-data";
import { getDanceCourseState } from "@/lib/server/dance-course";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id)) {
      return NextResponse.json(DEMO_DASHBOARD_SUMMARY);
    }
    const summary = await getDashboardSummary(session.user.id);
    const danceCourse = await loadPrimaryDanceRoutinePack()
      .then((routine) => getDanceCourseState(session.user.id, { ...routine, tutorial: routine.tutorial?.length ? routine.tutorial : buildHipHopTutorial(routine) }))
      .catch(() => null);
    return NextResponse.json({
      ...summary,
      communityLeaderboard: danceCourse?.leaderboard ?? DEMO_DASHBOARD_SUMMARY.communityLeaderboard,
      featuredAchievements: summary.totalWorkouts === 0 ? DEMO_DASHBOARD_SUMMARY.featuredAchievements : undefined,
    });
  } catch (error) {
    return apiError(error, request);
  }
}
