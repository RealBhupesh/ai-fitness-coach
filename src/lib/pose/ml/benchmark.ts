import { angle, average, clamp, distance } from "@/lib/pose/math";
import type { MlExerciseId, PostureMistakeClass, PostureMlPrediction } from "@/lib/pose/ml/types";
import type { Landmark } from "@/lib/pose/types";

export type BenchmarkFrame = {
  timestampMs: number;
  landmarks: Landmark[];
};

export type TemporalPostureFeatureVector = {
  frameCount: number;
  durationMs: number;
  names: string[];
  values: Record<string, number>;
};

export type BenchmarkDatasetManifest = {
  name: string;
  sources: string[];
  sampleCount: number;
  subjectCount: number;
  captureDevice: string;
  labelProtocol: string;
  limitations: string[];
};

export type BenchmarkSample = {
  id: string;
  exerciseId: MlExerciseId;
  expected: PostureMistakeClass;
  frames: BenchmarkFrame[];
};

export type BenchmarkModelMetrics = {
  accuracy: number;
  macroF1: number;
  averageLatencyMs: number;
  confusionMatrix: Record<PostureMistakeClass, Partial<Record<PostureMistakeClass, number>>>;
};

export type PostureBenchmarkReport = {
  title: string;
  manifest: BenchmarkDatasetManifest;
  sampleCount: number;
  models: Record<string, BenchmarkModelMetrics>;
  recommendation: string;
};

function lm(landmarks: Landmark[], index: number) {
  return landmarks[index] ?? { x: 0, y: 0, z: 0, visibility: 0 };
}

function safeRatio(value: number, denominator: number) {
  return denominator > 0.0001 ? value / denominator : 0;
}

function squatSnapshot(landmarks: Landmark[]) {
  const leftShoulder = lm(landmarks, 11);
  const rightShoulder = lm(landmarks, 12);
  const leftHip = lm(landmarks, 23);
  const rightHip = lm(landmarks, 24);
  const leftKnee = lm(landmarks, 25);
  const rightKnee = lm(landmarks, 26);
  const leftAnkle = lm(landmarks, 27);
  const rightAnkle = lm(landmarks, 28);
  const shoulderSpan = Math.max(distance(leftShoulder, rightShoulder), 0.001);
  const avgKneeAngle = average([
    angle(leftHip, leftKnee, leftAnkle),
    angle(rightHip, rightKnee, rightAnkle),
  ]);

  return {
    avgKneeAngle,
    kneeWidthRatio: safeRatio(distance(leftKnee, rightKnee), shoulderSpan),
    ankleWidthRatio: safeRatio(distance(leftAnkle, rightAnkle), shoulderSpan),
    hipShiftRatio: safeRatio(Math.abs(average([leftHip.x, rightHip.x]) - average([leftAnkle.x, rightAnkle.x])), shoulderSpan),
  };
}

function meanJointVelocity(frames: BenchmarkFrame[]) {
  if (frames.length < 2) return 0;
  const keypoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  const velocities: number[] = [];
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    const elapsedSeconds = Math.max((current.timestampMs - previous.timestampMs) / 1000, 0.001);
    velocities.push(
      average(keypoints.map((pointIndex) => distance(lm(previous.landmarks, pointIndex), lm(current.landmarks, pointIndex)) / elapsedSeconds)),
    );
  }
  return average(velocities);
}

export function extractTemporalPostureFeatures(options: {
  exerciseId: MlExerciseId;
  frames: BenchmarkFrame[];
}): TemporalPostureFeatureVector {
  const frames = [...options.frames].sort((a, b) => a.timestampMs - b.timestampMs);
  const durationMs = frames.length ? frames[frames.length - 1].timestampMs - frames[0].timestampMs : 0;
  const squatSnapshots = frames.map((frame) => squatSnapshot(frame.landmarks));
  const kneeAngles = squatSnapshots.map((snapshot) => snapshot.avgKneeAngle);
  const kneeWidthRatios = squatSnapshots.map((snapshot) => snapshot.kneeWidthRatio);
  const ankleWidthRatios = squatSnapshots.map((snapshot) => snapshot.ankleWidthRatio);
  const hipShiftRatios = squatSnapshots.map((snapshot) => snapshot.hipShiftRatio);

  const values = {
    durationMs,
    meanJointVelocity: Number(meanJointVelocity(frames).toFixed(4)),
    romKneeAngle: Number((Math.max(...kneeAngles) - Math.min(...kneeAngles)).toFixed(3)),
    avgKneeAngleMin: Number(Math.min(...kneeAngles).toFixed(3)),
    kneeWidthRatioMin: Number(Math.min(...kneeWidthRatios).toFixed(3)),
    ankleWidthRatioMax: Number(Math.max(...ankleWidthRatios).toFixed(3)),
    hipShiftRatioMax: Number(Math.max(...hipShiftRatios).toFixed(3)),
  };

  return {
    frameCount: frames.length,
    durationMs,
    names: Object.keys(values),
    values,
  };
}

