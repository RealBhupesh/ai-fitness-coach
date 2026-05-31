import { describe, expect, it } from "vitest";
import { buildSquatDemoSessionEvidence, buildSquatRepScorecard, summarizeSquatEvidence } from "@/lib/pose/squat-scorecard";
import type { FrameAnalysis, LiveMetric } from "@/lib/pose/types";

function metric(name: string, score: number, detail: string, value = score, reliable = true): LiveMetric {
  return {
    name,
    score,
    detail,
    value,
    target: name === "Depth" ? "86-108 degrees" : "target range",
    status: score >= 84 ? "excellent" : score >= 68 ? "warning" : "critical",
    reliable,
  };
}

function frame(overrides: { phase?: string; overall?: number; metrics?: LiveMetric[] } = {}) {
  const metrics =
    overrides.metrics ??
    [
      metric("Depth", 92, "Depth is solid and controlled.", 96),
      metric("Knee Tracking", 90, "Knees are tracking cleanly over the feet.", 4),
      metric("Torso Stack", 88, "Torso stack looks controlled over the mid-foot.", 70),
      metric("Hip Centering", 90, "Hip path is centered between both feet.", 2),
      metric("Symmetry", 88, "Both knees are sharing the work evenly.", 3),
      metric("Shoulder Stability", 90, "Shoulders are staying level through the rep.", 2),
    ];

  return {
    timestampMs: 0,
    analysis: {
      form: 88,
      rom: 90,
      tempo: 86,
      stability: 88,
      symmetry: 88,
      consistency: 86,
      endurance: 85,
      safety: 90,
      overall: overrides.overall ?? 89,
      phase: overrides.phase ?? "bottom",
      metrics,
      issues: [],
      positives: [],
      corrections: [],
      injuryRisks: [],
    } satisfies FrameAnalysis,
  };
}

describe("squat scorecards", () => {
  it("grades a controlled squat rep as passing", () => {
    const scorecard = buildSquatRepScorecard({
      repNumber: 1,
      durationMs: 2200,
      frames: [frame({ phase: "lowering", overall: 84 }), frame({ phase: "bottom", overall: 94 }), frame({ phase: "top", overall: 88 })],
    });

    expect(scorecard.status).toBe("pass");
    expect(scorecard.bestPhase).toBe("bottom");
    expect(scorecard.metrics.depth.status).toBe("pass");
    expect(scorecard.metrics.kneeTracking.status).toBe("pass");
  });

  it("marks knee collapse as a failed metric", () => {
    const scorecard = buildSquatRepScorecard({
      repNumber: 2,
      durationMs: 1800,
      frames: [
        frame({
          metrics: [
            metric("Depth", 84, "Depth is solid and controlled.", 104),
            metric("Knee Tracking", 42, "Drive both knees over the middle toes. They are collapsing inward at the bottom.", 22),
            metric("Torso Stack", 82, "Torso stack looks controlled over the mid-foot.", 74),
            metric("Hip Centering", 88, "Hip path is centered between both feet.", 2),
            metric("Symmetry", 86, "Both knees are sharing the work evenly.", 4),
            metric("Shoulder Stability", 88, "Shoulders are staying level through the rep.", 2),
          ],
        }),
      ],
    });

    expect(scorecard.status).toBe("fail");
    expect(scorecard.metrics.kneeTracking.status).toBe("fail");
    expect(scorecard.failedMetrics).toContain("Knee tracking");
  });

  it("marks metrics unreliable when squat joints are hidden", () => {
    const scorecard = buildSquatRepScorecard({
      repNumber: 3,
      durationMs: 1800,
      frames: [
        frame({
          metrics: [
            metric("Depth", 20, "Depth is not reliable.", 0, false),
            metric("Knee Tracking", 20, "Knee tracking is not reliable.", 0, false),
            metric("Torso Stack", 20, "Torso stack is not reliable.", 0, false),
          ],
        }),
      ],
    });

    expect(scorecard.status).toBe("unreliable");
    expect(scorecard.metrics.depth.status).toBe("unreliable");
  });

  it("summarizes best, worst, recurring mistakes, and trend", () => {
    const weak = buildSquatRepScorecard({
      repNumber: 1,
      durationMs: 900,
      frames: [
        frame({
          metrics: [
            metric("Depth", 58, "Sit deeper.", 126),
            metric("Knee Tracking", 48, "Drive both knees over the middle toes.", 24),
            metric("Torso Stack", 72, "Brace the ribs down.", 54),
          ],
        }),
      ],
    });
    const strong = buildSquatRepScorecard({ repNumber: 2, durationMs: 2200, frames: [frame()] });

    const summary = summarizeSquatEvidence([weak, strong]);

    expect(summary.bestRep).toBe(2);
    expect(summary.worstRep).toBe(1);
    expect(summary.improvementTrend).toBeGreaterThan(0);
    expect(summary.recurringFailedMetrics).toContain("Knee tracking");
  });

  it("builds demo evidence for teacher mode", () => {
    const evidence = buildSquatDemoSessionEvidence();

    expect(evidence.totalReps).toBe(5);
    expect(evidence.bestRep).toBe(5);
    expect(evidence.averageScore).toBeGreaterThan(0);
    expect(evidence.recurringFailedMetrics).toContain("Depth");
  });
});
