import { afterAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/fitcoach_test";

describe("achievement progress engine", () => {
  afterAll(async () => {
    const { dbPool } = await import("@/db");
    await dbPool.end();
  });

  it("maps calories, reps, fitness evidence, dance evidence, and streaks into achievement progress", async () => {
    const { buildAchievementProgress } = await import("@/lib/server/app-data");

    const progress = buildAchievementProgress({
      totalSessions: 12,
      totalCalories: 3400,
      totalReps: 280,
      danceSessionsCount: 4,
      strengthSessionsCount: 8,
      bestCompositeScore: 94,
      highScoreSessions: 6,
      curlScorecards: 31,
      squatScorecards: 27,
      danceScoreSessions: 3,
      currentStreak: 5,
      weeklySessionPeak: 7,
    });

    expect(progress["Calorie Crusher"]).toBe(3400);
    expect(progress["Rep Collector"]).toBe(280);
    expect(progress["Curl Technician"]).toBe(31);
    expect(progress["Squat Foundation"]).toBe(27);
    expect(progress["Groove Builder"]).toBe(3);
    expect(progress["Perfect Week"]).toBe(7);
  });
});
