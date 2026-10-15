import { buildCurlRepScorecard, type CurlRepScorecard } from "@/lib/pose/curl-scorecard";
import { analyzeExercise, advancePhaseTracker, createPhaseTrackerState, type PhaseTrackerState } from "@/lib/pose/exercises";
import { DEFAULT_POSTURE_MODEL_METADATA, evaluatePostureMl } from "@/lib/pose/ml/evaluator";
import type { PostureMistakeClass, PostureMlPrediction } from "@/lib/pose/ml/types";
import { average, clamp, distance } from "@/lib/pose/math";
import { buildSquatRepScorecard, type SquatRepScorecard } from "@/lib/pose/squat-scorecard";
import type { ExerciseId, FrameAnalysis, Landmark, LiveMetric, TrackingFrame } from "@/lib/pose/types";

type CoreExerciseId = ExerciseId;
type MlCoreExerciseId = Extract<ExerciseId, "squat" | "bicep_curl">;
type GuidanceMode = "deterministic" | "ai";
type ScoringStrictness = "demo" | "trainer";
type TimedFrameAnalysis = {
  timestampMs: number;
  analysis: FrameAnalysis;
  confidence?: number;
};

type AthleteCalibration = {
  ready: boolean;
  samples: number;
  shoulderSpan: number;
  hipSpan: number;
  torsoLength: number;
  confidence: number;
};

type RepMemory = {
  repNumber: number;
  score: number;
  displayScore: number;
  confidence: number;
  worstMetric?: string;
};

type TrendMemory = {
  direction: "improving" | "worsening" | "steady" | "insufficient_data";
  delta: number;
  repeatedIssue?: string;
  recentScores: number[];
};

type PriorityFocus = {
  metric?: string;
  reason: string;
  cue: string;
};

export type PoseCoreEngineOptions = {
  exerciseId: CoreExerciseId;
  guidanceMode?: GuidanceMode;
  scoringStrictness?: ScoringStrictness;
};

export const CORE_ENGINE_EXERCISES = [
  "squat",
  "pushup",
  "lunge",
  "bicep_curl",
  "jumping_jack",
  "plank",
  "warrior",
  "dance_basic",
] satisfies CoreExerciseId[];

export type PoseMetricGrounding = {
  name: string;
  score: number;
  detail: string;
  value?: number;
  target?: string;
  status: LiveMetric["status"];
  reliable: boolean;
};

export type PoseAiGuidanceRequest = {
  instruction: string;
  grounding: {
    claim: "AI coach guidance";
    exerciseId: CoreExerciseId;
    phase: string;
    score: number;
    confidence: number;
    primaryIssue?: string;
    context: string;
    calibration: AthleteCalibration;
    trend: TrendMemory;
    priority: PriorityFocus;
    modelVersion: string;
    predictedQuality: number;
    mistakeProbabilities: Record<PostureMistakeClass, number>;
    modelConfidence: number;
    clinicalClaim: "not_medical_device";
    corrections: string[];
    metrics: PoseMetricGrounding[];
  };
};

export type PoseCompletedRep =
  | {
      exerciseId: "squat";
      repNumber: number;
      durationMs: number;
      scorecard: SquatRepScorecard;
    }
  | {
      exerciseId: "bicep_curl";
      repNumber: number;
      durationMs: number;
      scorecard: CurlRepScorecard;
    }
  | {
      exerciseId: Exclude<CoreExerciseId, "squat" | "bicep_curl">;
      repNumber: number;
      durationMs: number;
      scorecard: GenericRepScorecard;
    };

export type PoseCoreFrameResult = {
  exerciseId: CoreExerciseId;
  phase: string;
  rawPhase: string;
  paused: boolean;
  pauseReason?: string;
  repCount: number;
  repCompleted: boolean;
  score: number;
  analysis?: FrameAnalysis;
  correction?: string;
  aiGuidance?: PoseAiGuidanceRequest;
  completedRep?: PoseCompletedRep;
  mlPrediction?: PostureMlPrediction;
};

