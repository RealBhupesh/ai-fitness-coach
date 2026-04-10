import { describe, expect, it } from "vitest";
import { runReplayFixture } from "@/lib/pose/replay";
import type { Landmark } from "@/lib/pose/types";

function createLandmarks() {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 })) as Landmark[];
}

function setSquatLeg(landmarks: Landmark[], side: "left" | "right", kneeAngle: number, visibility = 0.99) {
  const hipIndex = side === "left" ? 23 : 24;
  const kneeIndex = side === "left" ? 25 : 26;
  const ankleIndex = side === "left" ? 27 : 28;
  const centerX = side === "left" ? 0.43 : 0.57;
  const hip = { x: centerX, y: 0.43, visibility };
  const knee = { x: centerX, y: 0.64, visibility };
  const radians = (kneeAngle * Math.PI) / 180;
  const radius = 0.18;

  landmarks[hipIndex] = hip;
  landmarks[kneeIndex] = knee;
  landmarks[ankleIndex] = {
    x: knee.x + radius * Math.sin(radians) * (side === "left" ? 1 : -1),
    y: knee.y - radius * Math.cos(radians),
    visibility,
  };
}

function buildSquatLandmarks(kneeAngle: number, visibility = 0.99) {
  const landmarks = createLandmarks();
  landmarks[11] = { x: 0.4, y: 0.22, z: -0.02, visibility };
  landmarks[12] = { x: 0.6, y: 0.22, z: 0.02, visibility };
  landmarks[15] = { x: 0.32, y: 0.38, visibility };
  landmarks[16] = { x: 0.68, y: 0.38, visibility };
  setSquatLeg(landmarks, "left", kneeAngle, visibility);
  setSquatLeg(landmarks, "right", kneeAngle, visibility);
  return landmarks;
}

describe("replay harness", () => {
  it("does not count reps while frame quality is paused and resumes once tracking recovers", () => {
    const frames = [
      ...Array.from({ length: 6 }, (_, index) => ({ timestampMs: index * 140, landmarks: buildSquatLandmarks(170), brightness: 80 })),
      ...Array.from({ length: 4 }, (_, index) => ({ timestampMs: 840 + index * 140, landmarks: buildSquatLandmarks(170, 0.2), brightness: 80 })),
      ...Array.from({ length: 4 }, (_, index) => ({ timestampMs: 1400 + index * 140, landmarks: buildSquatLandmarks(170), brightness: 80 })),
      ...Array.from({ length: 6 }, (_, index) => ({ timestampMs: 1960 + index * 140, landmarks: buildSquatLandmarks(118), brightness: 80 })),
      ...Array.from({ length: 6 }, (_, index) => ({ timestampMs: 2800 + index * 140, landmarks: buildSquatLandmarks(98), brightness: 80 })),
      ...Array.from({ length: 7 }, (_, index) => ({ timestampMs: 3640 + index * 140, landmarks: buildSquatLandmarks(168), brightness: 80 })),
    ];

    const result = runReplayFixture({
      exerciseId: "squat",
      frames,
    });

    expect(result.pauseFrames).toBeGreaterThan(0);
    expect(result.repCount).toBe(1);
    expect(result.sessionAnalysis.frameQualityStats.partial_body + result.sessionAnalysis.frameQualityStats.camera_lost + result.sessionAnalysis.frameQualityStats.occluded).toBeGreaterThan(0);
  });
});
