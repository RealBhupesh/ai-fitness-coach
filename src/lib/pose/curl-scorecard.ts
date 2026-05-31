import { average, clamp, distance } from "@/lib/pose/math";
import type { FrameAnalysis, Landmark, LiveMetric, TrackingFrame } from "@/lib/pose/types";

export type CurlMetricKey =
  | "elbowPath"
  | "shoulderStability"
  | "torsoStability"
  | "wristStack"
  | "topFinish"
  | "bottomExtension"
  | "tempo"
  | "symmetry";

export type CurlMetricGrade = {
  key: CurlMetricKey;
  label: string;
  score: number;
  value?: number;
  target?: string;
  status: "pass" | "warning" | "fail" | "unreliable";
  reliable: boolean;
  detail: string;
};

export type CurlBaseline = {
  ready: boolean;
  confidence: number;
  shoulderSpan: number;
  torsoLength: number;
  armVisibility: number;
  view: string;
  message: string;
};

export type CurlRepScorecard = {
  repNumber: number;
  overall: number;
  status: "pass" | "warning" | "fail" | "unreliable";
  bestPhase: string;
  worstMetric?: CurlMetricKey;
  failedMetrics: string[];
  metrics: Record<CurlMetricKey, CurlMetricGrade>;
  reliability: number;
  coachingLevel: "easy" | "normal" | "hard";
};

export type CurlSessionEvidence = {
  totalReps: number;
  bestRep?: number;
  worstRep?: number;
  averageScore: number;
  improvementTrend: number;
  recurringFailedMetrics: string[];
  reliabilityAverage: number;
  repScorecards: CurlRepScorecard[];
};

export type CurlCoachMemory = {
  primaryMetric?: string;
  lastAverageScore: number;
  improvementTrend: number;
  reliabilityAverage: number;
  updatedAt: string;
};

type TimedFrameAnalysis = {
  timestampMs: number;
  analysis: FrameAnalysis;
};

const METRIC_MAP: Record<CurlMetricKey, { label: string; source: string }> = {
  elbowPath: { label: "Elbow path", source: "Elbow Path" },
  shoulderStability: { label: "Shoulder stability", source: "Shoulder Stability" },
  torsoStability: { label: "Torso stability", source: "Torso Stability" },
  wristStack: { label: "Wrist stack", source: "Wrist Stack" },
  topFinish: { label: "Top squeeze", source: "Top Finish" },
  bottomExtension: { label: "Bottom extension", source: "Bottom Extension" },
  tempo: { label: "Tempo control", source: "Tempo" },
  symmetry: { label: "Symmetry", source: "Symmetry" },
};

const DEFAULT_TARGETS: Record<CurlMetricKey, string> = {
  elbowPath: "0-28 drift",
  shoulderStability: "0-7 lift",
  torsoStability: "0-11 sway",
  wristStack: "0-26 fold",
  topFinish: "42-68 degrees",
  bottomExtension: "150-174 degrees",
  tempo: "controlled rep speed",
  symmetry: "0-12 degrees gap",
};

export function getCurlMetricLabel(key: CurlMetricKey) {
  return METRIC_MAP[key].label;
}

function landmarkVisibility(landmark?: Landmark) {
  return landmark?.visibility ?? 0;
}

export function buildCurlBaseline(frames: TrackingFrame[]): CurlBaseline {
  const usable = frames.filter((frame) => frame.smoothedLandmarks.length && frame.frameQuality === "ready").slice(-24);
  if (usable.length < 10) {
    return {
      ready: false,
      confidence: 0,
      shoulderSpan: 0,
      torsoLength: 0,
      armVisibility: 0,
      view: "unknown",
      message: "Hold a stable curl setup for a moment so hard mode can calibrate.",
    };
  }

  const shoulderSpans = usable.map((frame) => distance(frame.smoothedLandmarks[11], frame.smoothedLandmarks[12]));
  const torsoLengths = usable.map((frame) =>
    average([
      distance(frame.smoothedLandmarks[11], frame.smoothedLandmarks[23]),
      distance(frame.smoothedLandmarks[12], frame.smoothedLandmarks[24]),
    ]),
  );
  const armVisibility = average(
    usable.map((frame) =>
      average([11, 12, 13, 14, 15, 16, 23, 24].map((index) => landmarkVisibility(frame.smoothedLandmarks[index]))),
    ),
  );
  const confidence = average(usable.map((frame) => frame.trackingConfidence));
  const shoulderSpan = average(shoulderSpans);
  const torsoLength = average(torsoLengths);
  const view = usable[usable.length - 1]?.view ?? "unknown";
  const ready = confidence >= 0.72 && armVisibility >= 0.68 && shoulderSpan >= 0.12 && torsoLength >= 0.16;

  return {
    ready,
    confidence: Number(confidence.toFixed(2)),
    shoulderSpan: Number(shoulderSpan.toFixed(3)),
    torsoLength: Number(torsoLength.toFixed(3)),
    armVisibility: Number(armVisibility.toFixed(2)),
    view,
    message: ready
      ? "Curl baseline locked. Hard mode can judge strict rep details."
      : "Curl baseline is weak. Keep both shoulders, elbows, wrists, and hips visible before hard mode.",
  };
}

