import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/fitcoach_test";

function session(score: number, type = "strength") {
  return {
    id: crypto.randomUUID(),
    type,
    exerciseType: type === "dance" ? "dance_basic" : "squat",
    date: new Date(),
    caloriesBurned: 120,
    compositeScore: score,
    totalReps: 12,
    issueHistory: null,
    postSetAnalysis: null,
  };
}

function repScorecard(label: string, status: "fail" | "pass") {
  return JSON.stringify({
    metrics: {
      primary: {
        label,
        status,
      },
    },
  });
}

describe("coach agent decision engine", () => {
  it("asks for baseline evidence when no sessions exist", async () => {
    const { buildCoachDecision } = await import("@/lib/server/coach-agent");
    const decision = buildCoachDecision({
      recentSessions: [],
      reps: [],
      achievementRecommendation: "First Steps: 1 more to unlock.",
    });

    expect(decision.priority).toBe("practice");
    expect(decision.nextAction).toMatch(/learn from real evidence/i);
  });

  it("selects practice when a metric keeps failing", async () => {
    const { buildCoachDecision } = await import("@/lib/server/coach-agent");
    const decision = buildCoachDecision({
      recentSessions: [session(78), session(82), session(80)],
      reps: [
        { squatScorecard: repScorecard("Knee tracking", "fail") },
        { squatScorecard: repScorecard("Knee tracking", "fail") },
      ],
      achievementRecommendation: "Squat Foundation: 2 more to unlock.",
    });

    expect(decision.priority).toBe("practice");
    expect(decision.nextAction).toMatch(/Knee tracking/i);
  });

  it("progresses when recent scores are strong and stable", async () => {
    const { buildCoachDecision } = await import("@/lib/server/coach-agent");
    const decision = buildCoachDecision({
      recentSessions: [session(88), session(90), session(86)],
      reps: [{ curlScorecard: repScorecard("Elbow path", "pass") }],
      achievementRecommendation: "Form Scholar: 1 more to unlock.",
    });

    expect(decision.priority).toBe("progress");
    expect(decision.planAdjustment).toMatch(/increase/i);
  });
});
