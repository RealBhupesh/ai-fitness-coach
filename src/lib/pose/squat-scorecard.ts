import { average } from "@/lib/pose/math";
import type { FrameAnalysis, LiveMetric } from "@/lib/pose/types";

export type SquatMetricKey = "depth" | "kneeTracking" | "torsoStack" | "hipCentering" | "symmetry" | "shoulderStability" | "tempo";

export type SquatMetricGrade = {
  key: SquatMetricKey;
  label: string;
  score: number;
  value?: number;
  target?: string;
  status: "pass" | "warning" | "fail" | "unreliable";
  reliable: boolean;
  detail: string;
};

export type SquatRepScorecard = {
  repNumber: number;
  overall: number;
  status: "pass" | "warning" | "fail" | "unreliable";
  bestPhase: string;
  worstMetric?: SquatMetricKey;
  failedMetrics: string[];
  metrics: Record<SquatMetricKey, SquatMetricGrade>;
  reliability: number;
};

export type SquatSessionEvidence = {
  totalReps: number;
  bestRep?: number;
  worstRep?: number;
  averageScore: number;
  improvementTrend: number;
  recurringFailedMetrics: string[];
  reliabilityAverage: number;
  repScorecards: SquatRepScorecard[];
};

type TimedFrameAnalysis = {
  timestampMs: number;
  analysis: FrameAnalysis;
};

const METRIC_MAP: Record<SquatMetricKey, { label: string; source: string; target: string }> = {
  depth: { label: "Depth", source: "Depth", target: "86-108 degrees" },
  kneeTracking: { label: "Knee tracking", source: "Knee Tracking", target: "0-10 inward collapse" },
  torsoStack: { label: "Torso stack", source: "Torso Stack", target: "58-82 degrees" },
  hipCentering: { label: "Hip centering", source: "Hip Centering", target: "0-11 shift" },
  symmetry: { label: "Symmetry", source: "Symmetry", target: "0-14 degrees gap" },
  shoulderStability: { label: "Shoulder stability", source: "Shoulder Stability", target: "0-8 tilt" },
  tempo: { label: "Tempo control", source: "Tempo", target: "1400-3000 ms" },
};

export function getSquatMetricLabel(key: SquatMetricKey) {
  return METRIC_MAP[key].label;
}

function gradeStatus(score: number, reliable: boolean): SquatMetricGrade["status"] {
  if (!reliable) return "unreliable";
  if (score >= 84) return "pass";
  if (score >= 68) return "warning";
  return "fail";
}

function metricFromLiveMetric(key: SquatMetricKey, metric: LiveMetric | undefined): SquatMetricGrade {
  if (!metric) {
    return {
      key,
      label: METRIC_MAP[key].label,
      score: 0,
      target: METRIC_MAP[key].target,
      status: "unreliable",
      reliable: false,
      detail: `${METRIC_MAP[key].label} was not available for this rep.`,
    };
  }
  const reliable = metric.reliable !== false;
  return {
    key,
    label: METRIC_MAP[key].label,
    score: metric.score,
    value: metric.value,
    target: metric.target ?? METRIC_MAP[key].target,
    status: gradeStatus(metric.score, reliable),
    reliable,
    detail: metric.detail,
  };
}

function metricFromFrames(key: SquatMetricKey, frames: TimedFrameAnalysis[], durationMs: number): SquatMetricGrade {
  if (key === "tempo") {
    const score = Math.max(0, Math.min(100, Math.round(100 - Math.abs(durationMs - 2_200) / 24)));
    return {
      key,
      label: METRIC_MAP[key].label,
      score,
      value: durationMs,
      target: METRIC_MAP[key].target,
      status: gradeStatus(score, true),
      reliable: true,
      detail:
        durationMs < 1_200
          ? "Squat rep was too fast to control the bottom."
          : durationMs > 3_400
            ? "Squat rep stalled. Keep control without pausing too long."
            : "Squat tempo stayed controlled.",
    };
  }

  const source = METRIC_MAP[key].source;
  const phaseFrames = key === "depth" || key === "kneeTracking" || key === "hipCentering" ? frames.filter((frame) => frame.analysis.phase === "bottom" || frame.analysis.phase === "rising" || frame.analysis.phase === "lowering") : frames;
  const candidates = (phaseFrames.length ? phaseFrames : frames)
    .map((frame) => frame.analysis.metrics.find((metric) => metric.name === source))
    .filter((metric): metric is LiveMetric => Boolean(metric));
  const reliable = candidates.filter((metric) => metric.reliable !== false);
  const pool = reliable.length ? reliable : candidates;
  return metricFromLiveMetric(key, [...pool].sort((a, b) => a.score - b.score)[0]);
}

