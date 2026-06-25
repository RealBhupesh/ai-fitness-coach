import { describe, expect, it } from "vitest";
import { CORE_ENGINE_EXERCISES, createPoseCoreEngine } from "@/lib/pose/core-engine";
import { POSE_EXERCISES } from "@/lib/pose/exercises";
import type { ExerciseId, FrameQualityState, Landmark, TrackingFrame } from "@/lib/pose/types";

function baseLandmarks() {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.96 })) as Landmark[];
}

function withSquatPose(kind: "top" | "mid" | "bottom", visibility = 0.96) {
  const landmarks = baseLandmarks().map((landmark) => ({ ...landmark, visibility }));
  const shoulderY = 0.28;
  const hipY = kind === "top" ? 0.48 : kind === "mid" ? 0.55 : 0.62;
  const kneeY = kind === "top" ? 0.66 : kind === "mid" ? 0.68 : 0.72;
  const ankleY = kind === "top" ? 0.86 : kind === "mid" ? 0.78 : 0.72;
  const ankleOffset = kind === "bottom" ? 0.12 : kind === "mid" ? 0.07 : 0.01;

  landmarks[11] = { x: 0.42, y: shoulderY, visibility };
  landmarks[12] = { x: 0.58, y: shoulderY, visibility };
  landmarks[23] = { x: 0.43, y: hipY, visibility };
  landmarks[24] = { x: 0.57, y: hipY, visibility };
  landmarks[25] = { x: 0.43, y: kneeY, visibility };
  landmarks[26] = { x: 0.57, y: kneeY, visibility };
  landmarks[27] = { x: 0.43 - ankleOffset, y: ankleY, visibility };
  landmarks[28] = { x: 0.57 + ankleOffset, y: ankleY, visibility };
  return landmarks;
}

function withCurlPose(kind: "bottom" | "curling" | "top", visibility = 0.96) {
  const landmarks = baseLandmarks().map((landmark) => ({ ...landmark, visibility }));
  const wrist =
    kind === "bottom"
      ? { x: 0.42, y: 0.7 }
      : kind === "curling"
        ? { x: 0.5, y: 0.58 }
        : { x: 0.56, y: 0.43 };

  landmarks[11] = { x: 0.42, y: 0.34, visibility };
  landmarks[12] = { x: 0.58, y: 0.34, visibility };
  landmarks[13] = { x: 0.42, y: 0.5, visibility };
  landmarks[14] = { x: 0.58, y: 0.5, visibility };
  landmarks[15] = { ...wrist, visibility };
  landmarks[16] = { x: 1 - wrist.x, y: wrist.y, visibility };
  landmarks[23] = { x: 0.43, y: 0.72, visibility };
  landmarks[24] = { x: 0.57, y: 0.72, visibility };
  return landmarks;
}

function setArmAngle(landmarks: Landmark[], side: "left" | "right", angleDeg: number, visibility = 0.96) {
  const shoulderIndex = side === "left" ? 11 : 12;
  const elbowIndex = side === "left" ? 13 : 14;
  const wristIndex = side === "left" ? 15 : 16;
  const shoulderX = side === "left" ? 0.42 : 0.58;
  const elbowX = shoulderX;
  const shoulderY = 0.3;
  const elbowY = 0.45;
  const radius = 0.14;
  const radians = (angleDeg * Math.PI) / 180;

  landmarks[shoulderIndex] = { x: shoulderX, y: shoulderY, visibility };
  landmarks[elbowIndex] = { x: elbowX, y: elbowY, visibility };
  landmarks[wristIndex] = {
    x: elbowX + radius * Math.sin(radians) * (side === "left" ? 1 : -1),
    y: elbowY - radius * Math.cos(radians),
    visibility,
  };
}

