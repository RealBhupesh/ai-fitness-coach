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

export type DanceRoutinePack = {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  durationMs: number;
  bpm: number;
  audioUrl: string;
  thumbnailUrl: string;
  checkpoints: Array<{ timeMs: number; cue: string; target?: string }>;
  segments: DanceRoutineSegment[];
};

export type DanceComparison = {
  segment: DanceRoutineSegment;
  poseSimilarity: number;
  timingScore: number;
  segmentCompletion: number;
  transitionQuality: number;
  overall: number;
  notes: string[];
};
