import { describe, expect, it } from "vitest";
import { advancePhaseTracker, analyzeExercise, createPhaseTrackerState } from "@/lib/pose/exercises";
import type { ExerciseId, Landmark } from "@/lib/pose/types";

function createLandmarks() {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 })) as Landmark[];
}

function setCurlArm(landmarks: Landmark[], side: "left" | "right", angleDeg: number, visibility = 0.99) {
  const shoulderIndex = side === "left" ? 11 : 12;
  const elbowIndex = side === "left" ? 13 : 14;
  const wristIndex = side === "left" ? 15 : 16;
  const hipIndex = side === "left" ? 23 : 24;
  const shoulderX = side === "left" ? 0.42 : 0.58;
  const elbowX = shoulderX;
  const shoulderY = 0.34;
  const elbowY = 0.5;
  const radius = 0.14;
  const radians = (angleDeg * Math.PI) / 180;

  landmarks[shoulderIndex] = { x: shoulderX, y: shoulderY, visibility };
  landmarks[elbowIndex] = { x: elbowX, y: elbowY, visibility };
  landmarks[wristIndex] = {
    x: elbowX + radius * Math.sin(radians) * (side === "left" ? 1 : -1),
    y: elbowY - radius * Math.cos(radians),
    visibility,
  };
  landmarks[hipIndex] = { x: shoulderX, y: 0.7, visibility };
}

function buildCurlLandmarks(angleDeg: number, options: { wristVisibility?: number } = {}) {
  const landmarks = createLandmarks();
  setCurlArm(landmarks, "left", angleDeg, 0.99);
  setCurlArm(landmarks, "right", 165, 0.99);
  if (typeof options.wristVisibility === "number") {
    landmarks[15] = { ...landmarks[15], visibility: options.wristVisibility };
  }
  return landmarks;
}

function setSquatLeg(landmarks: Landmark[], side: "left" | "right", kneeAngle: number, kneeOffset = 0, hipOffset = 0) {
  const hipIndex = side === "left" ? 23 : 24;
  const kneeIndex = side === "left" ? 25 : 26;
  const ankleIndex = side === "left" ? 27 : 28;
  const centerX = side === "left" ? 0.43 : 0.57;
  const hip = { x: centerX + hipOffset, y: 0.43, visibility: 0.99 };
  const knee = { x: centerX + kneeOffset, y: 0.64, visibility: 0.99 };
  const radians = (kneeAngle * Math.PI) / 180;
  const radius = 0.18;

  landmarks[hipIndex] = hip;
  landmarks[kneeIndex] = knee;
  landmarks[ankleIndex] = {
    x: knee.x + radius * Math.sin(radians) * (side === "left" ? 1 : -1),
    y: knee.y - radius * Math.cos(radians),
    visibility: 0.99,
  };
}

function buildSquatLandmarks(kneeAngle: number, options: { leftKneeOffset?: number; rightKneeOffset?: number; hipOffset?: number } = {}) {
  const landmarks = createLandmarks();
  landmarks[11] = { x: 0.4, y: 0.22, visibility: 0.99 };
  landmarks[12] = { x: 0.6, y: 0.22, visibility: 0.99 };
  setSquatLeg(landmarks, "left", kneeAngle, options.leftKneeOffset, options.hipOffset);
  setSquatLeg(landmarks, "right", kneeAngle, options.rightKneeOffset, options.hipOffset);
  return landmarks;
}

function countReps(exerciseId: ExerciseId, frames: Landmark[][], stepMs = 50) {
  let state = createPhaseTrackerState(0);
  let reps = 0;
  let now = 0;

  for (const landmarks of frames) {
    now += stepMs;
    const update = advancePhaseTracker(exerciseId, landmarks, state, now);
    state = update.state;
    if (update.repCompleted) reps += 1;
  }

  return reps;
}

describe("pose exercise tracking", () => {
  it("does not overcount bicep curl reps under top-position jitter", () => {
    const frames = [
      ...Array.from({ length: 6 }, () => buildCurlLandmarks(168)),
      ...Array.from({ length: 4 }, () => buildCurlLandmarks(110)),
      ...Array.from({ length: 4 }, () => buildCurlLandmarks(52)),
      buildCurlLandmarks(57),
      buildCurlLandmarks(61),
      buildCurlLandmarks(59),
      ...Array.from({ length: 4 }, () => buildCurlLandmarks(112)),
      ...Array.from({ length: 5 }, () => buildCurlLandmarks(166)),
    ];

    expect(countReps("bicep_curl", frames)).toBe(1);
  });

  it("does not overcount squat reps under bottom-position jitter", () => {
    const frames = [
      ...Array.from({ length: 6 }, () => buildSquatLandmarks(170)),
      ...Array.from({ length: 5 }, () => buildSquatLandmarks(128)),
      ...Array.from({ length: 4 }, () => buildSquatLandmarks(98)),
      buildSquatLandmarks(104),
      buildSquatLandmarks(110),
      buildSquatLandmarks(102),
      ...Array.from({ length: 4 }, () => buildSquatLandmarks(136)),
      ...Array.from({ length: 5 }, () => buildSquatLandmarks(168)),
    ];

    expect(countReps("squat", frames)).toBe(1);
  });

  it("marks wrist-specific bicep metrics unreliable instead of turning them into corrections", () => {
    const landmarks = buildCurlLandmarks(52, { wristVisibility: 0.22 });
    landmarks[12] = { ...landmarks[12], visibility: 0.18 };
    landmarks[14] = { ...landmarks[14], visibility: 0.18 };
    landmarks[16] = { ...landmarks[16], visibility: 0.18 };
    landmarks[24] = { ...landmarks[24], visibility: 0.18 };
    const analysis = analyzeExercise("bicep_curl", landmarks, 0, undefined, "top");
    const wristMetric = analysis.metrics.find((metric) => metric.name === "Wrist Stack");

    expect(wristMetric?.reliable).toBe(false);
    expect(analysis.corrections.some((detail) => /wrist/i.test(detail))).toBe(false);
  });

  it("surfaces squat knee collapse as a specific reliable correction", () => {
    const landmarks = buildSquatLandmarks(96, { leftKneeOffset: 0.08, rightKneeOffset: -0.08 });
    const analysis = analyzeExercise("squat", landmarks, 0, undefined, "bottom");
    const kneeMetric = analysis.metrics.find((metric) => metric.name === "Knee Tracking");

    expect(kneeMetric?.score).toBeLessThan(78);
    expect(analysis.corrections[0]).toMatch(/knees over the middle toes|collapsing inward/i);
  });

  it("surfaces hard hip shift separately from knee tracking", () => {
    const landmarks = buildSquatLandmarks(98, { hipOffset: 0.08 });
    const analysis = analyzeExercise("squat", landmarks, 0, undefined, "bottom");
    const hipMetric = analysis.metrics.find((metric) => metric.name === "Hip Centering");

    expect(hipMetric?.score).toBeLessThan(78);
    expect(analysis.corrections.some((detail) => /hips centered|shifting/i.test(detail))).toBe(true);
  });
});
