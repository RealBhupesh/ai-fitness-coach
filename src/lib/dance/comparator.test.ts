import { describe, expect, it } from "vitest";
import { compareDanceFrame } from "@/lib/dance/comparator";
import type { DanceRoutinePack } from "@/lib/dance/types";
import type { FrameAnalysis, Landmark } from "@/lib/pose/types";

const baseAnalysis: FrameAnalysis = {
  form: 82,
  rom: 84,
  tempo: 80,
  stability: 86,
  symmetry: 84,
  consistency: 83,
  endurance: 80,
  safety: 88,
  overall: 84,
  phase: "hit",
  metrics: [],
  issues: [],
  positives: [],
  corrections: [],
  injuryRisks: [],
};

const routine: DanceRoutinePack = {
  id: "starter",
  name: "Starter Groove",
  description: "Test routine",
  difficulty: "beginner",
  durationMs: 60000,
  bpm: 96,
  audioUrl: "/routines/test.wav",
  thumbnailUrl: "/routines/test.svg",
  checkpoints: [{ timeMs: 0, cue: "Hit", target: "dance_basic" }],
  segments: [
    {
      id: "hit-a",
      label: "Hit A",
      startMs: 0,
      endMs: 10000,
      cue: "Hit wide",
      focus: "wide frame",
      targetMetrics: {
        frameWidth: [54, 88],
        armLift: [2, 18],
        torsoLeanMax: 8,
        kneeAngle: [138, 162],
        symmetryMax: 7,
      },
      targetLandmarks: {
        leftWrist: { x: -0.95, y: -0.28 },
        rightWrist: { x: 0.95, y: -0.28 },
        leftShoulder: { x: -0.5, y: 0 },
        rightShoulder: { x: 0.5, y: 0 },
      },
    },
  ],
};

function buildLandmarks() {
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 }));
  landmarks[11] = { x: 0.42, y: 0.38, visibility: 0.99 };
  landmarks[12] = { x: 0.58, y: 0.38, visibility: 0.99 };
  landmarks[15] = { x: 0.23, y: 0.34, visibility: 0.99 };
  landmarks[16] = { x: 0.77, y: 0.34, visibility: 0.99 };
  landmarks[23] = { x: 0.44, y: 0.58, visibility: 0.99 };
  landmarks[24] = { x: 0.56, y: 0.58, visibility: 0.99 };
  landmarks[25] = { x: 0.44, y: 0.74, visibility: 0.99 };
  landmarks[26] = { x: 0.56, y: 0.74, visibility: 0.99 };
  landmarks[27] = { x: 0.42, y: 0.9, visibility: 0.99 };
  landmarks[28] = { x: 0.58, y: 0.9, visibility: 0.99 };
  return landmarks;
}

describe("dance comparator", () => {
  it("scores a matching frame against the active segment", () => {
    const comparison = compareDanceFrame({
      landmarks: buildLandmarks(),
      routine,
      elapsedMs: 2000,
      analysis: baseAnalysis,
    });

    expect(comparison).not.toBeNull();
    expect(comparison?.segment.id).toBe("hit-a");
    expect(comparison?.poseSimilarity ?? 0).toBeGreaterThan(60);
    expect(comparison?.overall ?? 0).toBeGreaterThanOrEqual(60);
    expect(comparison?.metrics.armHits.status).toBe("pass");
    expect(comparison?.reliability).toBe(100);
  });

  it("returns metric-level hip-hop feedback for weak arm hits", () => {
    const landmarks = buildLandmarks();
    landmarks[15] = { x: 0.43, y: 0.42, visibility: 0.99 };
    landmarks[16] = { x: 0.57, y: 0.42, visibility: 0.99 };

    const comparison = compareDanceFrame({
      landmarks,
      routine,
      elapsedMs: 2000,
      analysis: baseAnalysis,
    });

    expect(comparison?.metrics.armHits.status).toBe("fail");
    expect(comparison?.primaryIssue).toMatch(/arm hit|shape|wider/i);
    expect(comparison?.failedMetrics).toContain("Arm hits");
  });

  it("marks hip-hop comparison unreliable when target joints are hidden", () => {
    const landmarks = buildLandmarks();
    landmarks[15] = { ...landmarks[15], visibility: 0.1 };
    landmarks[16] = { ...landmarks[16], visibility: 0.1 };

    const comparison = compareDanceFrame({
      landmarks,
      routine,
      elapsedMs: 2000,
      analysis: baseAnalysis,
    });

    expect(comparison?.metrics.poseShape.status).toBe("unreliable");
    expect(comparison?.reliability ?? 100).toBeLessThan(100);
  });
});
