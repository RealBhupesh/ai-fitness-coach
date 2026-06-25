import { compareDanceFrame } from "@/lib/dance/comparator";
import type {
  DanceAiGuidanceRequest,
  DanceReferenceSkeleton,
  DanceRoutinePack,
  DanceRoutineSegment,
  DanceSkeletonPointName,
  DanceTrainingFrameResult,
  DanceTutorialStep,
} from "@/lib/dance/types";
import type { FrameAnalysis, Landmark } from "@/lib/pose/types";

export const HIP_HOP_TUTORIAL_STYLE = "hip_hop" as const;

export const DANCE_SKELETON_CONNECTIONS: Array<[DanceSkeletonPointName, DanceSkeletonPointName]> = [
  ["leftWrist", "leftElbow"],
  ["leftElbow", "leftShoulder"],
  ["rightWrist", "rightElbow"],
  ["rightElbow", "rightShoulder"],
  ["leftShoulder", "rightShoulder"],
  ["leftShoulder", "leftHip"],
  ["rightShoulder", "rightHip"],
  ["leftHip", "rightHip"],
  ["leftHip", "leftKnee"],
  ["leftKnee", "leftAnkle"],
  ["rightHip", "rightKnee"],
  ["rightKnee", "rightAnkle"],
];

const DEFAULT_POINTS: Record<DanceSkeletonPointName, { x: number; y: number }> = {
  leftShoulder: { x: -0.5, y: 0 },
  rightShoulder: { x: 0.5, y: 0 },
  leftElbow: { x: -0.72, y: 0.18 },
  rightElbow: { x: 0.72, y: 0.18 },
  leftWrist: { x: -0.82, y: 0.2 },
  rightWrist: { x: 0.82, y: 0.2 },
  leftHip: { x: -0.34, y: 1.05 },
  rightHip: { x: 0.34, y: 1.05 },
  leftKnee: { x: -0.3, y: 1.82 },
  rightKnee: { x: 0.3, y: 1.82 },
  leftAnkle: { x: -0.34, y: 2.55 },
  rightAnkle: { x: 0.34, y: 2.55 },
};

function segmentAt(routine: DanceRoutinePack, elapsedMs: number) {
  const loopMs = routine.durationMs > 0 ? elapsedMs % routine.durationMs : elapsedMs;
  return routine.segments.find((segment) => loopMs >= segment.startMs && loopMs < segment.endMs) ?? routine.segments[0];
}

function countLabel(index: number) {
  const labels = ["1-2", "3-4", "5-6", "7-8"];
  return labels[index % labels.length];
}

export function buildHipHopTutorial(routine: DanceRoutinePack): DanceTutorialStep[] {
  return routine.segments.map((segment, index) => ({
    id: `${segment.id}-tutorial`,
    segmentId: segment.id,
    order: index + 1,
    title: segment.label,
    count: countLabel(index),
    teachingCue: `Watch the coach skeleton: ${segment.cue.toLowerCase()}.`,
    practiceCue: `On ${countLabel(index)}, ${segment.focus.toLowerCase()}.`,
    commonMistake:
      segment.targetMetrics.frameWidth[0] >= 50
        ? "Arms stay too narrow, so the hit does not read."
        : "Torso drifts while the groove should stay centered.",
    correction:
      segment.targetMetrics.frameWidth[0] >= 50
        ? "Match both wrists to the ghost skeleton before chasing speed."
        : "Stack ribs over hips, then add the knee bounce.",
  }));
}

export function buildReferenceSkeleton(segment: DanceRoutineSegment): DanceReferenceSkeleton {
  const scale = 22;
  const center = { x: 50, y: 24 };
  const points = Object.fromEntries(
    (Object.keys(DEFAULT_POINTS) as DanceSkeletonPointName[]).map((pointName) => {
      const target = segment.targetLandmarks[pointName as keyof typeof segment.targetLandmarks] ?? DEFAULT_POINTS[pointName];
      return [
        pointName,
        {
          x: Math.round(center.x + target.x * scale),
          y: Math.round(center.y + target.y * scale),
          visible: Boolean(segment.targetLandmarks[pointName as keyof typeof segment.targetLandmarks] ?? DEFAULT_POINTS[pointName]),
        },
      ];
    }),
  ) as DanceReferenceSkeleton["points"];

  return {
    segmentId: segment.id,
    label: segment.label,
    cue: segment.cue,
    points,
    connections: DANCE_SKELETON_CONNECTIONS,
  };
}

function getTutorialStep(routine: DanceRoutinePack, segment: DanceRoutineSegment) {
  const tutorial = routine.tutorial?.length ? routine.tutorial : buildHipHopTutorial(routine);
  return tutorial.find((step) => step.segmentId === segment.id) ?? tutorial[0];
}

function buildAiGuidance(options: {
  routine: DanceRoutinePack;
  step: DanceTutorialStep;
  segment: DanceRoutineSegment;
  comparison: NonNullable<DanceTrainingFrameResult["comparison"]> | null;
  referenceSkeleton: DanceReferenceSkeleton;
}): DanceAiGuidanceRequest {
  const primaryIssue = options.comparison?.primaryIssue;
  const correction = primaryIssue ?? options.step.correction;

  return {
    instruction:
      "Write one concise hip-hop teaching cue. Use only the measured dance metrics, active count, tutorial step, and reference skeleton cue. Do not invent unmeasured posture faults. Do not make diagnosis, treatment, injury, or medical-grade claims.",
    grounding: {
      claim: "AI dance coach guidance",
      style: HIP_HOP_TUTORIAL_STYLE,
      routineId: options.routine.id,
      segmentId: options.segment.id,
      segmentLabel: options.segment.label,
      tutorialStep: options.step.title,
      count: options.step.count,
      score: options.comparison?.overall ?? 0,
      reliability: options.comparison?.reliability ?? 0,
      primaryIssue,
      allowedClaims: "not_medical_device",
      measuredMetrics: options.comparison?.metrics ?? ({} as DanceAiGuidanceRequest["grounding"]["measuredMetrics"]),
      referenceCue: options.referenceSkeleton.cue,
      correction,
    },
  };
}

export function evaluateHipHopTrainingFrame({
  routine,
  landmarks,
  elapsedMs,
  analysis,
}: {
  routine: DanceRoutinePack;
  landmarks: Landmark[];
  elapsedMs: number;
  analysis: FrameAnalysis;
}): DanceTrainingFrameResult | null {
  const segment = segmentAt(routine, elapsedMs);
  if (!segment) return null;

  const tutorialStep = getTutorialStep(routine, segment);
  const referenceSkeleton = buildReferenceSkeleton(segment);
  const comparison = compareDanceFrame({ landmarks, routine, elapsedMs, analysis });
  const primaryCorrection = comparison?.primaryIssue ?? tutorialStep.correction;

  return {
    routineId: routine.id,
    style: HIP_HOP_TUTORIAL_STYLE,
    elapsedMs,
    segment,
    tutorialStep,
    referenceSkeleton,
    comparison,
    score: comparison?.overall ?? 0,
    reliability: comparison?.reliability ?? 0,
    primaryCorrection,
    aiGuidance: buildAiGuidance({ routine, step: tutorialStep, segment, comparison, referenceSkeleton }),
  };
}