type GenericRepMetric = {
  label: string;
  score: number;
  detail: string;
  status: LiveMetric["status"];
  reliable: boolean;
};

export type GenericRepScorecard = {
  exerciseId: Exclude<CoreExerciseId, "squat" | "bicep_curl">;
  repNumber: number;
  durationMs: number;
  overall: number;
  status: "pass" | "review" | "fail" | "unreliable";
  reliability: number;
  worstMetric?: string;
  failedMetrics: string[];
  metrics: Record<string, GenericRepMetric>;
  corrections: string[];
};

function isMlExerciseId(exerciseId: CoreExerciseId): exerciseId is MlCoreExerciseId {
  return exerciseId === "squat" || exerciseId === "bicep_curl";
}

function requiredTrackingReady(exerciseId: CoreExerciseId, frame: TrackingFrame) {
  if (frame.frameQuality !== "ready") {
    return frame.frameQualityMessage || "Camera frame is not reliable enough for form coaching.";
  }
  if (frame.trackingConfidence < 0.65) {
    return "Pose confidence is too low. Keep the body clear in the laptop camera frame.";
  }
  if (exerciseId === "squat" && !frame.reliability.fullBody) {
    return "Full body is not visible enough to judge squat form.";
  }
  if (exerciseId === "bicep_curl" && (!frame.reliability.trunk || (!frame.reliability.leftArm && !frame.reliability.rightArm))) {
    return "Shoulders, elbow, and wrist are not visible enough to judge curl form.";
  }
  if ((exerciseId === "pushup" || exerciseId === "plank") && (!frame.reliability.trunk || (!frame.reliability.leftArm && !frame.reliability.rightArm))) {
    return "Side-view shoulders, arms, hips, and ankles are not visible enough to judge this movement.";
  }
  if ((exerciseId === "lunge" || exerciseId === "jumping_jack" || exerciseId === "warrior" || exerciseId === "dance_basic") && !frame.reliability.fullBody) {
    return "Full body is not visible enough for reliable coaching on this movement.";
  }
  return null;
}

function metricGrounding(metric: LiveMetric): PoseMetricGrounding {
  return {
    name: metric.name,
    score: metric.score,
    detail: metric.detail,
    value: metric.value,
    target: metric.target,
    status: metric.status,
    reliable: metric.reliable !== false,
  };
}

function emptyCalibration(): AthleteCalibration {
  return {
    ready: false,
    samples: 0,
    shoulderSpan: 0,
    hipSpan: 0,
    torsoLength: 0,
    confidence: 0,
  };
}

function strictFrameScore(analysis: FrameAnalysis, strictness: ScoringStrictness) {
  const reliable = analysis.metrics.filter((metric) => metric.reliable !== false);
  const pool = reliable.length ? reliable : analysis.metrics;
  if (!pool.length) return analysis.overall;
  const mean = average(pool.map((metric) => metric.score));
  const worst = Math.min(...pool.map((metric) => metric.score));
  const score = strictness === "trainer" ? mean * 0.65 + worst * 0.35 : mean * 0.82 + worst * 0.18;
  return clamp(Math.round(score), 0, 100);
}

function primaryCorrection(analysis: FrameAnalysis, pausedReason?: string) {
  if (pausedReason) return pausedReason;
  const reliable = analysis.metrics
    .filter((metric) => metric.reliable !== false && metric.score < 85)
    .sort((a, b) => a.score - b.score);
  return reliable[0]?.detail ?? analysis.corrections[0] ?? analysis.primaryFocus ?? analysis.positives[0];
}

