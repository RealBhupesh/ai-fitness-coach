import { describe, expect, it } from "vitest";
import { buildHipHopTutorial, buildReferenceSkeleton, evaluateHipHopTrainingFrame } from "@/lib/dance/training-engine";
import type { DanceRoutinePack } from "@/lib/dance/types";
import type { FrameAnalysis, Landmark } from "@/lib/pose/types";

const analysis: FrameAnalysis = {
  form: 84,
  rom: 82,
  tempo: 80,
  stability: 86,
  symmetry: 84,
  consistency: 82,
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
  id: "starter-groove-pack",
  name: "Hip-Hop Starter Groove",
  description: "Beginner hip-hop routine",
  style: "hip_hop",
  difficulty: "beginner",
  durationMs: 16000,
  bpm: 96,
  audioUrl: "/routines/starter-groove-click.wav",
  thumbnailUrl: "/routines/starter-groove-thumbnail.svg",
  checkpoints: [{ timeMs: 0, cue: "Open frame on the beat", target: "dance_basic" }],
  segments: [
    {
      id: "open-hit-a",
      label: "Open Hit",
      startMs: 0,
      endMs: 8000,
      cue: "Open frame on the beat",
      focus: "wide frame and level wrists",
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
        leftHip: { x: -0.34, y: 1.04 },
        rightHip: { x: 0.34, y: 1.04 },
      },
    },
    {
      id: "groove-drop-a",
      label: "Groove Drop",
      startMs: 8000,
      endMs: 16000,
      cue: "Drop into the groove without collapsing",
      focus: "soft knees and stacked torso",
      targetMetrics: {
        frameWidth: [40, 68],
        armLift: [-4, 8],
        torsoLeanMax: 7,
        kneeAngle: [132, 152],
        symmetryMax: 7,
      },
      targetLandmarks: {
        leftWrist: { x: -0.66, y: -0.02 },
        rightWrist: { x: 0.66, y: -0.02 },
        leftShoulder: { x: -0.5, y: 0.04 },
        rightShoulder: { x: 0.5, y: 0.04 },
      },
    },
  ],
};

function landmarks({ narrowArms = false } = {}) {
  const points: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 }));
  points[11] = { x: 0.42, y: 0.38, visibility: 0.99 };
  points[12] = { x: 0.58, y: 0.38, visibility: 0.99 };
  points[15] = narrowArms ? { x: 0.44, y: 0.42, visibility: 0.99 } : { x: 0.23, y: 0.34, visibility: 0.99 };
  points[16] = narrowArms ? { x: 0.56, y: 0.42, visibility: 0.99 } : { x: 0.77, y: 0.34, visibility: 0.99 };
  points[23] = { x: 0.44, y: 0.58, visibility: 0.99 };
  points[24] = { x: 0.56, y: 0.58, visibility: 0.99 };
  points[25] = { x: 0.44, y: 0.74, visibility: 0.99 };
  points[26] = { x: 0.56, y: 0.74, visibility: 0.99 };
  points[27] = { x: 0.42, y: 0.9, visibility: 0.99 };
  points[28] = { x: 0.58, y: 0.9, visibility: 0.99 };
  return points;
}

describe("hip-hop dance training engine", () => {
  it("builds a tutorial step for each routine segment", () => {
    const tutorial = buildHipHopTutorial(routine);

    expect(tutorial).toHaveLength(routine.segments.length);
    expect(tutorial[0]).toMatchObject({
      segmentId: "open-hit-a",
      count: "1-2",
    });
    expect(tutorial[0].teachingCue).toMatch(/coach skeleton/i);
  });

  it("creates a reference skeleton the learner can follow", () => {
    const skeleton = buildReferenceSkeleton(routine.segments[0]);

    expect(skeleton.segmentId).toBe("open-hit-a");
    expect(skeleton.points.leftWrist.x).toBeLessThan(skeleton.points.leftShoulder.x);
    expect(skeleton.points.rightWrist.x).toBeGreaterThan(skeleton.points.rightShoulder.x);
    expect(skeleton.connections).toContainEqual(["leftShoulder", "rightShoulder"]);
  });

  it("scores a learner against the active tutorial skeleton and grounds AI feedback", () => {
    const result = evaluateHipHopTrainingFrame({
      routine: { ...routine, tutorial: buildHipHopTutorial(routine) },
      landmarks: landmarks(),
      elapsedMs: 2000,
      analysis,
    });

    expect(result?.segment.id).toBe("open-hit-a");
    expect(result?.referenceSkeleton.segmentId).toBe("open-hit-a");
    expect(result?.score ?? 0).toBeGreaterThan(50);
    expect(result?.aiGuidance.grounding.claim).toBe("AI dance coach guidance");
    expect(result?.aiGuidance.grounding.allowedClaims).toBe("not_medical_device");
    expect(result?.aiGuidance.instruction).toContain("Do not invent");
  });

  it("returns specific posture correction when the learner misses the arm hit", () => {
    const result = evaluateHipHopTrainingFrame({
      routine: { ...routine, tutorial: buildHipHopTutorial(routine) },
      landmarks: landmarks({ narrowArms: true }),
      elapsedMs: 2000,
      analysis,
    });

    expect(result?.comparison?.metrics.armHits.status).toBe("fail");
    expect(result?.primaryCorrection).toMatch(/arm hit|wider|shape/i);
    expect(result?.aiGuidance.grounding.measuredMetrics.armHits.status).toBe("fail");
  });
});
