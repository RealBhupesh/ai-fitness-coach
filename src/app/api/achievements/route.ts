import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/auth/session";
import { buildAchievementProgress, ensureAchievements } from "@/lib/server/app-data";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    const { allAchievements, awards, stats } = await ensureAchievements(session.user.id);
    const awardsMap = new Map(awards.map((award) => [award.achievementId, award]));
    const progressByName = buildAchievementProgress(stats);
    const achievementRows = allAchievements.map((achievement) => {
      const award = awardsMap.get(achievement.id);
      return {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        category: achievement.category,
        icon: achievement.icon,
        points: achievement.points ?? 0,
        threshold: achievement.threshold ?? 0,
        progress: award?.progress ?? progressByName[achievement.name] ?? 0,
        unlocked: Boolean(award),
        unlockedDate: award?.unlockedAt?.toISOString() ?? null,
      };
    });
    const closestAchievement = achievementRows
      .filter((achievement) => !achievement.unlocked && achievement.threshold > 0)
      .map((achievement) => ({
        ...achievement,
        remaining: Math.max(0, achievement.threshold - achievement.progress),
        percent: Math.min(100, Math.round((achievement.progress / Math.max(achievement.threshold, 1)) * 100)),
      }))
      .sort((a, b) => a.remaining - b.remaining)[0] ?? null;

    return NextResponse.json({
      stats,
      achievements: achievementRows,
      closestAchievement,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