function buildAiGuidance(options: {
  exerciseId: CoreExerciseId;
  phase: string;
  score: number;
  confidence: number;
  calibration: AthleteCalibration;
  trend: TrendMemory;
  priority: PriorityFocus;
  mlPrediction?: PostureMlPrediction;
  analysis?: FrameAnalysis;
  correction?: string;
}) {
  const metrics = options.analysis?.metrics.map(metricGrounding) ?? [];
  const corrections = options.analysis?.corrections.length ? options.analysis.corrections : options.correction ? [options.correction] : [];
  const mlPrediction = options.mlPrediction;
  const mistakeProbabilities = mlPrediction?.mistakeProbabilities ?? ({} as Record<PostureMistakeClass, number>);
  const context = [
    options.calibration.ready ? "calibrated to this athlete" : "calibration still warming up",
    options.trend.direction === "improving" ? "current rep improved; reinforce the change" : "",
    mlPrediction ? `${mlPrediction.source} indicator score ${mlPrediction.predictedQuality}/100; evaluation ${mlPrediction.evaluationStatus}` : "ML posture prediction suppressed or unavailable",
    options.trend.repeatedIssue ? "repeated measured issue; not a generic cue" : "single-frame cue; stay measured",
    options.priority.reason,
  ]
    .filter(Boolean)
    .join("; ");

  return {
    instruction:
      "Write one concise, realistic trainer cue with nuance. Do not invent posture corrections; use only the measured metrics, ML prediction, calibration, trend, confidence, phase, and priority focus in grounding. Do not provide diagnosis, treatment, injury assessment, or medical-grade claims.",
    grounding: {
      claim: "AI coach guidance" as const,
      exerciseId: options.exerciseId,
      phase: options.phase,
      score: options.score,
      confidence: Number(options.confidence.toFixed(2)),
      primaryIssue: options.correction,
      context,
      calibration: options.calibration,
      trend: options.trend,
      priority: options.priority,
      modelVersion: mlPrediction?.modelVersion ?? DEFAULT_POSTURE_MODEL_METADATA.version,
      predictedQuality: mlPrediction?.predictedQuality ?? 0,
      mistakeProbabilities,
      modelConfidence: mlPrediction?.modelConfidence ?? 0,
      clinicalClaim: "not_medical_device" as const,
      corrections,
      metrics,
    },
  };
}

function buildCalibration(samples: TrackingFrame[]): AthleteCalibration {
  if (!samples.length) return emptyCalibration();
  const landmarks = samples.map((frame) => (frame.analysisLandmarks ?? frame.smoothedLandmarks));
  const shoulderSpan = average(landmarks.map((points) => distance(points[11], points[12])));
  const hipSpan = average(landmarks.map((points) => distance(points[23], points[24])));
  const torsoLength = average(
    landmarks.map((points) =>
      average([
        distance(points[11], points[23]),
        distance(points[12], points[24]),
      ]),
    ),
  );
  const confidence = average(samples.map((frame) => frame.trackingConfidence));
  return {
    ready: samples.length >= 6 && confidence >= 0.72 && shoulderSpan > 0.06 && torsoLength > 0.12,
    samples: samples.length,
    shoulderSpan: Number(shoulderSpan.toFixed(3)),
    hipSpan: Number(hipSpan.toFixed(3)),
    torsoLength: Number(torsoLength.toFixed(3)),
    confidence: Number(confidence.toFixed(2)),
  };
}

function buildTrend(memory: RepMemory[]): TrendMemory {
  if (memory.length < 2) {
    return {
      direction: "insufficient_data",
      delta: 0,
      recentScores: memory.map((rep) => rep.displayScore),
    };
  }

  const recent = memory.slice(-3);
  const previous = recent[recent.length - 2];
  const current = recent[recent.length - 1];
  const delta = current.displayScore - previous.displayScore;
  const counts = new Map<string, number>();
  recent.forEach((rep) => {
    if (rep.worstMetric) counts.set(rep.worstMetric, (counts.get(rep.worstMetric) ?? 0) + 1);
  });
  const repeatedIssue = [...counts.entries()].find((entry) => entry[1] >= 2)?.[0];

  return {
    direction: delta >= 4 ? "improving" : delta <= -4 ? "worsening" : "steady",
    delta,
    repeatedIssue,
    recentScores: recent.map((rep) => rep.displayScore),
  };
}

