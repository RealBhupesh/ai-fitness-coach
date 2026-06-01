import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/fitcoach_test";

function session(score: number, type = "strength") {
  return {
    id: crypto.randomUUID(),
    type,
    exerciseType: type === "dance" ? "dance_basic" : "squat",
    date: new Date(),
    duration: 20,
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

  it("builds a guided recovery plan with a focused weak metric", async () => {
    const { buildCoachDecision, buildGuidedCoachPlan } = await import("@/lib/server/coach-agent");
    const recentSessions = [session(52), session(58)];
    const decision = buildCoachDecision({
      recentSessions,
      reps: [
        { squatScorecard: repScorecard("Knee tracking", "fail") },
        { squatScorecard: repScorecard("Knee tracking", "fail") },
        { squatScorecard: repScorecard("Torso stack", "fail") },
      ],
      achievementRecommendation: "Squat Foundation: 4 more to unlock.",
    });
    const plan = buildGuidedCoachPlan({
      decision,
      sessions: recentSessions,
      failedMetrics: ["Knee tracking", "Torso stack"],
      closestAchievement: {
        name: "Squat Foundation",
        description: "Save 25 squat reps with scorecard evidence",
        category: "fitness",
        icon: "🦵",
        threshold: 25,
        progress: 21,
        remaining: 4,
        percent: 84,
        nextAction: "Save 4 more squat scorecard reps.",
      },
    });

    expect(plan.primarySessionRecommendation.type).toBe("recovery");
    expect(plan.focusMetric.label).toBe("Knee tracking");
    expect(plan.todayPlan.secondaryAction).toMatch(/Review progress/i);
    expect(plan.todayPlan.evidenceChips).toContain("Squat Foundation: 84%");
  });

  it("low recovery check-ins reduce readiness and recommend recovery", async () => {
    const { buildReadinessReport } = await import("@/lib/server/coach-agent");
    const readiness = buildReadinessReport({
      sessions: [session(78), session(74)],
      sleepHours: 7,
      recoveryCheckIn: {
        sleepHours: 4.5,
        sleepQuality: 2,
        soreness: 5,
        stress: 5,
        energy: 1,
        hydration: 2,
      },
      failedMetrics: ["Knee tracking", "Torso stack", "Depth"],
    });

    expect(readiness.score).toBeLessThan(55);
    expect(readiness.label).toBe("Recover");
    expect(readiness.recommendation).toMatch(/mobility|recovery/i);
  });

  it("converts recent sessions into strain and weekly adaptive plans", async () => {
    const { buildStrainLoadReport, buildWeeklyAdaptivePlan } = await import("@/lib/server/coach-agent");
    const strain = buildStrainLoadReport([session(88), session(84, "dance")]);
    const plan = buildWeeklyAdaptivePlan({
      readiness: {
        score: 82,
        label: "Ready",
        recommendation: "Train normally.",
        drivers: [],
        recoveryDebt: 4,
      },
      strainLoad: strain,
      decision: {
        priority: "practice",
        reason: "A repeated weak metric is limiting progress.",
        evidence: [],
        nextAction: "Repeat timing practice.",
      },
      focusMetric: { label: "Beat timing" },
      closestAchievement: null,
    });

    expect(strain.todayStrain).toBeGreaterThan(0);
    expect(strain.weeklyLoad).toBeGreaterThanOrEqual(strain.todayStrain);
    expect(plan).toHaveLength(7);
    expect(plan.some((day) => day.type === "dance")).toBe(true);
  });
});