function withPushupPose(kind: "top" | "lowering" | "bottom", visibility = 0.96) {
  const landmarks = baseLandmarks().map((landmark) => ({ ...landmark, visibility }));
  const angle = kind === "top" ? 170 : kind === "lowering" ? 125 : 88;

  setArmAngle(landmarks, "left", angle, visibility);
  setArmAngle(landmarks, "right", angle, visibility);
  landmarks[23] = { x: 0.52, y: 0.5, visibility };
  landmarks[24] = { x: 0.62, y: 0.5, visibility };
  landmarks[25] = { x: 0.6, y: 0.62, visibility };
  landmarks[26] = { x: 0.7, y: 0.62, visibility };
  landmarks[27] = { x: 0.68, y: 0.74, visibility };
  landmarks[28] = { x: 0.78, y: 0.74, visibility };
  return landmarks;
}

function setLegAngle(landmarks: Landmark[], side: "left" | "right", angleDeg: number, visibility = 0.96) {
  const hipIndex = side === "left" ? 23 : 24;
  const kneeIndex = side === "left" ? 25 : 26;
  const ankleIndex = side === "left" ? 27 : 28;
  const centerX = side === "left" ? 0.43 : 0.57;
  const hipY = 0.42;
  const kneeY = 0.62;
  const radius = 0.17;
  const radians = (angleDeg * Math.PI) / 180;

  landmarks[hipIndex] = { x: centerX, y: hipY, visibility };
  landmarks[kneeIndex] = { x: centerX, y: kneeY, visibility };
  landmarks[ankleIndex] = {
    x: centerX + radius * Math.sin(radians) * (side === "left" ? 1 : -1),
    y: kneeY - radius * Math.cos(radians),
    visibility,
  };
}

function withLungePose(kind: "top" | "lowering" | "bottom", visibility = 0.96) {
  const landmarks = baseLandmarks().map((landmark) => ({ ...landmark, visibility }));
  const angle = kind === "top" ? 162 : kind === "lowering" ? 132 : 92;

  landmarks[11] = { x: 0.42, y: 0.24, visibility };
  landmarks[12] = { x: 0.58, y: 0.24, visibility };
  setLegAngle(landmarks, "left", angle, visibility);
  setLegAngle(landmarks, "right", 150, visibility);
  return landmarks;
}

function withJumpingJackPose(kind: "closed" | "open", visibility = 0.96) {
  const landmarks = baseLandmarks().map((landmark) => ({ ...landmark, visibility }));
  const shoulderWidth = 0.18;

  landmarks[11] = { x: 0.5 - shoulderWidth / 2, y: 0.3, visibility };
  landmarks[12] = { x: 0.5 + shoulderWidth / 2, y: 0.3, visibility };
  landmarks[23] = { x: 0.44, y: 0.52, visibility };
  landmarks[24] = { x: 0.56, y: 0.52, visibility };
  landmarks[25] = { x: 0.44, y: 0.66, visibility };
  landmarks[26] = { x: 0.56, y: 0.66, visibility };

  if (kind === "open") {
    landmarks[15] = { x: 0.5 - 1.25 * shoulderWidth, y: 0.12, visibility };
    landmarks[16] = { x: 0.5 + 1.25 * shoulderWidth, y: 0.12, visibility };
    landmarks[27] = { x: 0.5 - 0.95 * shoulderWidth, y: 0.82, visibility };
    landmarks[28] = { x: 0.5 + 0.95 * shoulderWidth, y: 0.82, visibility };
  } else {
    landmarks[15] = { x: 0.5 - 0.45 * shoulderWidth, y: 0.62, visibility };
    landmarks[16] = { x: 0.5 + 0.45 * shoulderWidth, y: 0.62, visibility };
    landmarks[27] = { x: 0.5 - 0.25 * shoulderWidth, y: 0.82, visibility };
    landmarks[28] = { x: 0.5 + 0.25 * shoulderWidth, y: 0.82, visibility };
  }

  return landmarks;
}