function buildPriority(options: {
  analysis?: FrameAnalysis;
  correction?: string;
  trend: TrendMemory;
}): PriorityFocus {
  const injuryRisk = options.analysis?.injuryRisks[0];
  if (injuryRisk) {
    return {
      reason: "safety issue takes priority over score or depth",
      cue: injuryRisk,
    };
  }

  if (options.trend.repeatedIssue) {
    return {
      metric: options.trend.repeatedIssue,
      reason: `repeated measured issue: ${options.trend.repeatedIssue}`,
      cue: options.correction ?? `Focus only on ${options.trend.repeatedIssue} for the next rep.`,
    };
  }

  const worstMetric = options.analysis?.metrics
    .filter((metric) => metric.reliable !== false)
    .sort((a, b) => a.score - b.score)[0];

  return {
    metric: worstMetric?.name,
    reason: worstMetric ? `lowest reliable metric this frame: ${worstMetric.name}` : "camera/setup cue is the only reliable coaching target",
    cue: options.correction ?? worstMetric?.detail ?? "Keep the movement controlled.",
  };
}

function scorecardSummary(rep: PoseCompletedRep, confidence: number): RepMemory {
  const worstMetric =
    rep.exerciseId === "squat"
      ? rep.scorecard.worstMetric
        ? rep.scorecard.metrics[rep.scorecard.worstMetric].label
        : rep.scorecard.failedMetrics[0]
      : rep.exerciseId === "bicep_curl"
        ? rep.scorecard.worstMetric
          ? rep.scorecard.metrics[rep.scorecard.worstMetric].label
          : rep.scorecard.failedMetrics[0]
        : rep.scorecard.worstMetric
          ? rep.scorecard.metrics[rep.scorecard.worstMetric]?.label ?? rep.scorecard.worstMetric
          : rep.scorecard.failedMetrics[0];
  const displayScore = clamp(Math.round(rep.scorecard.overall * 0.85 + confidence * 100 * 0.15), 0, 100);

  return {
    repNumber: rep.repNumber,
    score: rep.scorecard.overall,
    displayScore,
    confidence: Number(confidence.toFixed(2)),
    worstMetric,
  };
}

function metricKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function buildGenericRepScorecard(options: {
  exerciseId: Exclude<CoreExerciseId, "squat" | "bicep_curl">;
  repNumber: number;
  frames: TimedFrameAnalysis[];
  durationMs: number;
}): GenericRepScorecard {
  const metrics = new Map<string, GenericRepMetric[]>();
  const frameAnalyses = options.frames.map((frame) => frame.analysis);
  const reliability = frameAnalyses.length
    ? Math.round((frameAnalyses.filter((analysis) => analysis.frameQuality !== "partial_body").length / frameAnalyses.length) * 100)
    : 0;

  frameAnalyses.forEach((analysis) => {
    analysis.metrics.forEach((metric) => {
      const key = metricKey(metric.name);
      const bucket = metrics.get(key) ?? [];
      bucket.push({
        label: metric.name,
        score: metric.score,
        detail: metric.detail,
        status: metric.status,
        reliable: metric.reliable !== false,
      });
      metrics.set(key, bucket);
    });
  });

  const averagedMetrics = Object.fromEntries(
    [...metrics.entries()].map(([key, values]) => {
      const reliable = values.filter((value) => value.reliable);
      const pool = reliable.length ? reliable : values;
      const score = clamp(Math.round(average(pool.map((value) => value.score))), 0, 100);
      const worst = [...pool].sort((a, b) => a.score - b.score)[0];
      return [
        key,
        {
          label: worst.label,
          score,
          detail: worst.detail,
          status: score >= 88 ? "excellent" : score >= 72 ? "good" : score >= 55 ? "warning" : "critical",
          reliable: reliable.length > 0,
        } satisfies GenericRepMetric,
      ];
    }),
  );

  const metricValues = Object.values(averagedMetrics);
  const reliableValues = metricValues.filter((metric) => metric.reliable);
  const pool = reliableValues.length ? reliableValues : metricValues;
  const overall = pool.length ? clamp(Math.round(average(pool.map((metric) => metric.score))), 0, 100) : 0;
  const failedMetrics = metricValues.filter((metric) => metric.reliable && metric.score < 72).map((metric) => metric.label);
  const worstEntry = Object.entries(averagedMetrics)
    .filter(([, metric]) => metric.reliable)
    .sort(([, a], [, b]) => a.score - b.score)[0];
  const corrections = frameAnalyses.flatMap((analysis) => analysis.corrections).slice(0, 6);

  return {
    exerciseId: options.exerciseId,
    repNumber: options.repNumber,
    durationMs: options.durationMs,
    overall,
    status: reliability < 55 ? "unreliable" : overall >= 82 ? "pass" : overall >= 68 ? "review" : "fail",
    reliability,
    worstMetric: worstEntry?.[0],
    failedMetrics,
    metrics: averagedMetrics,
    corrections: Array.from(new Set(corrections)),
  };
}

