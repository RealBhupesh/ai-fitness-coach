export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type ExerciseId =
  | "squat"
  | "pushup"
  | "lunge"
  | "bicep_curl"
  | "jumping_jack"
  | "plank"
  | "warrior"
  | "dance_basic";

export type MetricStatus = "excellent" | "good" | "warning" | "critical";

export type LiveMetric = {
  name: string;
  score: number;
  detail: string;
  value?: number;
  target?: string;
  status: MetricStatus;
};

export type SafetySeverity = "info" | "warning" | "critical";

export type SafetyResult = {
  blocked: boolean;
  severity: SafetySeverity;
  messages: string[];
};

export type ConfidenceStatus = {
  ready: boolean;
  avgVisibility: number;
  fullBodyVisible: boolean;
  centered: boolean;
  tooFar: boolean;
  tooClose: boolean;
  message: string;
};

export type FrameAnalysis = {
  form: number;
  rom: number;
  tempo: number;
  stability: number;
  symmetry: number;
  consistency: number;
  endurance: number;
  safety: number;
  overall: number;
  phase: string;
  metrics: LiveMetric[];
  issues: string[];
  positives: string[];
  corrections: string[];
  injuryRisks: string[];
  primaryFocus?: string;
  trackedSide?: "left" | "right" | "both";
  targetCue?: string;
};

export type PoseExercise = {
  id: ExerciseId;
  label: string;
  icon: string;
  category: "strength" | "cardio" | "dance" | "mobility";
  repBased: boolean;
  tips: string[];
  calibration: string[];
};

export type RepSnapshot = {
  repNumber: number;
  phase: string;
  form: number;
  rom: number;
  tempo: number;
  safety: number;
  corrections: string[];
  durationMs: number;
  timestamps: {
    startMs?: number;
    bottomMs?: number;
    endMs?: number;
  };
};
