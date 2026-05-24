import { average, distance } from "@/lib/pose/math";
import type { CameraView, ConfidenceStatus, ExerciseContract, ExerciseId, FrameQualityState, Landmark } from "@/lib/pose/types";

const REQUIRED_BY_EXERCISE: Record<ExerciseId, number[]> = {
  squat: [11, 12, 23, 24, 25, 26, 27, 28],
  pushup: [11, 13, 15, 23, 25, 27],
  lunge: [11, 12, 23, 24, 25, 26, 27, 28],
  bicep_curl: [11, 12, 13, 14, 15, 16, 23, 24],
  jumping_jack: [11, 12, 15, 16, 23, 24, 27, 28],
  plank: [11, 13, 15, 23, 25, 27],
  warrior: [11, 12, 15, 16, 23, 24, 25, 27],
  dance_basic: [11, 12, 15, 16, 23, 24, 25, 26, 27, 28],
};

export const EXERCISE_VIEW_POLICIES: Record<ExerciseId, ExerciseContract["viewPolicy"]> = {
  squat: {
    allowedViews: ["front", "angled"],
    prompt: "Stand front-on or at a 30-45 degree angle so hips, knees, and ankles stay visible.",
    requireFullBody: true,
  },
  bicep_curl: {
    allowedViews: ["front", "angled"],
    prompt: "Use a front or slightly angled view so both elbows and wrists stay visible.",
  },
  lunge: {
    allowedViews: ["front", "angled"],
    prompt: "Use a front or slightly angled view and keep both legs in frame.",
    requireFullBody: true,
  },
  jumping_jack: {
    allowedViews: ["front", "angled"],
    prompt: "Face the camera with full body visible and space above your hands.",
    requireFullBody: true,
  },
  pushup: {
    allowedViews: ["side"],
    prompt: "Rotate into a side view so shoulder, hip, and ankle form a clear line.",
    requireFloor: true,
  },
  plank: {
    allowedViews: ["side"],
    prompt: "Use a clean side view with floor line visible so body alignment is clear.",
    requireFloor: true,
  },
  warrior: {
    allowedViews: ["side", "angled"],
    prompt: "Use a side or slightly angled view so the front knee and arm line are readable.",
    requireFullBody: true,
  },
  dance_basic: {
    allowedViews: ["front"],
    prompt: "Face the camera with full body visible and room left-right for arm lines.",
    requireFloor: true,
    requireFullBody: true,
  },
};

function visibility(landmark?: Landmark | null) {
  return landmark?.visibility ?? 0;
}

export function inferCameraView(landmarks: Landmark[], worldLandmarks: Landmark[]) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const shoulderWidth = distance(leftShoulder, rightShoulder);
  const hipWidth = distance(leftHip, rightHip);
  const averageWidth = average([shoulderWidth, hipWidth]);
  const shoulderDepth = Math.abs((worldLandmarks[11]?.z ?? leftShoulder?.z ?? 0) - (worldLandmarks[12]?.z ?? rightShoulder?.z ?? 0));
  const hipDepth = Math.abs((worldLandmarks[23]?.z ?? leftHip?.z ?? 0) - (worldLandmarks[24]?.z ?? rightHip?.z ?? 0));
  const averageDepth = average([shoulderDepth, hipDepth]);

  if (averageWidth < 0.05) return "unknown";
  if (averageDepth < 0.06 && averageWidth > 0.14) return "front";
  if (averageDepth > 0.11 || averageWidth < 0.11) return "side";
  return "angled";
}

type QualityInput = {
  exerciseId: ExerciseId;
  landmarks: Landmark[];
  worldLandmarks: Landmark[];
  fps: number;
  brightness: number;
  motion: number;
};

export function evaluateFrameQuality(input: QualityInput): ConfidenceStatus {
  const requiredPoints = REQUIRED_BY_EXERCISE[input.exerciseId];
  const visibilities = requiredPoints.map((index) => visibility(input.landmarks[index]));
  const avgVisibility = average(visibilities);
  const fullBodyVisible = visibilities.every((item) => item > 0.45);

  const xs = requiredPoints.map((index) => input.landmarks[index]?.x).filter((value): value is number => typeof value === "number");
  const ys = requiredPoints.map((index) => input.landmarks[index]?.y).filter((value): value is number => typeof value === "number");
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 1;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 1;
  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centered = Math.abs(centerX - 0.5) < 0.24;
  const tooClose = width > 0.82 || height > 0.95;
  const tooFar = width < 0.16 || height < 0.3;

  const view = inferCameraView(input.landmarks, input.worldLandmarks);
  const policy = EXERCISE_VIEW_POLICIES[input.exerciseId];
  const allowedViews = policy.allowedViews;
  const reasons: string[] = [];
  let frameQuality: FrameQualityState = "ready";
  let message = "Ready for live coaching.";

  if (!input.landmarks.length) {
    frameQuality = "camera_lost";
    message = "Camera lost. Step back into frame.";
    reasons.push(message);
  } else if (!fullBodyVisible) {
    frameQuality = avgVisibility < 0.3 ? "camera_lost" : avgVisibility < 0.5 ? "partial_body" : "occluded";
    message =
      frameQuality === "partial_body"
        ? policy.requireFullBody
          ? "Show your full body from shoulders to feet, then hold still for calibration."
          : "Bring your shoulders, elbows, wrists, and hips clearly into frame."
        : "Critical joints are occluded. Move hands, clothes, or equipment away from the tracked joints.";
    reasons.push(message);
  } else if (!centered || tooClose || tooFar) {
    frameQuality = "partial_body";
    message = !centered
      ? "Center yourself in the camera frame so both sides are visible."
      : tooClose
        ? "Step back slightly so the coach can see the full movement path."
        : "Move a bit closer so joints are large enough to track accurately.";
    reasons.push(message);
  } else if (!allowedViews.includes(view)) {
    frameQuality = "wrong_angle";
    message = `${policy.prompt} Current view looks ${view}.`;
    reasons.push(message);
  } else if (input.brightness < 45) {
    frameQuality = "low_light";
    message = "Improve lighting on the front of your body so joints stay visible.";
    reasons.push(message);
  } else if (input.fps < 15) {
    frameQuality = "low_fps";
    message = "Tracking is running slow. Close other apps or switch to a lower camera quality.";
    reasons.push(message);
  } else if (input.motion > 9.5 && avgVisibility < 0.72) {
    frameQuality = "motion_blur";
    message = "Your movement is too blurred to coach reliably. Slow the rep and keep the body fully visible.";
    reasons.push(message);
  }

  return {
    ready: frameQuality === "ready" && avgVisibility >= 0.6,
    avgVisibility,
    fullBodyVisible,
    centered,
    tooFar,
    tooClose,
    message,
    frameQuality,
    view,
    allowedViews,
    brightness: input.brightness,
    motion: input.motion,
    pauseTracking: frameQuality !== "ready",
    reasons,
  };
}