function gradeStatus(score: number, reliable: boolean): CurlMetricGrade["status"] {
  if (!reliable) return "unreliable";
  if (score >= 85) return "pass";
  if (score >= 70) return "warning";
  return "fail";
}

function metricFromFrames(key: CurlMetricKey, frames: TimedFrameAnalysis[], durationMs: number): CurlMetricGrade {
  if (key === "tempo") {
    const targetMs = 1_800;
    const score = clamp(Math.round(100 - Math.abs(durationMs - targetMs) / 22), 0, 100);
    return {
      key,
      label: METRIC_MAP[key].label,
      score,
      value: durationMs,
      target: "1300-2400 ms",
      status: gradeStatus(score, true),
      reliable: true,
      detail:
        durationMs < 1_200
          ? "Rep was too fast to control cleanly."
          : durationMs > 2_800
            ? "Rep was very slow; keep tension without stalling."
            : "Rep tempo stayed controlled.",
    };
  }

  const source = METRIC_MAP[key].source;
  const sourceFrames = key === "wristStack" ? frames.filter((frame) => frame.analysis.phase !== "top") : frames;
  const candidates = sourceFrames
    .map((frame) => frame.analysis.metrics.find((metric) => metric.name === source))
    .filter((metric): metric is LiveMetric => Boolean(metric));
  const reliable = candidates.filter((metric) => metric.reliable !== false);
  const pool = reliable.length ? reliable : candidates;
  const selected = [...pool].sort((a, b) => a.score - b.score)[0];

  if (!selected) {
    return {
      key,
      label: METRIC_MAP[key].label,
      score: 0,
      target: DEFAULT_TARGETS[key],
      status: "unreliable",
      reliable: false,
      detail: `${METRIC_MAP[key].label} was not available for this rep.`,
    };
  }

  const isReliable = reliable.includes(selected);
  return {
    key,
    label: METRIC_MAP[key].label,
    score: selected.score,
    value: selected.value,
    target: selected.target ?? DEFAULT_TARGETS[key],
    status: gradeStatus(selected.score, isReliable),
    reliable: isReliable,
    detail: selected.detail,
  };
}

export function buildCurlRepScorecard(options: {
  repNumber: number;
  frames: TimedFrameAnalysis[];
  durationMs: number;
  coachingLevel: "easy" | "normal" | "hard";
  baseline?: CurlBaseline | null;
}): CurlRepScorecard {
  const metricKeys = Object.keys(METRIC_MAP) as CurlMetricKey[];
  const metrics = metricKeys.reduce(
    (acc, key) => {
      acc[key] = metricFromFrames(key, options.frames, options.durationMs);
      return acc;
    },
    {} as Record<CurlMetricKey, CurlMetricGrade>,
  );
  const reliableMetrics = metricKeys.map((key) => metrics[key]).filter((metric) => metric.reliable);
  const reliability = metricKeys.length ? Math.round((reliableMetrics.length / metricKeys.length) * 100) : 0;
  const scorePool = reliableMetrics.length ? reliableMetrics : metricKeys.map((key) => metrics[key]);
  const overall = scorePool.length ? Math.round(average(scorePool.map((metric) => metric.score))) : 0;
  const failed = scorePool.filter((metric) => metric.status === "fail");
  const warning = scorePool.filter((metric) => metric.status === "warning");
  const worst = [...scorePool].sort((a, b) => a.score - b.score)[0];
  const baselineWeak = options.coachingLevel === "hard" && options.baseline && !options.baseline.ready;
  const status: CurlRepScorecard["status"] = baselineWeak || reliability < 50 ? "unreliable" : failed.length ? "fail" : warning.length ? "warning" : "pass";

  return {
    repNumber: options.repNumber,
    overall,
    status,
    bestPhase: [...options.frames].sort((a, b) => b.analysis.overall - a.analysis.overall)[0]?.analysis.phase ?? "unknown",
    worstMetric: worst?.key,
    failedMetrics: failed.map((metric) => metric.label),
    metrics,
    reliability,
    coachingLevel: options.coachingLevel,
  };
}

