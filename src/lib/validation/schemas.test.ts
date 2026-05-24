import { describe, expect, it } from "vitest";
import { summarizeInputSchema, workoutSessionInputSchema } from "@/lib/validation/schemas";

const curlScorecard = {
  repNumber: 1,
  overall: 82,
  status: "warning",
  bestPhase: "top",
  worstMetric: "elbowPath",
  failedMetrics: ["Elbow path"],
  reliability: 88,
  coachingLevel: "hard",
  metrics: {
    elbowPath: {
      key: "elbowPath",
      label: "Elbow path",
      score: 62,
      value: 34,
      target: "0-28 drift",
      status: "fail",
      reliable: true,
      detail: "Elbow drifted forward.",
    },
  },
};

describe("live curl evidence schemas", () => {
  it("accepts curl scorecards in workout rep data", () => {
    const parsed = workoutSessionInputSchema.safeParse({
      type: "strength",
      exerciseType: "bicep_curl",
      repData: [
        {
          exerciseId: "bicep_curl",
          repNumber: 1,
          phase: "bottom",
          formScore: 80,
          romScore: 84,
          tempoScore: 76,
          safetyScore: 90,
          corrections: ["Keep elbow tucked."],
          durationMs: 1800,
          curlScorecard,
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts curl evidence in summary payloads", () => {
    const parsed = summarizeInputSchema.safeParse({
      exerciseType: "bicep_curl",
      coachingLevel: "hard",
      curlEvidence: {
        totalReps: 1,
        bestRep: 1,
        worstRep: 1,
        averageScore: 82,
        improvementTrend: 0,
        recurringFailedMetrics: ["Elbow path"],
        reliabilityAverage: 88,
        repScorecards: [curlScorecard],
      },
      curlCoachMemory: {
        primaryMetric: "Elbow path",
        lastAverageScore: 82,
        improvementTrend: 0,
        reliabilityAverage: 88,
        updatedAt: "2026-05-24T00:00:00.000Z",
      },
    });

    expect(parsed.success).toBe(true);
  });
});
