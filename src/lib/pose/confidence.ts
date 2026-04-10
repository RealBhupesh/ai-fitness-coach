import { average, clamp, distance } from "@/lib/pose/math";
import { evaluateFrameQuality } from "@/lib/pose/quality";
import type { ConfidenceStatus, ExerciseId, Landmark, TrackingFrame } from "@/lib/pose/types";

export function smoothLandmarks(previous: Landmark[] | null, next: Landmark[], alpha = 0.35) {
  if (!previous || previous.length !== next.length) return next;
  return next.map((landmark, index) => {
    const prior = previous[index];
    if (!prior) return landmark;
    return {
      x: prior.x + (landmark.x - prior.x) * alpha,
      y: prior.y + (landmark.y - prior.y) * alpha,
      z: (prior.z ?? 0) + ((landmark.z ?? 0) - (prior.z ?? 0)) * alpha,
      visibility: (prior.visibility ?? 1) + ((landmark.visibility ?? 1) - (prior.visibility ?? 1)) * alpha,
    };
  });
}

export function metricVisibility(landmarks: Landmark[], indices: number[]) {
  const visibilities = indices.map((index) => landmarks[index]?.visibility ?? 0);
  return {
    average: average(visibilities),
    minimum: visibilities.length ? Math.min(...visibilities) : 0,
    visibilities,
  };
}

export function isMetricReliable(
  landmarks: Landmark[],
  indices: number[],
  options: {
    minAverage?: number;
    minPoint?: number;
  } = {},
) {
  const { minAverage = 0.62, minPoint = 0.45 } = options;
  const visibility = metricVisibility(landmarks, indices);
  return visibility.average >= minAverage && visibility.minimum >= minPoint;
}

export function inferDominantSide(landmarks: Landmark[]) {
  const left = average([
    landmarks[11]?.visibility ?? 0,
    landmarks[13]?.visibility ?? 0,
    landmarks[15]?.visibility ?? 0,
    landmarks[23]?.visibility ?? 0,
    landmarks[25]?.visibility ?? 0,
    landmarks[27]?.visibility ?? 0,
  ]);
  const right = average([
    landmarks[12]?.visibility ?? 0,
    landmarks[14]?.visibility ?? 0,
    landmarks[16]?.visibility ?? 0,
    landmarks[24]?.visibility ?? 0,
    landmarks[26]?.visibility ?? 0,
    landmarks[28]?.visibility ?? 0,
  ]);
  if (Math.abs(left - right) <= 0.08) return "both";
  return left > right ? "left" : "right";
}

export function buildReliabilityMap(landmarks: Landmark[]) {
  return {
    fullBody: isMetricReliable(landmarks, [11, 12, 23, 24, 25, 26, 27, 28], { minAverage: 0.62, minPoint: 0.45 }),
    leftArm: isMetricReliable(landmarks, [11, 13, 15], { minAverage: 0.65, minPoint: 0.48 }),
    rightArm: isMetricReliable(landmarks, [12, 14, 16], { minAverage: 0.65, minPoint: 0.48 }),
    trunk: isMetricReliable(landmarks, [11, 12, 23, 24], { minAverage: 0.64, minPoint: 0.45 }),
    lowerBody: isMetricReliable(landmarks, [23, 24, 25, 26, 27, 28], { minAverage: 0.64, minPoint: 0.45 }),
    wrists: isMetricReliable(landmarks, [15, 16], { minAverage: 0.68, minPoint: 0.52 }),
    knees: isMetricReliable(landmarks, [25, 26], { minAverage: 0.66, minPoint: 0.48 }),
    ankles: isMetricReliable(landmarks, [27, 28], { minAverage: 0.64, minPoint: 0.45 }),
  };
}

export function estimateMotion(previous: Landmark[] | null, next: Landmark[]) {
  if (!previous || previous.length !== next.length) return 0;
  const keypoints = [11, 12, 15, 16, 23, 24, 25, 26];
  return average(
    keypoints.map((index) => {
      const a = previous[index];
      const b = next[index];
      return distance(a, b) * 100;
    }),
  );
}

export function buildTrackingFrame(options: {
  exerciseId: ExerciseId;
  rawLandmarks: Landmark[];
  worldLandmarks?: Landmark[];
  previousSmoothed: Landmark[] | null;
  timestampMs: number;
  frameIndex: number;
  fps: number;
  brightness: number;
  motion?: number;
}): TrackingFrame {
  const smoothedLandmarks = smoothLandmarks(options.previousSmoothed, options.rawLandmarks);
  const avgVisibility = average(smoothedLandmarks.map((landmark) => landmark.visibility ?? 0));
  const motion = typeof options.motion === "number" ? options.motion : estimateMotion(options.previousSmoothed, smoothedLandmarks);
  const quality = evaluateFrameQuality({
    exerciseId: options.exerciseId,
    landmarks: smoothedLandmarks,
    worldLandmarks: options.worldLandmarks ?? [],
    fps: options.fps,
    brightness: options.brightness,
    motion,
  });

  return {
    timestampMs: options.timestampMs,
    frameIndex: options.frameIndex,
    fps: options.fps,
    rawLandmarks: options.rawLandmarks,
    smoothedLandmarks,
    worldLandmarks: options.worldLandmarks ?? [],
    avgVisibility: clamp(avgVisibility, 0, 1),
    posePresence: clamp(avgVisibility, 0, 1),
    trackingConfidence: clamp(Math.min(avgVisibility, quality.ready ? 1 : 0.92), 0, 1),
    frameQuality: quality.frameQuality,
    frameQualityMessage: quality.message,
    view: quality.view,
    viewMessage: quality.allowedViews.includes(quality.view) ? "Camera angle is valid." : quality.message,
    brightness: options.brightness,
    motion,
    reliability: buildReliabilityMap(smoothedLandmarks),
    dominantSide: inferDominantSide(smoothedLandmarks),
  };
}

export function evaluateConfidence(input: TrackingFrame | Landmark[], exerciseId?: ExerciseId): ConfidenceStatus {
  if (Array.isArray(input)) {
    if (!exerciseId) {
      throw new Error("exerciseId is required when evaluating raw landmarks");
    }
    return evaluateFrameQuality({
      exerciseId,
      landmarks: input,
      worldLandmarks: [],
      fps: 24,
      brightness: 80,
      motion: 0,
    });
  }

  return {
    ...evaluateFrameQuality({
      exerciseId: exerciseId ?? "squat",
      landmarks: input.smoothedLandmarks,
      worldLandmarks: input.worldLandmarks,
      fps: input.fps,
      brightness: input.brightness,
      motion: input.motion,
    }),
    avgVisibility: input.avgVisibility,
  };
}
