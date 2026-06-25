import { describe, expect, it } from "vitest";

describe("review lab methodology", () => {
  it("exposes versioned non-medical claim boundaries", async () => {
    const { REVIEW_LAB_METHODOLOGY } = await import("@/lib/review-lab/methodology");

    expect(REVIEW_LAB_METHODOLOGY.version).toMatch(/^review-lab-/);
    expect(REVIEW_LAB_METHODOLOGY.claimBoundary).toBe("AI coach guidance, not medical diagnosis");
    expect(REVIEW_LAB_METHODOLOGY.modules.map((module) => module.id)).toEqual(["squat", "bicep_curl", "dance"]);
    expect(REVIEW_LAB_METHODOLOGY.limitations).toContain("No medical diagnosis, injury assessment, or treatment recommendation.");
  });
});

function strengthSession(overrides: Partial<any> = {}) {
  return {
    id: "session-1",
    userId: "user-1",
    type: "strength",
    exerciseType: "squat",
    date: new Date("2026-06-25T08:00:00.000Z"),
    duration: 24,
    caloriesBurned: 140,
    completed: true,
    compositeScore: 82,
    scoringBreakdown: JSON.stringify({ form: 80, rom: 76, tempo: 88, safety: 84 }),
    summary: "Squat set completed.",
    totalReps: 2,
    frameQualityStats: JSON.stringify({ readyRatio: 0.72, averageConfidence: 0.81 }),
    issueHistory: JSON.stringify([{ issue: "Knee tracking", count: 2 }]),
    telemetry: null,
    postSetAnalysis: null,
    createdAt: new Date("2026-06-25T08:00:00.000Z"),
    ...overrides,
  };
}

function feedbackEvent(message: string) {
  return {
    id: "event-1",
    sessionId: "session-1",
    timestamp: 1200,
    type: "cue",
    message,
    severity: "warning",
    source: "llm_coach",
    createdAt: new Date("2026-06-25T08:00:01.000Z"),
  };
}

describe("review lab evidence builder", () => {
  it("maps squat scorecard reps into professor-readable evidence", async () => {
    const { buildReviewLabReport } = await import("@/lib/review-lab/evidence");
    const report = buildReviewLabReport({
      session: strengthSession(),
      reps: [
        {
          repNumber: 1,
          phase: "completed",
          durationMs: 2200,
          formScore: 76,
          romScore: 70,
          tempoScore: 88,
          safetyScore: 82,
          squatScorecard: JSON.stringify({
            overall: 76,
            reliability: 84,
            failedMetrics: ["Knee tracking"],
            metrics: {
              kneeTracking: {
                key: "kneeTracking",
                label: "Knee tracking",
                score: 62,
                value: 18,
                target: "Knees track over toes",
                status: "fail",
                reliable: true,
                detail: "Knees drifted inward.",
              },
            },
          }),
          curlScorecard: null,
        },
      ],
      feedbackEvents: [feedbackEvent("Rep 1: track knees over toes.")],
    });

    expect(report.module).toBe("squat");
    expect(report.evidence[0].kind).toBe("rep");
    if (report.evidence[0].kind !== "rep") throw new Error("Expected rep evidence");
    expect(report.evidence[0].failedMetrics).toContain("Knee tracking");
    expect(report.mistakeProbabilities[0].label).toBe("Knee tracking");
    expect(report.aiCueHistory[0].claimBoundary).toBe("AI coach guidance, not medical diagnosis");
  });

  it("maps curl scorecard reps into curl evidence", async () => {
    const { buildReviewLabReport } = await import("@/lib/review-lab/evidence");
    const report = buildReviewLabReport({
      session: strengthSession({ exerciseType: "bicep_curl", compositeScore: 88 }),
      reps: [
        {
          repNumber: 1,
          phase: "completed",
          durationMs: 1800,
          formScore: 88,
          romScore: 90,
          tempoScore: 84,
          safetyScore: 92,
          squatScorecard: null,
          curlScorecard: JSON.stringify({
            overall: 88,
            reliability: 91,
            failedMetrics: [],
            metrics: {
              wristStack: {
                key: "wristStack",
                label: "Wrist stack",
                score: 90,
                status: "pass",
                reliable: true,
                detail: "Wrist stayed stacked over forearm.",
              },
            },
          }),
        },
      ],
      feedbackEvents: [],
    });

    expect(report.module).toBe("bicep_curl");
    expect(report.evidence[0].kind).toBe("rep");
    expect(report.evidence[0].metrics[0].label).toBe("Wrist stack");
  });

  it("maps dance telemetry into phrase evidence", async () => {
    const { buildReviewLabReport } = await import("@/lib/review-lab/evidence");
    const report = buildReviewLabReport({
      session: strengthSession({
        type: "dance",
        exerciseType: "dance_basic",
        compositeScore: 74,
        totalReps: 0,
        telemetry: JSON.stringify({
          phraseEvidence: [
            {
              phraseId: "groove-1",
              phraseLabel: "Bounce and hit",
              count: "1-2",
              timingScore: 68,
              poseSimilarity: 72,
              grooveScore: 77,
              reliability: 80,
              referenceCue: "Match the ghost skeleton arm hit.",
              learnerDeviation: "Right wrist was late on count 2.",
            },
          ],
        }),
      }),
      reps: [],
      feedbackEvents: [],
    });

    expect(report.module).toBe("dance");
    expect(report.evidence[0].kind).toBe("phrase");
    if (report.evidence[0].kind !== "phrase") throw new Error("Expected phrase evidence");
    expect(report.evidence[0].phraseLabel).toBe("Bounce and hit");
  });

  it("adds low-camera-confidence limitations", async () => {
    const { buildReviewLabReport } = await import("@/lib/review-lab/evidence");
    const report = buildReviewLabReport({
      session: strengthSession({
        frameQualityStats: JSON.stringify({ readyRatio: 0.31, averageConfidence: 0.42 }),
      }),
      reps: [],
      feedbackEvents: [],
    });

    expect(report.limitations.map((limitation) => limitation.code)).toContain("low_camera_confidence");
    expect(report.cameraQuality).toBe("unreliable");
  });
});

describe("review lab demo fixtures", () => {
  it("provides one squat, one curl, and one dance report", async () => {
    const { getDemoReviewLabReports } = await import("@/lib/review-lab/demo-fixtures");
    const reports = getDemoReviewLabReports();

    expect(reports.map((report) => report.module)).toEqual(["squat", "bicep_curl", "dance"]);
    expect(reports.every((report) => report.limitations.some((limitation) => limitation.code === "not_medical_device"))).toBe(true);
  });
});