export function buildSquatRepScorecard(options: {
  repNumber: number;
  frames: TimedFrameAnalysis[];
  durationMs: number;
}): SquatRepScorecard {
  const metricKeys = Object.keys(METRIC_MAP) as SquatMetricKey[];
  const metrics = metricKeys.reduce(
    (acc, key) => {
      acc[key] = metricFromFrames(key, options.frames, options.durationMs);
      return acc;
    },
    {} as Record<SquatMetricKey, SquatMetricGrade>,
  );
  const reliableMetrics = metricKeys.map((key) => metrics[key]).filter((metric) => metric.reliable);
  const reliability = metricKeys.length ? Math.round((reliableMetrics.length / metricKeys.length) * 100) : 0;
  const scorePool = reliableMetrics.length ? reliableMetrics : metricKeys.map((key) => metrics[key]);
  const overall = scorePool.length ? Math.round(average(scorePool.map((metric) => metric.score))) : 0;
  const failed = scorePool.filter((metric) => metric.status === "fail");
  const warning = scorePool.filter((metric) => metric.status === "warning");
  const worst = [...scorePool].sort((a, b) => a.score - b.score)[0];
  const status: SquatRepScorecard["status"] = reliability < 55 ? "unreliable" : failed.length ? "fail" : warning.length ? "warning" : "pass";

  return {
    repNumber: options.repNumber,
    overall,
    status,
    bestPhase: [...options.frames].sort((a, b) => b.analysis.overall - a.analysis.overall)[0]?.analysis.phase ?? "unknown",
    worstMetric: worst?.key,
    failedMetrics: failed.map((metric) => metric.label),
    metrics,
    reliability,
  };
}

export function summarizeSquatEvidence(repScorecards: SquatRepScorecard[]): SquatSessionEvidence {
  if (!repScorecards.length) {
    return {
      totalReps: 0,
      averageScore: 0,
      improvementTrend: 0,
      recurringFailedMetrics: [],
      reliabilityAverage: 0,
      repScorecards: [],
    };
  }

  const sortedBest = [...repScorecards].sort((a, b) => b.overall - a.overall);
  const sortedWorst = [...repScorecards].sort((a, b) => a.overall - b.overall);
  const firstHalf = repScorecards.slice(0, Math.max(1, Math.floor(repScorecards.length / 2)));
  const secondHalf = repScorecards.slice(Math.floor(repScorecards.length / 2));
  const failedCounts = new Map<string, number>();
  repScorecards.forEach((rep) => rep.failedMetrics.forEach((metric) => failedCounts.set(metric, (failedCounts.get(metric) ?? 0) + 1)));

  return {
    totalReps: repScorecards.length,
    bestRep: sortedBest[0]?.repNumber,
    worstRep: sortedWorst[0]?.repNumber,
    averageScore: Math.round(average(repScorecards.map((rep) => rep.overall))),
    improvementTrend: Math.round(average(secondHalf.map((rep) => rep.overall)) - average(firstHalf.map((rep) => rep.overall))),
    recurringFailedMetrics: Array.from(failedCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([metric]) => metric),
    reliabilityAverage: Math.round(average(repScorecards.map((rep) => rep.reliability))),
    repScorecards,
  };
}

function demoMetric(key: SquatMetricKey, score: number): SquatMetricGrade {
  const status = gradeStatus(score, true);
  return {
    key,
    label: METRIC_MAP[key].label,
    score,
    value: score,
    target: METRIC_MAP[key].target,
    status,
    reliable: true,
    detail:
      status === "pass"
        ? `${METRIC_MAP[key].label} stayed inside the target range.`
        : status === "warning"
          ? `${METRIC_MAP[key].label} drifted close to the limit.`
          : `${METRIC_MAP[key].label} moved outside the target range.`,
  };
}

function demoRep(repNumber: number, scores: Partial<Record<SquatMetricKey, number>>): SquatRepScorecard {
  const metricKeys = Object.keys(METRIC_MAP) as SquatMetricKey[];
  const metrics = metricKeys.reduce(
    (acc, key) => {
      acc[key] = demoMetric(key, scores[key] ?? 88);
      return acc;
    },
    {} as Record<SquatMetricKey, SquatMetricGrade>,
  );
  const allMetrics = Object.values(metrics);
  const failed = allMetrics.filter((metric) => metric.status === "fail");
  const warning = allMetrics.filter((metric) => metric.status === "warning");
  const worst = [...allMetrics].sort((a, b) => a.score - b.score)[0];

  return {
    repNumber,
    overall: Math.round(average(allMetrics.map((metric) => metric.score))),
    status: failed.length ? "fail" : warning.length ? "warning" : "pass",
    bestPhase: "bottom",
    worstMetric: worst?.key,
    failedMetrics: failed.map((metric) => metric.label),
    metrics,
    reliability: 95,
  };
}

export function buildSquatDemoSessionEvidence(): SquatSessionEvidence {
  return summarizeSquatEvidence([
    demoRep(1, { depth: 74, kneeTracking: 78, torsoStack: 82, tempo: 84 }),
    demoRep(2, { depth: 62, kneeTracking: 65, torsoStack: 76, hipCentering: 80 }),
    demoRep(3, { depth: 70, kneeTracking: 72, torsoStack: 64, symmetry: 78 }),
    demoRep(4, { depth: 84, kneeTracking: 86, torsoStack: 82, hipCentering: 86, tempo: 88 }),
    demoRep(5, { depth: 91, kneeTracking: 89, torsoStack: 88, hipCentering: 90, symmetry: 88, shoulderStability: 90, tempo: 87 }),
  ]);
}
