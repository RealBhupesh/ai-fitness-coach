import { average, clamp } from "@/lib/pose/math";
import type { ConfidenceStatus, ExerciseId, Landmark } from "@/lib/pose/types";

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

export function evaluateConfidence(landmarks: Landmark[], exerciseId: ExerciseId): ConfidenceStatus {
  const requiredPoints = REQUIRED_BY_EXERCISE[exerciseId];
  const visibilities = requiredPoints.map((index) => landmarks[index]?.visibility ?? 0);
  const avgVisibility = average(visibilities);
  const fullBodyVisible = visibilities.every((visibility) => visibility > 0.45);

  const xs = requiredPoints.map((index) => landmarks[index]?.x).filter((value): value is number => typeof value === "number");
  const ys = requiredPoints.map((index) => landmarks[index]?.y).filter((value): value is number => typeof value === "number");

  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 1;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 1;

  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centered = Math.abs(centerX - 0.5) < 0.24;
  const tooClose = width > 0.82 || height > 0.95;
  const tooFar = width < 0.16 || height < 0.30;

  let message = "Ready for calibration";
  if (!fullBodyVisible) {
    message = "Show your full body in frame";
  } else if (!centered) {
    message = "Center yourself in the frame";
  } else if (tooClose) {
    message = "Step back slightly";
  } else if (tooFar) {
    message = "Move a bit closer";
  } else if (avgVisibility < 0.6) {
    message = "Improve lighting or camera angle";
  }

  return {
    ready: fullBodyVisible && centered && !tooClose && !tooFar && avgVisibility >= 0.6,
    avgVisibility: clamp(avgVisibility, 0, 1),
    fullBodyVisible,
    centered,
    tooFar,
    tooClose,
    message,
  };
}