function trackingFrame(options: {
  exerciseId: ExerciseId;
  landmarks: Landmark[];
  timestampMs: number;
  frameQuality?: FrameQualityState;
  confidence?: number;
}): TrackingFrame {
  const ready = options.frameQuality ?? "ready";
  return {
    timestampMs: options.timestampMs,
    frameIndex: Math.round(options.timestampMs / 100),
    fps: 30,
    rawLandmarks: options.landmarks,
    smoothedLandmarks: options.landmarks,
    worldLandmarks: [],
    avgVisibility: options.confidence ?? 0.96,
    posePresence: options.confidence ?? 0.96,
    trackingConfidence: options.confidence ?? 0.96,
    frameQuality: ready,
    frameQualityMessage: ready === "ready" ? "Ready." : "Body is not fully visible.",
    view: options.exerciseId === "squat" ? "front" : "angled",
    viewMessage: "Camera angle is valid.",
    brightness: 92,
    motion: 1,
    reliability: {
      fullBody: true,
      leftArm: true,
      rightArm: true,
      trunk: true,
      lowerBody: true,
      wrists: true,
      knees: true,
      ankles: true,
    },
    dominantSide: "both",
  };
}

describe("pose core engine", () => {
  it("covers every exercise exposed in the live coach picker", () => {
    expect(CORE_ENGINE_EXERCISES).toEqual(POSE_EXERCISES.map((exercise) => exercise.id));
  });

  it("pauses strict scoring and AI guidance when camera quality is unreliable", () => {
    const engine = createPoseCoreEngine({ exerciseId: "squat", guidanceMode: "ai", scoringStrictness: "trainer" });

    const result = engine.processFrame(
      trackingFrame({
        exerciseId: "squat",
        landmarks: withSquatPose("top", 0.3),
        timestampMs: 0,
        frameQuality: "partial_body",
        confidence: 0.38,
      }),
    );

    expect(result.paused).toBe(true);
    expect(result.repCount).toBe(0);
    expect(result.score).toBe(0);
    expect(result.aiGuidance?.grounding.confidence).toBeLessThan(0.65);
    expect(result.aiGuidance?.instruction).toContain("Do not invent posture corrections");
  });

  it("counts a strict squat rep after bottom is loaded and the athlete returns to top", () => {
    const engine = createPoseCoreEngine({ exerciseId: "squat", guidanceMode: "ai", scoringStrictness: "trainer" });
    const sequence: Array<[number, "top" | "mid" | "bottom"]> = [
      [0, "top"],
      [150, "top"],
      [300, "mid"],
      [430, "mid"],
      [620, "bottom"],
      [800, "bottom"],
      [1030, "mid"],
      [1160, "mid"],
      [1360, "top"],
      [1500, "top"],
    ];

    const results = sequence.map(([timestampMs, kind]) =>
      engine.processFrame(trackingFrame({ exerciseId: "squat", landmarks: withSquatPose(kind), timestampMs })),
    );
    const completed = results.find((result) => result.repCompleted);

    expect(completed?.repCount).toBe(1);
    expect(completed?.completedRep?.exerciseId).toBe("squat");
    expect(completed?.completedRep?.scorecard.status).not.toBe("unreliable");
    expect(completed?.aiGuidance?.grounding.exerciseId).toBe("squat");
    expect(completed?.aiGuidance?.grounding.metrics.length).toBeGreaterThan(0);
  });

  it("counts a strict bicep curl rep and grounds AI guidance in measured metrics", () => {
    const engine = createPoseCoreEngine({ exerciseId: "bicep_curl", guidanceMode: "ai", scoringStrictness: "trainer" });
    const sequence: Array<[number, "bottom" | "curling" | "top"]> = [
      [0, "bottom"],
      [160, "bottom"],
      [330, "curling"],
      [450, "curling"],
      [640, "top"],
      [800, "top"],
      [1040, "curling"],
      [1170, "curling"],
      [1400, "bottom"],
      [1560, "bottom"],
    ];

    const results = sequence.map(([timestampMs, kind]) =>
      engine.processFrame(trackingFrame({ exerciseId: "bicep_curl", landmarks: withCurlPose(kind), timestampMs })),
    );
    const completed = results.find((result) => result.repCompleted);

    expect(completed?.repCount).toBe(1);
    expect(completed?.completedRep?.exerciseId).toBe("bicep_curl");
    expect(completed?.completedRep?.scorecard.reliability).toBeGreaterThanOrEqual(50);
    expect(completed?.aiGuidance?.grounding.exerciseId).toBe("bicep_curl");
    expect(completed?.aiGuidance?.grounding.claim).toBe("AI coach guidance");
  });

  it("calibrates the athlete from stable laptop-webcam frames before coaching posture", () => {
    const engine = createPoseCoreEngine({ exerciseId: "squat", guidanceMode: "ai", scoringStrictness: "trainer" });

    for (let index = 0; index < 6; index += 1) {
      engine.processFrame(trackingFrame({ exerciseId: "squat", landmarks: withSquatPose("top"), timestampMs: index * 140 }));
    }

    const result = engine.processFrame(trackingFrame({ exerciseId: "squat", landmarks: withSquatPose("mid"), timestampMs: 900 }));

    expect(result.aiGuidance?.grounding.calibration.ready).toBe(true);
    expect(result.aiGuidance?.grounding.calibration.samples).toBeGreaterThanOrEqual(6);
    expect(result.aiGuidance?.grounding.calibration.shoulderSpan).toBeGreaterThan(0);
    expect(result.aiGuidance?.grounding.context).toContain("calibrated to this athlete");
  });

  it("escalates repeated measured mistakes instead of returning a generic cue", () => {
    const engine = createPoseCoreEngine({ exerciseId: "squat", guidanceMode: "ai", scoringStrictness: "trainer" });

    const sequence: Array<[number, "top" | "mid" | "bottom"]> = [
      [0, "top"],
      [150, "top"],
      [300, "mid"],
      [430, "mid"],
      [620, "bottom"],
      [800, "bottom"],
      [1030, "mid"],
      [1160, "mid"],
      [1360, "top"],
      [1500, "top"],
      [1750, "mid"],
      [1890, "mid"],
      [2090, "bottom"],
      [2270, "bottom"],
      [2500, "mid"],
      [2640, "mid"],
      [2850, "top"],
      [3000, "top"],
    ];

    const results = sequence.map(([timestampMs, kind]) =>
      engine.processFrame(trackingFrame({ exerciseId: "squat", landmarks: withSquatPose(kind), timestampMs })),
    );
    const completed = results.filter((result) => result.repCompleted).at(-1);

    expect(completed?.aiGuidance?.grounding.priority.reason).toContain("repeated");
    expect(completed?.aiGuidance?.grounding.trend.repeatedIssue).toBeTruthy();
    expect(completed?.aiGuidance?.grounding.context).toContain("not a generic cue");
  });

  it("adds improvement context when the current rep is better than the previous rep", () => {
    const engine = createPoseCoreEngine({ exerciseId: "bicep_curl", guidanceMode: "ai", scoringStrictness: "trainer" });
    const sequence: Array<[number, "bottom" | "curling" | "top", number]> = [
      [0, "bottom", 0.72],
      [160, "bottom", 0.72],
      [330, "curling", 0.72],
      [450, "curling", 0.72],
      [640, "top", 0.72],
      [800, "top", 0.72],
      [1040, "curling", 0.72],
      [1170, "curling", 0.72],
      [1400, "bottom", 0.72],
      [1560, "bottom", 0.72],
      [1840, "curling", 0.96],
      [1980, "curling", 0.96],
      [2180, "top", 0.96],
      [2340, "top", 0.96],
      [2580, "curling", 0.96],
      [2720, "curling", 0.96],
      [2940, "bottom", 0.96],
      [3100, "bottom", 0.96],
    ];

    const results = sequence.map(([timestampMs, kind, visibility]) =>
      engine.processFrame(trackingFrame({ exerciseId: "bicep_curl", landmarks: withCurlPose(kind, visibility), timestampMs, confidence: visibility })),
    );
    const completed = results.filter((result) => result.repCompleted).at(-1);

    expect(completed?.aiGuidance?.grounding.trend.direction).toBe("improving");
    expect(completed?.aiGuidance?.grounding.context).toContain("improved");
  });

  it("counts push-up reps with generic measured scorecards and grounded AI guidance", () => {
    const engine = createPoseCoreEngine({ exerciseId: "pushup", guidanceMode: "ai", scoringStrictness: "trainer" });
    const sequence: Array<[number, "top" | "lowering" | "bottom"]> = [
      [0, "top"],
      [160, "top"],
      [340, "lowering"],
      [500, "lowering"],
      [700, "bottom"],
      [860, "bottom"],
      [1080, "lowering"],
      [1240, "lowering"],
      [1460, "top"],
      [1620, "top"],
    ];

    const results = sequence.map(([timestampMs, kind]) =>
      engine.processFrame(trackingFrame({ exerciseId: "pushup", landmarks: withPushupPose(kind), timestampMs })),
    );
    const completed = results.find((result) => result.repCompleted);

    expect(completed?.repCount).toBe(1);
    expect(completed?.completedRep?.exerciseId).toBe("pushup");
    expect(completed?.completedRep?.exerciseId === "pushup" ? completed.completedRep.scorecard.metrics.depth.score : 0).toBeGreaterThan(0);
    expect(completed?.aiGuidance?.grounding.exerciseId).toBe("pushup");
    expect(completed?.aiGuidance?.grounding.metrics.map((metric) => metric.name)).toContain("Body Line");
  });

  it("counts lunge reps and prioritizes measured lower-body faults", () => {
    const engine = createPoseCoreEngine({ exerciseId: "lunge", guidanceMode: "ai", scoringStrictness: "trainer" });
    const sequence: Array<[number, "top" | "lowering" | "bottom"]> = [
      [0, "top"],
      [160, "top"],
      [340, "lowering"],
      [500, "lowering"],
      [700, "bottom"],
      [860, "bottom"],
      [1080, "lowering"],
      [1240, "lowering"],
      [1460, "top"],
      [1620, "top"],
    ];

    const results = sequence.map(([timestampMs, kind]) =>
      engine.processFrame(trackingFrame({ exerciseId: "lunge", landmarks: withLungePose(kind), timestampMs })),
    );
    const completed = results.find((result) => result.repCompleted);

    expect(completed?.repCount).toBe(1);
    expect(completed?.completedRep?.exerciseId).toBe("lunge");
    expect(completed?.completedRep?.exerciseId === "lunge" ? completed.completedRep.scorecard.metrics.front_knee.label : "").toBe("Front Knee");
    expect(completed?.aiGuidance?.grounding.corrections.length).toBeGreaterThanOrEqual(0);
  });

  it("counts jumping-jack reps without ML claims for unsupported exercises", () => {
    const engine = createPoseCoreEngine({ exerciseId: "jumping_jack", guidanceMode: "ai", scoringStrictness: "trainer" });
    const sequence: Array<[number, "closed" | "open"]> = [
      [0, "closed"],
      [160, "closed"],
      [360, "open"],
      [540, "open"],
      [760, "closed"],
      [940, "closed"],
      [1120, "closed"],
      [1300, "closed"],
    ];

    const results = sequence.map(([timestampMs, kind]) =>
      engine.processFrame(trackingFrame({ exerciseId: "jumping_jack", landmarks: withJumpingJackPose(kind), timestampMs })),
    );
    const completed = results.find((result) => result.repCompleted);

    expect(completed?.repCount).toBe(1);
    expect(completed?.completedRep?.exerciseId).toBe("jumping_jack");
    expect(completed?.mlPrediction).toBeUndefined();
    expect(completed?.aiGuidance?.grounding.predictedQuality).toBe(0);
  });

  it("scores plank as a hold module without inventing rep completions", () => {
    const engine = createPoseCoreEngine({ exerciseId: "plank", guidanceMode: "ai", scoringStrictness: "trainer" });

    const result = engine.processFrame(trackingFrame({ exerciseId: "plank", landmarks: withPushupPose("top"), timestampMs: 0 }));

    expect(result.repCompleted).toBe(false);
    expect(result.repCount).toBe(0);
    expect(result.score).toBeGreaterThan(0);
    expect(result.aiGuidance?.grounding.exerciseId).toBe("plank");
    expect(result.aiGuidance?.grounding.metrics.map((metric) => metric.name)).toContain("Body Line");
  });
});
