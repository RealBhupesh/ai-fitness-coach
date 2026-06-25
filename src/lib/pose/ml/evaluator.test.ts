import { describe, expect, it } from "vitest";
import { createPoseCoreEngine } from "@/lib/pose/core-engine";
import { adaptMediapipeLandmarkRow, evaluatePostureMl, extractPostureFeatures } from "@/lib/pose/ml/evaluator";
import { buildPostureValidationReport } from "@/lib/pose/ml/validation";
import type { ExerciseId, FrameQualityState, Landmark, TrackingFrame } from "@/lib/pose/types";

function baseLandmarks() {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.96 })) as Landmark[];
}

function transformLandmarks(landmarks: Landmark[], options: { scale: number; dx: number; dy: number }) {
  return landmarks.map((landmark) => ({
    ...landmark,
    x: landmark.x * options.scale + options.dx,
    y: landmark.y * options.scale + options.dy,
    z: (landmark.z ?? 0) * options.scale,
  }));
}

function withSquatPose(kind: "clean" | "knee_collapse", visibility = 0.96) {
  const landmarks = baseLandmarks().map((landmark) => ({ ...landmark, visibility }));
  landmarks[11] = { x: 0.42, y: 0.28, visibility };
  landmarks[12] = { x: 0.58, y: 0.28, visibility };
  landmarks[23] = { x: 0.43, y: 0.62, visibility };
  landmarks[24] = { x: 0.57, y: 0.62, visibility };
  landmarks[25] = { x: kind === "knee_collapse" ? 0.48 : 0.43, y: 0.72, visibility };
  landmarks[26] = { x: kind === "knee_collapse" ? 0.52 : 0.57, y: 0.72, visibility };
  landmarks[27] = { x: 0.31, y: 0.72, visibility };
  landmarks[28] = { x: 0.69, y: 0.72, visibility };
  return landmarks;
}

function withCurlPose(kind: "clean" | "elbow_drift", visibility = 0.96) {
  const landmarks = baseLandmarks().map((landmark) => ({ ...landmark, visibility }));
  const elbowX = kind === "elbow_drift" ? 0.56 : 0.42;
  landmarks[11] = { x: 0.42, y: 0.34, visibility };
  landmarks[12] = { x: 0.58, y: 0.34, visibility };
  landmarks[13] = { x: elbowX, y: 0.5, visibility };
  landmarks[14] = { x: 1 - elbowX, y: 0.5, visibility };
  landmarks[15] = { x: 0.56, y: 0.43, visibility };
  landmarks[16] = { x: 0.44, y: 0.43, visibility };
  landmarks[23] = { x: 0.43, y: 0.72, visibility };
  landmarks[24] = { x: 0.57, y: 0.72, visibility };
  return landmarks;
}

function trackingFrame(options: {
  exerciseId: ExerciseId;
  landmarks: Landmark[];
  timestampMs: number;
  frameQuality?: FrameQualityState;
  confidence?: number;
}): TrackingFrame {
  const frameQuality = options.frameQuality ?? "ready";
  const confidence = options.confidence ?? 0.96;
  return {
    timestampMs: options.timestampMs,
    frameIndex: Math.round(options.timestampMs / 100),
    fps: 30,
    rawLandmarks: options.landmarks,
    smoothedLandmarks: options.landmarks,
    worldLandmarks: [],
    avgVisibility: confidence,
    posePresence: confidence,
    trackingConfidence: confidence,
    frameQuality,
    frameQualityMessage: frameQuality === "ready" ? "Ready." : "Body is not fully visible.",
    view: options.exerciseId === "squat" ? "front" : "angled",
    viewMessage: "Camera angle is valid.",
    brightness: 92,
    motion: 1,
    reliability: {
      fullBody: confidence >= 0.65,
      leftArm: confidence >= 0.65,
      rightArm: confidence >= 0.65,
      trunk: confidence >= 0.65,
      lowerBody: confidence >= 0.65,
      wrists: confidence >= 0.65,
      knees: confidence >= 0.65,
      ankles: confidence >= 0.65,
    },
    dominantSide: "both",
  };
}