export function buildBenchmarkDatasetManifest(options: {
  name: string;
  sources: string[];
  sampleCount: number;
  subjectCount: number;
  captureDevice: string;
  labelProtocol: string;
}): BenchmarkDatasetManifest {
  return {
    ...options,
    limitations: [
      "This benchmark supports research-grade posture assessment only; it is not a medical device.",
      "Public datasets may not match local laptop-webcam camera angle, lighting, clothing, body diversity, or exercise execution.",
      "Local laptop-webcam validation is required before making stronger real-world accuracy claims.",
    ],
  };
}

function topClass(prediction: PostureMlPrediction): PostureMistakeClass {
  return Object.entries(prediction.mistakeProbabilities).sort((a, b) => b[1] - a[1])[0]?.[0] as PostureMistakeClass;
}

function scoreModel(results: Array<{ expected: PostureMistakeClass; predicted: PostureMistakeClass; latencyMs: number }>): BenchmarkModelMetrics {
  const labels = Array.from(new Set(results.flatMap((result) => [result.expected, result.predicted])));
  const confusionMatrix = {} as BenchmarkModelMetrics["confusionMatrix"];
  labels.forEach((label) => {
    confusionMatrix[label] = {};
  });

  let correct = 0;
  results.forEach((result) => {
    if (result.predicted === result.expected) correct += 1;
    confusionMatrix[result.expected] ??= {};
    confusionMatrix[result.expected][result.predicted] = (confusionMatrix[result.expected][result.predicted] ?? 0) + 1;
  });

  const f1Scores = labels.map((label) => {
    const tp = confusionMatrix[label]?.[label] ?? 0;
    const fp = labels.reduce((sum, other) => sum + (other === label ? 0 : confusionMatrix[other]?.[label] ?? 0), 0);
    const fn = labels.reduce((sum, other) => sum + (other === label ? 0 : confusionMatrix[label]?.[other] ?? 0), 0);
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    return precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  });

  return {
    accuracy: results.length ? Number((correct / results.length).toFixed(3)) : 0,
    macroF1: f1Scores.length ? Number(average(f1Scores).toFixed(3)) : 0,
    averageLatencyMs: results.length ? Number(average(results.map((result) => result.latencyMs)).toFixed(3)) : 0,
    confusionMatrix,
  };
}

function diagnosticFrames(sample: BenchmarkSample) {
  if (sample.exerciseId === "squat") {
    const ranked = [...sample.frames].sort((a, b) => squatSnapshot(a.landmarks).avgKneeAngle - squatSnapshot(b.landmarks).avgKneeAngle);
    return ranked.slice(0, 1);
  }
  return sample.frames;
}

export function runPostureBenchmark(options: {
  manifest: BenchmarkDatasetManifest;
  samples: BenchmarkSample[];
  evaluators: Record<string, (sample: BenchmarkSample) => PostureMlPrediction>;
}): PostureBenchmarkReport {
  const models = Object.fromEntries(
    Object.entries(options.evaluators).map(([name, evaluator]) => {
      const results = options.samples.map((sample) => {
        const started = performance.now();
        const prediction = evaluator({ ...sample, frames: diagnosticFrames(sample) });
        const latencyMs = Math.max(0, performance.now() - started);
        return {
          expected: sample.expected,
          predicted: topClass(prediction),
          latencyMs,
        };
      });
      return [name, scoreModel(results)];
    }),
  );

  return {
    title: "Posture Benchmark Report",
    manifest: options.manifest,
    sampleCount: options.samples.length,
    models,
    recommendation:
      "Use this report to compare posture models, then repeat on local webcam recordings before making stronger accuracy claims.",
  };
}

export function serializeBenchmarkReport(report: PostureBenchmarkReport) {
  const lines = [
    `# ${report.title}`,
    "",
    `Dataset: ${report.manifest.name}`,
    `Samples: ${report.sampleCount}`,
    `Subjects: ${report.manifest.subjectCount}`,
    `Sources: ${report.manifest.sources.join(", ")}`,
    `Capture device: ${report.manifest.captureDevice}`,
    `Label protocol: ${report.manifest.labelProtocol}`,
    "",
    "## Model Results",
    ...Object.entries(report.models).flatMap(([name, metrics]) => [
      `### ${name}`,
      `Accuracy: ${metrics.accuracy}`,
      `Macro F1: ${metrics.macroF1}`,
      `Average latency: ${metrics.averageLatencyMs} ms`,
      "",
      "Confusion Matrix",
      "```json",
      JSON.stringify(metrics.confusionMatrix, null, 2),
      "```",
      "",
    ]),
    "## Limitations",
    ...report.manifest.limitations.map((limitation) => `- ${limitation}`),
    "",
    `Recommendation: ${report.recommendation}`,
  ];

  return `${lines.join("\n")}\n`;
}
