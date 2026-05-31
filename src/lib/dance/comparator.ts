import { angle, average, clamp, distance, midpoint, scoreFromRange, scoreFromTarget } from "@/lib/pose/math";
import type { FrameAnalysis, Landmark } from "@/lib/pose/types";
import type { DanceComparison, DanceMetricGrade, DanceMetricKey, DanceRoutinePack, DanceRoutineSegment, DanceRoutineTargetPoint } from "@/lib/dance/types";

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

function gradeStatus(score: number, reliable: boolean): DanceMetricGrade["status"] {
  if (!reliable) return "unreliable";
  if (score >= 84) return "pass";
  if (score >= 68) return "warning";
  return "fail";
}

function danceMetric(options: {
  key: DanceMetricKey;
  label: string;
  score: number;
  value?: number;
  target?: string;
  reliable: boolean;
  passDetail: string;
  warningDetail: string;
}) {
  const status = gradeStatus(options.score, options.reliable);
  return {
    key: options.key,
    label: options.label,
    score: options.score,
    value: options.value,
    target: options.target,
    status,
    reliable: options.reliable,
    detail: status === "pass" ? options.passDetail : status === "unreliable" ? `${options.label} is not reliable until the full hip-hop frame is visible.` : options.warningDetail,
  };
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
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const center = midpoint(leftShoulder, rightShoulder);
  const shoulderWidth = distance(leftShoulder, rightShoulder);
  const targetPointEntries = Object.entries(segment.targetLandmarks);
  const visibleTargetPoints = targetPointEntries.filter(([pointName]) => {
    const landmark = landmarks[INDEX_BY_POINT[pointName as DanceRoutineTargetPoint]];
    return (landmark?.visibility ?? 0) >= 0.52;
  }).length;
  const landmarkReliability = targetPointEntries.length ? visibleTargetPoints / targetPointEntries.length : 1;
  const fullFrameReliable = shoulderWidth >= 0.08 && landmarkReliability >= 0.72;

  const landmarkScores = targetPointEntries.map(([pointName, target]) => {
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
  const kneeAngle = average([angle(leftHip, leftKnee, leftAnkle), angle(rightHip, rightKnee, rightAnkle)]);

  const metricScores = [
    scoreFromRange(frameWidth, segment.targetMetrics.frameWidth[0], segment.targetMetrics.frameWidth[1], 12),
    scoreFromRange(armLift, segment.targetMetrics.armLift[0], segment.targetMetrics.armLift[1], 10),
    scoreFromTarget(torsoLean, 0, segment.targetMetrics.torsoLeanMax),
    scoreFromRange(kneeAngle, segment.targetMetrics.kneeAngle[0], segment.targetMetrics.kneeAngle[1], 16),
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
  const targetFrameWidth = `${segment.targetMetrics.frameWidth[0]}-${segment.targetMetrics.frameWidth[1]} width`;
  const targetArmLift = `${segment.targetMetrics.armLift[0]}-${segment.targetMetrics.armLift[1]} lift`;
  const targetKnee = `${segment.targetMetrics.kneeAngle[0]}-${segment.targetMetrics.kneeAngle[1]} knee groove`;
  const metrics: Record<DanceMetricKey, DanceMetricGrade> = {
    poseShape: danceMetric({
      key: "poseShape",
      label: "Pose shape",
      score: poseSimilarity,
      value: poseSimilarity,
      target: segment.focus,
      reliable: fullFrameReliable,
      passDetail: `${segment.label} shape matches the hip-hop checkpoint.`,
      warningDetail: `Match the ${segment.focus.toLowerCase()} shape more closely in this phrase.`,
    }),
    grooveBounce: danceMetric({
      key: "grooveBounce",
      label: "Groove bounce",
      score: metricScores[3],
      value: Math.round(kneeAngle),
      target: targetKnee,
      reliable: fullFrameReliable,
      passDetail: "Knee bounce sits in the groove without locking.",
      warningDetail: kneeAngle > segment.targetMetrics.kneeAngle[1] ? "Soften both knees so the groove has bounce." : "Keep the bounce lighter and quicker instead of sinking too low.",
    }),
    armHits: danceMetric({
      key: "armHits",
      label: "Arm hits",
      score: Math.round(average([metricScores[0], metricScores[1]])),
      value: Number(frameWidth.toFixed(1)),
      target: `${targetFrameWidth}; ${targetArmLift}`,
      reliable: fullFrameReliable,
      passDetail: "Arm hit lands wide and readable for the count.",
      warningDetail: frameWidth < segment.targetMetrics.frameWidth[0] ? "Make the arm hit wider and more confident on the beat." : "Control the arms so the hit stays sharp instead of overextended.",
    }),
    torsoControl: danceMetric({
      key: "torsoControl",
      label: "Torso control",
      score: Math.round(average([metricScores[2], metricScores[4]])),
      value: Number(torsoLean.toFixed(1)),
      target: `0-${segment.targetMetrics.torsoLeanMax} lean`,
      reliable: fullFrameReliable,
      passDetail: "Ribs and hips stay stacked through the phrase.",
      warningDetail: "Stack ribs over hips before the next count so the groove stays centered.",
    }),
    timing: danceMetric({
      key: "timing",
      label: "Timing",
      score: timingScore,
      value: Math.round(loopMs - segmentMidpoint),
      target: "arrive near phrase midpoint",
      reliable: true,
      passDetail: "You are landing the phrase on time.",
      warningDetail: loopMs < segmentMidpoint ? "Hold the shape a touch longer before the next transition." : "Arrive earlier; you are chasing the count.",
    }),
    transition: danceMetric({
      key: "transition",
      label: "Transition",
      score: transitionQuality,
      value: transitionQuality,
      target: "stable and symmetrical between phrases",
      reliable: fullFrameReliable,
      passDetail: "Transition is controlled before the next phrase.",
      warningDetail: "Clean up the transition before the next segment instead of carrying momentum through it.",
    }),
  };
  const failedMetrics = Object.values(metrics)
    .filter((metric) => metric.reliable && metric.status === "fail")
    .map((metric) => metric.label);
  const primaryIssue = Object.values(metrics)
    .filter((metric) => metric.reliable && metric.status !== "pass")
    .sort((a, b) => a.score - b.score)[0]?.detail;
  const reliability = Math.round(landmarkReliability * 100);

  const notes = [
    primaryIssue ?? "",
    reliability < 72 ? "Dance scoring is partially limited because key wrists, shoulders, hips, or knees are not fully visible." : "",
  ].filter(Boolean);

  return {
    segment,
    poseSimilarity,
    timingScore,
    segmentCompletion,
    transitionQuality,
    overall,
    metrics,
    failedMetrics,
    primaryIssue,
    reliability,
    notes,
  };
}