describe("posture ML evaluator", () => {
  it("extracts translation and scale tolerant posture features", () => {
    const original = [withSquatPose("clean"), withSquatPose("knee_collapse")];
    const moved = original.map((landmarks) => transformLandmarks(landmarks, { scale: 1.7, dx: 0.22, dy: -0.13 }));

    const first = extractPostureFeatures({ exerciseId: "squat", phase: "bottom", landmarkWindow: original, confidence: 0.96 });
    const second = extractPostureFeatures({ exerciseId: "squat", phase: "bottom", landmarkWindow: moved, confidence: 0.96 });

    expect(second.values.kneeWidthRatio).toBeCloseTo(first.values.kneeWidthRatio, 5);
    expect(second.values.ankleWidthRatio).toBeCloseTo(first.values.ankleWidthRatio, 5);
    expect(second.values.avgKneeAngle).toBeCloseTo(first.values.avgKneeAngle, 5);
  });

  it("suppresses posture claims when model input confidence is low", () => {
    const prediction = evaluatePostureMl({
      exerciseId: "squat",
      phase: "bottom",
      landmarkWindow: [withSquatPose("clean", 0.42), withSquatPose("clean", 0.42)],
      confidence: 0.42,
    });

    expect(prediction.suppressed).toBe(true);
    expect(prediction.predictedQuality).toBe(0);
    expect(prediction.clinicalClaim).toBe("not_medical_device");
    expect(prediction.mistakeProbabilities.unstable_camera).toBeGreaterThan(0.8);
  });

  it("scores clean and flawed public-dataset-style samples through the same feature schema", () => {
    const clean = evaluatePostureMl({
      exerciseId: "squat",
      phase: "bottom",
      landmarkWindow: [withSquatPose("clean"), withSquatPose("clean")],
      confidence: 0.95,
    });
    const flawed = evaluatePostureMl({
      exerciseId: "squat",
      phase: "bottom",
      landmarkWindow: [withSquatPose("knee_collapse"), withSquatPose("knee_collapse")],
      confidence: 0.95,
    });

    expect(clean.predictedQuality).toBeGreaterThan(flawed.predictedQuality);
    expect(flawed.mistakeProbabilities.knee_collapse).toBeGreaterThan(0.6);
    expect(flawed.evidenceFeatures.kneeWidthRatio).toBeLessThan(flawed.evidenceFeatures.ankleWidthRatio);
  });

  it("maps a MediaPipe public-dataset row into the ML landmark schema", () => {
    const row = Object.fromEntries(
      Array.from({ length: 33 }, (_, index) => [
        [`x_${index}`, String(0.1 + index / 100)],
        [`y_${index}`, String(0.2 + index / 120)],
        [`z_${index}`, "0"],
        [`visibility_${index}`, "0.9"],
      ]).flat(),
    );

    const sample = adaptMediapipeLandmarkRow(row, { exerciseId: "bicep_curl", label: "curl_elbow_drift" });

    expect(sample.exerciseId).toBe("bicep_curl");
    expect(sample.label).toBe("curl_elbow_drift");
    expect(sample.landmarks).toHaveLength(33);
    expect(sample.landmarks[12].visibility).toBe(0.9);
  });

  it("keeps ML output below the camera-quality gate in the core engine", () => {
    const engine = createPoseCoreEngine({ exerciseId: "squat", guidanceMode: "ai", scoringStrictness: "trainer" });

    const result = engine.processFrame(
      trackingFrame({
        exerciseId: "squat",
        landmarks: withSquatPose("clean", 0.36),
        timestampMs: 0,
        frameQuality: "partial_body",
        confidence: 0.36,
      }),
    );

    expect(result.paused).toBe(true);
    expect(result.mlPrediction).toBeUndefined();
    expect(result.aiGuidance?.grounding.clinicalClaim).toBe("not_medical_device");
    expect(result.aiGuidance?.grounding.modelConfidence).toBe(0);
  });

  it("grounds AI guidance with model evidence and medical-claim limits", () => {
    const engine = createPoseCoreEngine({ exerciseId: "bicep_curl", guidanceMode: "ai", scoringStrictness: "trainer" });
    const sequence: Array<[number, "clean" | "elbow_drift"]> = [
      [0, "elbow_drift"],
      [160, "elbow_drift"],
      [330, "elbow_drift"],
      [450, "elbow_drift"],
      [640, "elbow_drift"],
      [800, "elbow_drift"],
      [1040, "elbow_drift"],
      [1170, "elbow_drift"],
      [1400, "elbow_drift"],
      [1560, "elbow_drift"],
    ];

    const result = sequence
      .map(([timestampMs, kind]) =>
        engine.processFrame(trackingFrame({ exerciseId: "bicep_curl", landmarks: withCurlPose(kind), timestampMs })),
      )
      .at(-1);

    expect(result?.mlPrediction?.mistakeProbabilities.curl_elbow_drift).toBeGreaterThan(0.5);
    expect(result?.aiGuidance?.grounding.modelVersion).toBe(result?.mlPrediction?.modelVersion);
    expect(result?.aiGuidance?.grounding.clinicalClaim).toBe("not_medical_device");
    expect(result?.aiGuidance?.instruction).toContain("Do not provide diagnosis");
  });

  it("builds a validation report with dataset limitation language", () => {
    const clean = evaluatePostureMl({
      exerciseId: "squat",
      phase: "bottom",
      landmarkWindow: [withSquatPose("clean"), withSquatPose("clean")],
      confidence: 0.95,
    });
    const flawed = evaluatePostureMl({
      exerciseId: "squat",
      phase: "bottom",
      landmarkWindow: [withSquatPose("knee_collapse"), withSquatPose("knee_collapse")],
      confidence: 0.95,
    });

    const report = buildPostureValidationReport([
      { expected: "clean", prediction: clean },
      { expected: "knee_collapse", prediction: flawed },
    ]);

    expect(report.sampleCount).toBe(2);
    expect(report.confusionMatrix.knee_collapse?.knee_collapse).toBe(1);
    expect(report.calibrationBuckets.length).toBeGreaterThan(0);
    expect(report.limitation).toContain("not a medical device");
  });
});
