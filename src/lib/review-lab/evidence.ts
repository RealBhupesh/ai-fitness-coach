import { REVIEW_LAB_METHODOLOGY } from "@/lib/review-lab/methodology";
import type {
  ReviewLabCueEvidence,
  ReviewLabLimitation,
  ReviewLabMetricEvidence,
  ReviewLabMistakeEvidence,
  ReviewLabModule,
  ReviewLabPhraseEvidence,
  ReviewLabReport,
  ReviewLabRepEvidence,
  ReviewLabSessionSummary,
} from "@/lib/review-lab/types";

type SessionLike = {
  id: string;
  userId: string;
  type: string;
  exerciseType?: string | null;
  date: Date;
  duration?: number | null;
  compositeScore?: number | null;
  summary?: string | null;
  totalReps?: number | null;
  frameQualityStats?: string | null;
  issueHistory?: string | null;
  telemetry?: string | null;
  postSetAnalysis?: string | null;
};

type RepLike = {
  repNumber: number;
  phase: string;
  durationMs?: number | null;
  formScore?: number | null;
  romScore?: number | null;
  tempoScore?: number | null;
  safetyScore?: number | null;
  curlScorecard?: string | null;
  squatScorecard?: string | null;
};

type FeedbackEventLike = {
  timestamp: number;
  message: string;
  severity: string;
  source: string;
};

export type BuildReviewLabReportInput = {
  session: SessionLike;
  reps: RepLike[];
  feedbackEvents: FeedbackEventLike[];
};

function parseObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function moduleFromSession(session: SessionLike): ReviewLabModule {
  if (session.type === "dance" || session.exerciseType === "dance_basic") return "dance";
  if (session.exerciseType === "bicep_curl") return "bicep_curl";
  return "squat";
}

function cameraQuality(frameQualityStats: Record<string, unknown>) {
  const confidence = Number(frameQualityStats.averageConfidence ?? frameQualityStats.confidence ?? 0.8);
  const readyRatio = Number(frameQualityStats.readyRatio ?? 0.8);
  if (confidence < 0.5 || readyRatio < 0.4) return "unreliable" as const;
  if (confidence < 0.7 || readyRatio < 0.65) return "limited" as const;
  return "ready" as const;
}

function modelConfidence(frameQualityStats: Record<string, unknown>) {
  const confidence = Number(frameQualityStats.averageConfidence ?? frameQualityStats.confidence ?? 0.8);
  const readyRatio = Number(frameQualityStats.readyRatio ?? 0.8);
  return Math.max(0, Math.min(1, Number(((confidence + readyRatio) / 2).toFixed(2))));
}

function limitationsFor(session: SessionLike, quality: "ready" | "limited" | "unreliable", evidenceCount: number): ReviewLabLimitation[] {
  const limitations: ReviewLabLimitation[] = [
    {
      code: "not_medical_device",
      message: "This report is AI coach guidance, not medical diagnosis, injury assessment, or treatment advice.",
      severity: "info",
    },
  ];

  if (quality === "limited" || quality === "unreliable") {
    limitations.push({
      code: "low_camera_confidence",
      message: "Camera or landmark confidence limited the strength of posture claims in this session.",
      severity: quality === "unreliable" ? "critical" : "warning",
    });
  }

  if (moduleFromSession(session) !== "dance" && evidenceCount === 0) {
    limitations.push({
      code: "insufficient_reps",
      message: "No rep scorecards were available, so the report relies on session-level evidence only.",
      severity: "warning",
    });
  }

  return limitations;
}

function metricFromScorecardMetric(key: string, metric: any): ReviewLabMetricEvidence {
  return {
    key,
    label: String(metric.label ?? key),
    score: Number(metric.score ?? 0),
    status: metric.reliable === false ? "unreliable" : metric.status ?? "review",
    value: typeof metric.value === "number" ? metric.value : undefined,
    target: metric.target,
    detail: String(metric.detail ?? "Measured scorecard evidence."),
    source: "rule_engine",
    confidence: metric.reliable === false ? 0.35 : 0.85,
  };
}

function mistakesFromMetrics(metrics: ReviewLabMetricEvidence[]): ReviewLabMistakeEvidence[] {
  return metrics
    .filter((metric) => metric.status === "fail" || metric.status === "warning" || metric.score < 75)
    .map((metric) => ({
      label: metric.label,
      probability: Math.max(0.1, Math.min(0.95, Number(((100 - metric.score) / 100).toFixed(2)))),
      severity: metric.score < 55 ? "critical" : "warning",
      source: metric.source,
      metricKey: metric.key,
      evidence: metric.detail,
    }));
}

function buildRepEvidence(module: ReviewLabModule, rep: RepLike): ReviewLabRepEvidence | null {
  const scorecard = module === "bicep_curl" ? parseObject<any>(rep.curlScorecard, null) : parseObject<any>(rep.squatScorecard, null);
  if (!scorecard) return null;

  const metrics = Object.entries(scorecard.metrics ?? {}).map(([key, metric]) => metricFromScorecardMetric(key, metric));
  return {
    kind: "rep",
    repNumber: rep.repNumber,
    phase: rep.phase,
    durationMs: rep.durationMs ?? 0,
    overallScore: Number(scorecard.overall ?? rep.formScore ?? 0),
    reliability: Number(scorecard.reliability ?? 0),
    failedMetrics: Array.isArray(scorecard.failedMetrics) ? scorecard.failedMetrics : [],
    metrics,
    mistakes: mistakesFromMetrics(metrics),
  };
}

