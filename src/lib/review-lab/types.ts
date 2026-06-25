export type ReviewLabModule = "squat" | "bicep_curl" | "dance";

export type ReviewLabEvidenceSource =
  | "rule_engine"
  | "ml_evaluator"
  | "dance_comparator"
  | "camera_gate"
  | "ai_coach";

export type ReviewLabClaimBoundary = "AI coach guidance, not medical diagnosis";

export type ReviewLabMetricEvidence = {
  key: string;
  label: string;
  score: number;
  status: "pass" | "warning" | "fail" | "unreliable" | "review";
  value?: number;
  target?: string;
  detail: string;
  source: ReviewLabEvidenceSource;
  confidence: number;
};

export type ReviewLabMistakeEvidence = {
  label: string;
  probability: number;
  severity: "info" | "warning" | "critical";
  source: ReviewLabEvidenceSource;
  metricKey?: string;
  evidence: string;
};

export type ReviewLabCueEvidence = {
  timestamp: number;
  message: string;
  severity: "info" | "warning" | "critical";
  source: ReviewLabEvidenceSource;
  groundedBy: string[];
  claimBoundary: ReviewLabClaimBoundary;
};

export type ReviewLabRepEvidence = {
  kind: "rep";
  repNumber: number;
  phase: string;
  durationMs: number;
  overallScore: number;
  reliability: number;
  failedMetrics: string[];
  metrics: ReviewLabMetricEvidence[];
  mistakes: ReviewLabMistakeEvidence[];
};

export type ReviewLabPhraseEvidence = {
  kind: "phrase";
  phraseId: string;
  phraseLabel: string;
  count?: string;
  timingScore: number;
  poseSimilarity: number;
  grooveScore: number;
  reliability: number;
  referenceCue: string;
  learnerDeviation: string;
  metrics: ReviewLabMetricEvidence[];
  mistakes: ReviewLabMistakeEvidence[];
};

export type ReviewLabLimitation = {
  code:
    | "low_camera_confidence"
    | "body_out_of_frame"
    | "insufficient_reps"
    | "ml_unavailable"
    | "dance_reference_unavailable"
    | "not_medical_device";
  message: string;
  severity: "info" | "warning" | "critical";
};

export type ReviewLabSessionSummary = {
  id: string;
  module: ReviewLabModule;
  title: string;
  date: string;
  durationMinutes: number;
  overallScore: number;
  modelConfidence: number;
  cameraQuality: "ready" | "limited" | "unreliable";
  topMistake: string;
  evidenceCount: number;
  limitationCount: number;
};

export type ReviewLabReport = ReviewLabSessionSummary & {
  userId: string;
  summary: string;
  methodologyVersion: string;
  claimBoundary: ReviewLabClaimBoundary;
  metricTimeline: Array<{ label: string; value: number; timestamp?: number }>;
  evidence: Array<ReviewLabRepEvidence | ReviewLabPhraseEvidence>;
  mistakeProbabilities: ReviewLabMistakeEvidence[];
  aiCueHistory: ReviewLabCueEvidence[];
  limitations: ReviewLabLimitation[];
  exportStatus: "available";
};

export type ReviewLabMethodology = {
  version: string;
  claimBoundary: ReviewLabClaimBoundary;
  modules: Array<{
    id: ReviewLabModule;
    name: string;
    measuredSignals: string[];
    evidenceSources: ReviewLabEvidenceSource[];
  }>;
  scoringPolicy: string[];
  confidencePolicy: string[];
  limitations: string[];
  references: Array<{ label: string; url: string }>;
};

export type ReviewLabExportPayload = {
  generatedAt: string;
  report: ReviewLabReport;
  methodology: ReviewLabMethodology;
};
