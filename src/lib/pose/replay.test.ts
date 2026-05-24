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

function setCurlArm(landmarks: Landmark[], side: "left" | "right", angleDeg: number, elbowOffset = 0, visibility = 0.99) {
  const shoulderIndex = side === "left" ? 11 : 12;
  const elbowIndex = side === "left" ? 13 : 14;
  const wristIndex = side === "left" ? 15 : 16;
  const hipIndex = side === "left" ? 23 : 24;
  const shoulderX = side === "left" ? 0.36 : 0.64;
  const elbowX = shoulderX + elbowOffset;
  const shoulderY = 0.34;
  const elbowY = 0.5;
  const radius = 0.14;
  const radians = (angleDeg * Math.PI) / 180;

  landmarks[shoulderIndex] = { x: shoulderX, y: shoulderY, z: side === "left" ? -0.02 : 0.02, visibility };
  landmarks[elbowIndex] = { x: elbowX, y: elbowY, visibility };
  landmarks[wristIndex] = {
    x: elbowX + radius * Math.sin(radians) * (side === "left" ? 1 : -1),
    y: elbowY - radius * Math.cos(radians),
    visibility,
  };
  landmarks[hipIndex] = { x: shoulderX, y: 0.72, z: side === "left" ? -0.01 : 0.01, visibility };
}

function buildCurlLandmarks(angleDeg: number, elbowOffset = 0) {
  const landmarks = createLandmarks();
  setCurlArm(landmarks, "left", angleDeg, elbowOffset);
  setCurlArm(landmarks, "right", angleDeg, -elbowOffset);
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

  it("emits stable bicep curl cues from deterministic metric evidence", () => {
    const frames = Array.from({ length: 10 }, (_, index) => ({
      timestampMs: index * 140,
      landmarks: buildCurlLandmarks(166, 0.08),
      brightness: 82,
    }));

    const result = runReplayFixture({
      exerciseId: "bicep_curl",
      frames,
    });

    expect(result.emittedCues.length).toBeGreaterThan(0);
    expect(result.emittedCues[0].message).toMatch(/elbow/i);
  });
});