function buildCompletedRep(options: {
  exerciseId: CoreExerciseId;
  repNumber: number;
  frames: TimedFrameAnalysis[];
  durationMs: number;
}): PoseCompletedRep {
  if (options.exerciseId === "squat") {
    return {
      exerciseId: "squat",
      repNumber: options.repNumber,
      durationMs: options.durationMs,
      scorecard: buildSquatRepScorecard({
        repNumber: options.repNumber,
        frames: options.frames,
        durationMs: options.durationMs,
      }),
    };
  }

  if (options.exerciseId === "bicep_curl") {
    return {
    exerciseId: "bicep_curl",
    repNumber: options.repNumber,
    durationMs: options.durationMs,
    scorecard: buildCurlRepScorecard({
      repNumber: options.repNumber,
      frames: options.frames,
      durationMs: options.durationMs,
      coachingLevel: "hard",
    }),
  };
  }

  return {
    exerciseId: options.exerciseId,
    repNumber: options.repNumber,
    durationMs: options.durationMs,
    scorecard: buildGenericRepScorecard({
      exerciseId: options.exerciseId,
      repNumber: options.repNumber,
      frames: options.frames,
      durationMs: options.durationMs,
    }),
  };
}

export function createPoseCoreEngine(options: PoseCoreEngineOptions) {
  const guidanceMode = options.guidanceMode ?? "ai";
  const scoringStrictness = options.scoringStrictness ?? "trainer";
  let phaseState: PhaseTrackerState = createPhaseTrackerState();
  let repCount = 0;
  let currentRepFrames: TimedFrameAnalysis[] = [];
  let currentRepStartedAt: number | null = null;
  let calibrationFrames: TrackingFrame[] = [];
  let repMemory: RepMemory[] = [];
  let landmarkWindow: { timestampMs: number; landmarks: Landmark[] }[] = [];
  let lastFrameTimestamp: number | null = null;

  return {
    processFrame(frame: TrackingFrame): PoseCoreFrameResult {
      if (lastFrameTimestamp !== null && (frame.timestampMs <= lastFrameTimestamp || frame.timestampMs - lastFrameTimestamp > 1000)) {
        phaseState = createPhaseTrackerState(frame.timestampMs); currentRepFrames = []; currentRepStartedAt = null; calibrationFrames = []; landmarkWindow = [];
      }
      lastFrameTimestamp = frame.timestampMs;
      const calibration = buildCalibration(calibrationFrames);
      const trend = buildTrend(repMemory);
      const pauseReason = requiredTrackingReady(options.exerciseId, frame);
      if (pauseReason) {
        phaseState = createPhaseTrackerState(frame.timestampMs); currentRepFrames = []; currentRepStartedAt = null; landmarkWindow = []; calibrationFrames = [];
        const priority = buildPriority({ correction: pauseReason, trend });
        const aiGuidance =
          guidanceMode === "ai"
            ? buildAiGuidance({
                exerciseId: options.exerciseId,
                phase: phaseState.phase,
                score: 0,
                confidence: frame.trackingConfidence,
                calibration,
                trend,
                priority,
                correction: pauseReason,
              })
            : undefined;
        return {
          exerciseId: options.exerciseId,
          phase: phaseState.phase,
          rawPhase: phaseState.rawPhase,
          paused: true,
          pauseReason,
          repCount,
          repCompleted: false,
          score: 0,
          correction: pauseReason,
          aiGuidance,
        };
      }

      calibrationFrames = [...calibrationFrames, frame].slice(-18);
      landmarkWindow = [...landmarkWindow.filter(item => frame.timestampMs - item.timestampMs <= 1000), { timestampMs: frame.timestampMs, landmarks: (frame.analysisLandmarks ?? frame.smoothedLandmarks) }];
      const activeCalibration = buildCalibration(calibrationFrames);

      const phaseUpdate = advancePhaseTracker(options.exerciseId, frame, phaseState, frame.timestampMs);
      phaseState = phaseUpdate.state;

      const analysis = analyzeExercise(options.exerciseId, frame, 0, undefined, phaseUpdate.phase);
      const mlPrediction = isMlExerciseId(options.exerciseId)
        ? evaluatePostureMl({
            exerciseId: options.exerciseId,
            phase: phaseUpdate.phase,
            landmarkWindow: landmarkWindow.map(item => item.landmarks),
            confidence: frame.trackingConfidence,
          })
        : undefined;
      const score = strictFrameScore(analysis, scoringStrictness);
      const correction = primaryCorrection(analysis);

      currentRepStartedAt ??= frame.timestampMs;
      currentRepFrames.push({ timestampMs: frame.timestampMs, analysis, confidence: frame.trackingConfidence });

      let completedRep: PoseCompletedRep | undefined;
      if (phaseUpdate.repCompleted) {
        repCount += 1;
        const durationMs = Math.max(0, frame.timestampMs - (currentRepStartedAt ?? frame.timestampMs));
        const completedFrames = currentRepFrames;
        completedRep = buildCompletedRep({
          exerciseId: options.exerciseId,
          repNumber: repCount,
          frames: completedFrames,
          durationMs,
        });
        repMemory = [
          ...repMemory,
          scorecardSummary(completedRep, average(completedFrames.map((item) => item.confidence ?? frame.trackingConfidence))),
        ].slice(-6);
        currentRepFrames = [];
        currentRepStartedAt = frame.timestampMs;
      }
      const activeTrend = buildTrend(repMemory);
      const priority = buildPriority({ analysis, correction, trend: activeTrend });

      return {
        exerciseId: options.exerciseId,
        phase: phaseUpdate.phase,
        rawPhase: phaseUpdate.rawPhase,
        paused: false,
        repCount,
        repCompleted: phaseUpdate.repCompleted,
        score,
        analysis,
        correction,
        completedRep,
        mlPrediction,
        aiGuidance:
          guidanceMode === "ai"
            ? buildAiGuidance({
                exerciseId: options.exerciseId,
                phase: phaseUpdate.phase,
                score,
                confidence: frame.trackingConfidence,
                calibration: activeCalibration,
                trend: activeTrend,
                priority,
                mlPrediction,
                analysis,
                correction,
              })
            : undefined,
      };
    },
    reset() {
      phaseState = createPhaseTrackerState();
      repCount = 0;
      currentRepFrames = [];
      currentRepStartedAt = null;
      calibrationFrames = [];
      repMemory = [];
      landmarkWindow = [];
      lastFrameTimestamp = null;
    },
    getRepCount() {
      return repCount;
    },
  };
}
