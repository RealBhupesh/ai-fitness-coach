import { average, clamp, distance, midpoint, scoreFromRange, scoreFromTarget } from "@/lib/pose/math";
import type { FrameAnalysis, Landmark } from "@/lib/pose/types";
import type { DanceComparison, DanceRoutinePack, DanceRoutineSegment, DanceRoutineTargetPoint } from "@/lib/dance/types";

const INDEX_BY_POINT: Record<DanceRoutineTargetPoint, number> = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
};

function normalizeLandmark(point: Landmark | undefined, center: Landmark | null, shoulderWidth: number) {
  if (!point || !center || shoulderWidth <= 0.0001) {
    return null;
  }

  return {
    x: (point.x - center.x) / shoulderWidth,
    y: (point.y - center.y) / shoulderWidth,
  };
}

function getSegment(routine: DanceRoutinePack, elapsedMs: number) {
  const loopMs = routine.durationMs > 0 ? elapsedMs % routine.durationMs : elapsedMs;
  return (
    routine.segments.find((segment) => loopMs >= segment.startMs && loopMs < segment.endMs) ??
    routine.segments[routine.segments.length - 1]
  );
}

export function compareDanceFrame({
  landmarks,
  routine,
  elapsedMs,
  analysis,
}: {
  landmarks: Landmark[];
  routine: DanceRoutinePack;
  elapsedMs: number;
  analysis: FrameAnalysis;
}): DanceComparison | null {
  if (!landmarks.length || !routine.segments.length) {
    return null;
  }

  const segment = getSegment(routine, elapsedMs);
  if (!segment) {
    return null;
  }

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const center = midpoint(leftShoulder, rightShoulder);
  const shoulderWidth = distance(leftShoulder, rightShoulder);

  const landmarkScores = Object.entries(segment.targetLandmarks).map(([pointName, target]) => {
    const actual = normalizeLandmark(landmarks[INDEX_BY_POINT[pointName as DanceRoutineTargetPoint]], center, shoulderWidth);
    if (!actual || !target) {
      return 0;
    }

    const delta = Math.hypot(actual.x - target.x, actual.y - target.y);
    return scoreFromTarget(delta, 0, 0.38);
  });

  const frameWidth = distance(leftWrist, rightWrist) * 100;
  const armLift = average([
    ((leftShoulder?.y ?? 0) - (leftWrist?.y ?? 0)) * 100,
    ((rightShoulder?.y ?? 0) - (rightWrist?.y ?? 0)) * 100,
  ]);
  const torsoLean = Math.abs((center?.x ?? 0) - ((midpoint(leftHip, rightHip)?.x ?? center?.x ?? 0))) * 100;
  const symmetry = average([
    Math.abs((leftShoulder?.y ?? 0) - (rightShoulder?.y ?? 0)) * 100,
    Math.abs((leftHip?.y ?? 0) - (rightHip?.y ?? 0)) * 100,
  ]);
  const kneeHeight = average([
    ((leftKnee?.y ?? 0) - (leftHip?.y ?? 0)) * -180,
    ((rightKnee?.y ?? 0) - (rightHip?.y ?? 0)) * -180,
  ]);

  const metricScores = [
    scoreFromRange(frameWidth, segment.targetMetrics.frameWidth[0], segment.targetMetrics.frameWidth[1], 12),
    scoreFromRange(armLift, segment.targetMetrics.armLift[0], segment.targetMetrics.armLift[1], 10),
    scoreFromTarget(torsoLean, 0, segment.targetMetrics.torsoLeanMax),
    scoreFromRange(kneeHeight, segment.targetMetrics.kneeAngle[0], segment.targetMetrics.kneeAngle[1], 16),
    scoreFromTarget(symmetry, 0, segment.targetMetrics.symmetryMax),
  ];

  const loopMs = routine.durationMs > 0 ? elapsedMs % routine.durationMs : elapsedMs;
  const segmentMidpoint = (segment.startMs + segment.endMs) / 2;
  const timingScore = scoreFromTarget(loopMs, segmentMidpoint, Math.max((segment.endMs - segment.startMs) / 2, 1));
  const segmentCompletion = clamp(
    Math.round((((loopMs - segment.startMs) / Math.max(segment.endMs - segment.startMs, 1)) * 100)),
    0,
    100,
  );
  const transitionQuality = Math.round(average([analysis.stability, analysis.symmetry, timingScore]));
  const poseSimilarity = Math.round(average([...landmarkScores, ...metricScores]));
  const overall = Math.round(average([poseSimilarity, timingScore, transitionQuality]));

  const notes = [
    poseSimilarity < 72 ? `Match the ${segment.focus.toLowerCase()} shape more closely in this phrase.` : "",
    timingScore < 72 ? "Arrive on the phrase earlier; you are chasing the count." : "",
    transitionQuality < 72 ? "Clean up the transition before the next segment instead of carrying momentum through it." : "",
  ].filter(Boolean);

  return {
    segment,
    poseSimilarity,
    timingScore,
    segmentCompletion,
    transitionQuality,
    overall,
    notes,
  };
}
