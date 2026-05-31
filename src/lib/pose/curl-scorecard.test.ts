import { describe, expect, it } from "vitest";
import { buildCurlBaseline, buildCurlDemoSessionEvidence, buildCurlRepScorecard, summarizeCurlCoachMemory, summarizeCurlEvidence } from "@/lib/pose/curl-scorecard";
import { analyzeExercise } from "@/lib/pose/exercises";
import { buildTrackingFrame } from "@/lib/pose/confidence";
import type { Landmark } from "@/lib/pose/types";

function createLandmarks() {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 })) as Landmark[];
}

function setCurlArm(landmarks: Landmark[], side: "left" | "right", angleDeg: number, options: { elbowOffset?: number; shoulderY?: number; wristVisibility?: number } = {}) {
  const shoulderIndex = side === "left" ? 11 : 12;
  const elbowIndex = side === "left" ? 13 : 14;
  const wristIndex = side === "left" ? 15 : 16;
  const hipIndex = side === "left" ? 23 : 24;
  const shoulderX = side === "left" ? 0.36 : 0.64;
  const elbowX = shoulderX + (side === "left" ? options.elbowOffset ?? 0 : -(options.elbowOffset ?? 0));
  const shoulderY = options.shoulderY ?? 0.34;
  const elbowY = 0.5;
  const radius = 0.14;
  const radians = (angleDeg * Math.PI) / 180;

  landmarks[shoulderIndex] = { x: shoulderX, y: shoulderY, z: side === "left" ? -0.02 : 0.02, visibility: 0.99 };
  landmarks[elbowIndex] = { x: elbowX, y: elbowY, visibility: 0.99 };
  landmarks[wristIndex] = {
    x: elbowX + radius * Math.sin(radians) * (side === "left" ? 1 : -1),
    y: elbowY - radius * Math.cos(radians),
    visibility: options.wristVisibility ?? 0.99,
  };
  landmarks[hipIndex] = { x: shoulderX, y: 0.72, z: side === "left" ? -0.01 : 0.01, visibility: 0.99 };
}

function buildCurlLandmarks(angleDeg: number, options: { elbowOffset?: number; shoulderY?: number; wristVisibility?: number } = {}) {
  const landmarks = createLandmarks();
  setCurlArm(landmarks, "left", angleDeg, options);
  setCurlArm(landmarks, "right", angleDeg, options);
  return landmarks;
}

function analyzeFrame(landmarks: Landmark[], timestampMs: number, phase: string) {
  return {
    timestampMs,
    analysis: analyzeExercise("bicep_curl", landmarks, 0, undefined, phase),
  };
}

