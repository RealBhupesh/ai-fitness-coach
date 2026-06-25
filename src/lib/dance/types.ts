export type DanceRoutineTargetPoint =
  | "leftWrist"
  | "rightWrist"
  | "leftShoulder"
  | "rightShoulder"
  | "leftHip"
  | "rightHip"
  | "leftKnee"
  | "rightKnee";

export type DanceRoutineSegment = {
  id: string;
  label: string;
  startMs: number;
  endMs: number;
  cue: string;
  focus: string;
  targetMetrics: {
    frameWidth: [number, number];
    armLift: [number, number];
    torsoLeanMax: number;
    kneeAngle: [number, number];
    symmetryMax: number;
  };
  targetLandmarks: Partial<Record<DanceRoutineTargetPoint, { x: number; y: number }>>;
};

export type DanceStyle = "hip_hop" | "general";

export type DanceRoutinePack = {
  id: string;
  name: string;
  description: string;
  style?: DanceStyle;
  difficulty: string;
  durationMs: number;
  bpm: number;
  audioUrl: string;
  thumbnailUrl: string;
  checkpoints: Array<{ timeMs: number; cue: string; target?: string }>;
  segments: DanceRoutineSegment[];
  tutorial?: DanceTutorialStep[];
};

export type DanceTutorialStep = {
  id: string;
  segmentId: string;
  order: number;
  title: string;
  count: string;
  teachingCue: string;
  practiceCue: string;
  commonMistake: string;
  correction: string;
};

export type DanceMetricKey =
  | "poseShape"
  | "grooveBounce"
  | "armHits"
  | "torsoControl"
  | "timing"
  | "transition";

export type DanceMetricGrade = {
  key: DanceMetricKey;
  label: string;
  score: number;
  value?: number;
  target?: string;
  status: "pass" | "warning" | "fail" | "unreliable";
  reliable: boolean;
  detail: string;
};

export type DanceComparison = {
  segment: DanceRoutineSegment;
  poseSimilarity: number;
  timingScore: number;
  segmentCompletion: number;
  transitionQuality: number;
  overall: number;
  metrics: Record<DanceMetricKey, DanceMetricGrade>;
  failedMetrics: string[];
  primaryIssue?: string;
  reliability: number;
  notes: string[];
};

export type DanceSkeletonPointName =
  | DanceRoutineTargetPoint
  | "leftElbow"
  | "rightElbow"
  | "leftAnkle"
  | "rightAnkle";

export type DanceReferenceSkeleton = {
  segmentId: string;
  label: string;
  cue: string;
  points: Record<DanceSkeletonPointName, { x: number; y: number; visible: boolean }>;
  connections: Array<[DanceSkeletonPointName, DanceSkeletonPointName]>;
};

export type DanceAiGuidanceRequest = {
  instruction: string;
  grounding: {
    claim: "AI dance coach guidance";
    style: "hip_hop";
    routineId: string;
    segmentId: string;
    segmentLabel: string;
    tutorialStep: string;
    count: string;
    score: number;
    reliability: number;
    primaryIssue?: string;
    allowedClaims: "not_medical_device";
    measuredMetrics: Record<DanceMetricKey, DanceMetricGrade>;
    referenceCue: string;
    correction: string;
  };
};

export type DanceTrainingFrameResult = {
  routineId: string;
  style: "hip_hop";
  elapsedMs: number;
  segment: DanceRoutineSegment;
  tutorialStep: DanceTutorialStep;
  referenceSkeleton: DanceReferenceSkeleton;
  comparison: DanceComparison | null;
  score: number;
  reliability: number;
  primaryCorrection: string;
  aiGuidance: DanceAiGuidanceRequest;
};