function buildPhraseEvidence(session: SessionLike): ReviewLabPhraseEvidence[] {
  const telemetry = parseObject<any>(session.telemetry, {});
  const phrases = Array.isArray(telemetry.phraseEvidence) ? telemetry.phraseEvidence : [];
  return phrases.map((phrase: any) => {
    const metrics: ReviewLabMetricEvidence[] = [
      {
        key: "timing",
        label: "Timing",
        score: Number(phrase.timingScore ?? 0),
        status: Number(phrase.timingScore ?? 0) >= 80 ? "pass" : "warning",
        detail: phrase.learnerDeviation ?? "Phrase timing evidence.",
        source: "dance_comparator",
        confidence: Number(phrase.reliability ?? 0) / 100,
      },
      {
        key: "poseSimilarity",
        label: "Pose similarity",
        score: Number(phrase.poseSimilarity ?? 0),
        status: Number(phrase.poseSimilarity ?? 0) >= 80 ? "pass" : "warning",
        detail: phrase.referenceCue ?? "Reference skeleton comparison.",
        source: "dance_comparator",
        confidence: Number(phrase.reliability ?? 0) / 100,
      },
    ];

    return {
      kind: "phrase",
      phraseId: String(phrase.phraseId ?? "phrase"),
      phraseLabel: String(phrase.phraseLabel ?? "Dance phrase"),
      count: phrase.count,
      timingScore: Number(phrase.timingScore ?? 0),
      poseSimilarity: Number(phrase.poseSimilarity ?? 0),
      grooveScore: Number(phrase.grooveScore ?? 0),
      reliability: Number(phrase.reliability ?? 0),
      referenceCue: String(phrase.referenceCue ?? "Match the reference skeleton."),
      learnerDeviation: String(phrase.learnerDeviation ?? "No major deviation recorded."),
      metrics,
      mistakes: mistakesFromMetrics(metrics),
    };
  });
}

function cueHistory(events: FeedbackEventLike[], evidenceLabels: string[]): ReviewLabCueEvidence[] {
  return events.map((event) => ({
    timestamp: event.timestamp,
    message: event.message,
    severity: event.severity === "critical" ? "critical" : event.severity === "warning" ? "warning" : "info",
    source: event.source === "rule_engine" ? "rule_engine" : event.source === "system" ? "camera_gate" : "ai_coach",
    groundedBy: evidenceLabels.length ? evidenceLabels.slice(0, 3) : ["session summary"],
    claimBoundary: "AI coach guidance, not medical diagnosis",
  }));
}

function titleFor(module: ReviewLabModule) {
  if (module === "bicep_curl") return "Bicep Curl Evidence Report";
  if (module === "dance") return "Dance Phrase Evidence Report";
  return "Squat Evidence Report";
}

export function buildReviewLabReport({ session, reps, feedbackEvents }: BuildReviewLabReportInput): ReviewLabReport {
  const module = moduleFromSession(session);
  const frameStats = parseObject<Record<string, unknown>>(session.frameQualityStats, {});
  const quality = cameraQuality(frameStats);
  const evidence =
    module === "dance"
      ? buildPhraseEvidence(session)
      : reps.map((rep) => buildRepEvidence(module, rep)).filter((item): item is ReviewLabRepEvidence => Boolean(item));
  const evidenceLabels = evidence.flatMap((item) => item.metrics.map((metric) => metric.label));
  const mistakeProbabilities = evidence.flatMap((item) => item.mistakes);
  const limitations = limitationsFor(session, quality, evidence.length);
  const topMistake = mistakeProbabilities[0]?.label ?? "No repeated mistake detected";
  const score = Number(session.compositeScore ?? 0);

  return {
    id: session.id,
    userId: session.userId,
    module,
    title: titleFor(module),
    date: session.date.toISOString(),
    durationMinutes: Number(session.duration ?? 0),
    overallScore: score,
    modelConfidence: modelConfidence(frameStats),
    cameraQuality: quality,
    topMistake,
    evidenceCount: evidence.length,
    limitationCount: limitations.length,
    summary: session.summary ?? `${titleFor(module)} generated from structured session evidence.`,
    methodologyVersion: REVIEW_LAB_METHODOLOGY.version,
    claimBoundary: REVIEW_LAB_METHODOLOGY.claimBoundary,
    metricTimeline: evidence.flatMap((item, index) =>
      item.metrics.map((metric) => ({
        label: `${item.kind === "rep" ? `Rep ${item.repNumber}` : item.phraseLabel}: ${metric.label}`,
        value: metric.score,
        timestamp: index,
      })),
    ),
    evidence,
    mistakeProbabilities,
    aiCueHistory: cueHistory(feedbackEvents, evidenceLabels),
    limitations,
    exportStatus: "available",
  };
}

export function summarizeReviewLabReport(report: ReviewLabReport): ReviewLabSessionSummary {
  return {
    id: report.id,
    module: report.module,
    title: report.title,
    date: report.date,
    durationMinutes: report.durationMinutes,
    overallScore: report.overallScore,
    modelConfidence: report.modelConfidence,
    cameraQuality: report.cameraQuality,
    topMistake: report.topMistake,
    evidenceCount: report.evidenceCount,
    limitationCount: report.limitationCount,
  };
}
