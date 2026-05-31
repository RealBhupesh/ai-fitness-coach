import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { ensureAchievements } from "@/lib/server/app-data";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    const { allAchievements, awards, stats } = await ensureAchievements(session.user.id);
    const awardsMap = new Map(awards.map((award) => [award.achievementId, award]));

    return NextResponse.json({
      stats,
      achievements: allAchievements.map((achievement) => {
        const award = awardsMap.get(achievement.id);
        return {
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          category: achievement.category,
          icon: achievement.icon,
          points: achievement.points ?? 0,
          threshold: achievement.threshold ?? 0,
          progress: award?.progress ?? 0,
          unlocked: Boolean(award),
          unlockedDate: award?.unlockedAt?.toISOString() ?? null,
        };
      }),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