describe("curl scorecards", () => {
  it("grades a clean multi-phase curl as passing", () => {
    const scorecard = buildCurlRepScorecard({
      repNumber: 1,
      durationMs: 1800,
      coachingLevel: "normal",
      frames: [
        analyzeFrame(buildCurlLandmarks(166), 0, "bottom"),
        analyzeFrame(buildCurlLandmarks(58), 900, "top"),
        analyzeFrame(buildCurlLandmarks(166), 1800, "bottom"),
      ],
    });

    expect(scorecard.status).toBe("pass");
    expect(scorecard.metrics.elbowPath.status).toBe("pass");
    expect(scorecard.metrics.topFinish.status).toBe("pass");
    expect(scorecard.metrics.bottomExtension.status).toBe("pass");
  });

  it("marks elbow drift with concrete metric status", () => {
    const scorecard = buildCurlRepScorecard({
      repNumber: 2,
      durationMs: 1600,
      coachingLevel: "hard",
      frames: [
        analyzeFrame(buildCurlLandmarks(166, { elbowOffset: 0.08 }), 0, "bottom"),
        analyzeFrame(buildCurlLandmarks(72, { elbowOffset: 0.08 }), 600, "curling"),
      ],
    });

    expect(scorecard.status).toBe("fail");
    expect(scorecard.metrics.elbowPath.status).toBe("fail");
    expect(scorecard.failedMetrics).toContain("Elbow path");
  });

  it("marks wrist-specific grading unreliable when wrist visibility is poor", () => {
    const scorecard = buildCurlRepScorecard({
      repNumber: 3,
      durationMs: 1600,
      coachingLevel: "hard",
      frames: [
        analyzeFrame(buildCurlLandmarks(166, { wristVisibility: 0.2 }), 0, "bottom"),
        analyzeFrame(buildCurlLandmarks(72, { wristVisibility: 0.2 }), 600, "curling"),
      ],
    });

    expect(scorecard.metrics.wristStack.status).toBe("unreliable");
  });

  it("does not reorder replay frame evidence while selecting best phase", () => {
    const frames = [
      analyzeFrame(buildCurlLandmarks(166), 0, "bottom"),
      analyzeFrame(buildCurlLandmarks(58), 900, "top"),
      analyzeFrame(buildCurlLandmarks(166), 1800, "bottom"),
    ];
    frames[0].analysis.overall = 72;
    frames[1].analysis.overall = 94;
    frames[2].analysis.overall = 80;
    const originalOrder = frames.map((frame) => frame.timestampMs);

    const scorecard = buildCurlRepScorecard({
      repNumber: 4,
      durationMs: 1800,
      coachingLevel: "normal",
      frames,
    });

    expect(scorecard.bestPhase).toBe("top");
    expect(frames.map((frame) => frame.timestampMs)).toEqual(originalOrder);
  });

  it("builds baseline readiness from stable tracking frames", () => {
    let previous = null as Landmark[] | null;
    const frames = Array.from({ length: 12 }, (_, index) => {
      const rawLandmarks = buildCurlLandmarks(166);
      const trackingFrame = buildTrackingFrame({
        exerciseId: "bicep_curl",
        rawLandmarks,
        worldLandmarks: rawLandmarks,
        previousSmoothed: previous,
        timestampMs: index * 100,
        frameIndex: index,
        fps: 24,
        brightness: 85,
      });
      previous = trackingFrame.smoothedLandmarks;
      return trackingFrame;
    });

    expect(buildCurlBaseline(frames).ready).toBe(true);
    expect(buildCurlBaseline([]).ready).toBe(false);
  });

  it("summarizes best, worst, recurrence, and trend", () => {
    const weak = buildCurlRepScorecard({
      repNumber: 1,
      durationMs: 900,
      coachingLevel: "hard",
      frames: [analyzeFrame(buildCurlLandmarks(88, { elbowOffset: 0.08 }), 0, "curling")],
    });
    const strong = buildCurlRepScorecard({
      repNumber: 2,
      durationMs: 1800,
      coachingLevel: "hard",
      frames: [analyzeFrame(buildCurlLandmarks(166), 0, "bottom"), analyzeFrame(buildCurlLandmarks(58), 900, "top"), analyzeFrame(buildCurlLandmarks(166), 1800, "bottom")],
    });

    const summary = summarizeCurlEvidence([weak, strong]);

    expect(summary.bestRep).toBe(2);
    expect(summary.worstRep).toBe(1);
    expect(summary.improvementTrend).toBeGreaterThan(0);
    expect(summary.recurringFailedMetrics.length).toBeGreaterThan(0);
  });

  it("builds demo evidence and coach memory for teacher mode", () => {
    const evidence = buildCurlDemoSessionEvidence("hard");
    const memory = summarizeCurlCoachMemory(evidence);

    expect(evidence.totalReps).toBe(5);
    expect(evidence.bestRep).toBe(5);
    expect(evidence.recurringFailedMetrics).toContain("Elbow path");
    expect(memory.primaryMetric).toBe("Elbow path");
    expect(memory.lastAverageScore).toBeGreaterThan(0);
  });
});