export function summarizeCurlEvidence(repScorecards: CurlRepScorecard[]): CurlSessionEvidence {
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
  repScorecards.forEach((rep) => {
    rep.failedMetrics.forEach((metric) => failedCounts.set(metric, (failedCounts.get(metric) ?? 0) + 1));
  });

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

export function summarizeCurlCoachMemory(evidence: CurlSessionEvidence): CurlCoachMemory {
  return {
    primaryMetric: evidence.recurringFailedMetrics[0],
    lastAverageScore: evidence.averageScore,
    improvementTrend: evidence.improvementTrend,
    reliabilityAverage: evidence.reliabilityAverage,
    updatedAt: new Date().toISOString(),
  };
}

function demoMetric(key: CurlMetricKey, score: number, status?: CurlMetricGrade["status"]): CurlMetricGrade {
  const resolvedStatus = status ?? gradeStatus(score, true);
  return {
    key,
    label: METRIC_MAP[key].label,
    score,
    value: score,
    target: DEFAULT_TARGETS[key],
    status: resolvedStatus,
    reliable: true,
    detail:
      resolvedStatus === "pass"
        ? `${METRIC_MAP[key].label} stayed inside the target range.`
        : resolvedStatus === "warning"
          ? `${METRIC_MAP[key].label} drifted close to the limit.`
          : `${METRIC_MAP[key].label} moved outside the target range.`,
  };
}

function demoRep(repNumber: number, scores: Partial<Record<CurlMetricKey, number>>, coachingLevel: CurlRepScorecard["coachingLevel"]): CurlRepScorecard {
  const metricKeys = Object.keys(METRIC_MAP) as CurlMetricKey[];
  const metrics = metricKeys.reduce(
    (acc, key) => {
      acc[key] = demoMetric(key, scores[key] ?? 88);
      return acc;
    },
    {} as Record<CurlMetricKey, CurlMetricGrade>,
  );
  const allMetrics = Object.values(metrics);
  const failed = allMetrics.filter((metric) => metric.status === "fail");
  const warning = allMetrics.filter((metric) => metric.status === "warning");
  const worst = [...allMetrics].sort((a, b) => a.score - b.score)[0];
  const overall = Math.round(average(allMetrics.map((metric) => metric.score)));

  return {
    repNumber,
    overall,
    status: failed.length ? "fail" : warning.length ? "warning" : "pass",
    bestPhase: "top",
    worstMetric: worst?.key,
    failedMetrics: failed.map((metric) => metric.label),
    metrics,
    reliability: 96,
    coachingLevel,
  };
}

export function buildCurlDemoSessionEvidence(coachingLevel: CurlRepScorecard["coachingLevel"] = "normal"): CurlSessionEvidence {
  return summarizeCurlEvidence([
    demoRep(1, { elbowPath: 82, shoulderStability: 86, topFinish: 78, tempo: 84 }, coachingLevel),
    demoRep(2, { elbowPath: 61, shoulderStability: 74, torsoStability: 79, wristStack: 86, topFinish: 72 }, coachingLevel),
    demoRep(3, { elbowPath: 68, shoulderStability: 63, torsoStability: 76, wristStack: 70, bottomExtension: 81 }, coachingLevel),
    demoRep(4, { elbowPath: 78, shoulderStability: 82, torsoStability: 84, wristStack: 88, topFinish: 86, tempo: 87 }, coachingLevel),
    demoRep(5, { elbowPath: 90, shoulderStability: 88, torsoStability: 89, wristStack: 92, topFinish: 90, bottomExtension: 88, tempo: 86, symmetry: 91 }, coachingLevel),
  ]);
}
