export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type CameraView = "front" | "angled" | "side" | "unknown";
export type CameraPreset = "desktop_hq" | "desktop_balanced" | "desktop_low";
export type FrameQualityState = "ready" | "partial_body" | "wrong_angle" | "low_light" | "motion_blur" | "occluded" | "camera_lost" | "low_fps";

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

export type CameraProfile = {
  preset: CameraPreset;
  label: string;
  width: number;
  height: number;
  frameRate: number;
  mirroredPreview: boolean;
  facingMode: "user";
};

export type TrackingFrame = {
  timestampMs: number;
  frameIndex: number;
  fps: number;
  rawLandmarks: Landmark[];
  smoothedLandmarks: Landmark[];
  worldLandmarks: Landmark[];
  avgVisibility: number;
  posePresence: number;
  trackingConfidence: number;
  frameQuality: FrameQualityState;
  frameQualityMessage: string;
  view: CameraView;
  viewMessage: string;
  brightness: number;
  motion: number;
  reliability: Record<string, boolean>;
  dominantSide: "left" | "right" | "both";
};

export type ExerciseViewPolicy = {
  allowedViews: CameraView[];
  prompt: string;
  requireFloor?: boolean;
  requireFullBody?: boolean;
};

export type ExerciseContract = {
  id: ExerciseId;
  label: string;
  viewPolicy: ExerciseViewPolicy;
  readinessRules: string[];
  feedbackKeys: string[];
};

export type SessionTelemetryType =
  | "camera_started"
  | "camera_start_failure"
  | "camera_disconnected"
  | "calibration_blocked"
  | "calibration_ready"
  | "low_confidence_pause"
  | "model_quality_downgrade"
  | "cue_suppressed"
  | "rep_counted"
  | "rep_count_corrected";

export type SessionTelemetryEvent = {
  timestampMs: number;
  type: SessionTelemetryType;
  message: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type SessionFramePoint = {
  timestampMs: number;
  overall: number;
  form: number;
  rom: number;
  tempo: number;
  stability: number;
  symmetry: number;
  safety: number;
  phase: string;
  frameQuality: FrameQualityState;
  issueSignature?: string;
};

export type SessionIssuePoint = {
  timestampMs: number;
  signature: string;
  message: string;
  severity: "critical" | "warning" | "info";
};

export type SessionPhasePoint = {
  timestampMs: number;
  phase: string;
};

export type SessionPostSetAnalysis = {
  stabilityAverage: number;
  asymmetryAverage: number;
  tempoDrift: number;
  fatigueDrop: number;
  consistencyAverage: number;
  recurringIssues: string[];
};

export type SessionAnalysisBuffer = {
  frames: SessionFramePoint[];
  issueHistory: SessionIssuePoint[];
  phaseHistory: SessionPhasePoint[];
  frameQualityStats: Record<FrameQualityState, number>;
  telemetry: SessionTelemetryEvent[];
  postSet: SessionPostSetAnalysis;
};

export type LiveMetric = {
  name: string;
  score: number;
  detail: string;
  value?: number;
  target?: string;
  status: MetricStatus;
  reliable?: boolean;
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
  frameQuality: FrameQualityState;
  view: CameraView;
  allowedViews: CameraView[];
  brightness: number;
  motion: number;
  pauseTracking: boolean;
  reasons: string[];
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
  primaryIssueKey?: string;
  secondaryNote?: string;
  trackedSide?: "left" | "right" | "both";
  targetCue?: string;
  unreliableMetrics?: string[];
  frameQuality?: FrameQualityState;
  view?: CameraView;
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
