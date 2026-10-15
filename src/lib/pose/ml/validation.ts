import type { PostureMistakeClass, PostureMlPrediction } from "@/lib/pose/ml/types";

export type ValidationExample = {
  expected: PostureMistakeClass;
  prediction: PostureMlPrediction;
};

export type PostureValidationReport = {
  sampleCount: number;
  accuracy: number;
  macroF1: number;
  confusionMatrix: Record<PostureMistakeClass, Partial<Record<PostureMistakeClass, number>>>;
  calibrationBuckets: Array<{ minConfidence: number; maxConfidence: number; accuracy: number; count: number }>;
  limitation: string;
};

function topClass(prediction: PostureMlPrediction): PostureMistakeClass {
  return Object.entries(prediction.mistakeProbabilities).sort((a, b) => b[1] - a[1])[0]?.[0] as PostureMistakeClass;
}

export function buildPostureValidationReport(examples: ValidationExample[]): PostureValidationReport {
  const labels = Array.from(new Set(examples.flatMap((example) => [example.expected, topClass(example.prediction)])));
  const confusionMatrix = {} as PostureValidationReport["confusionMatrix"];
  labels.forEach((label) => {
    confusionMatrix[label] = {};
  });

  let correct = 0;
  examples.forEach((example) => {
    const predicted = topClass(example.prediction);
    if (predicted === example.expected) correct += 1;
    confusionMatrix[example.expected] ??= {};
    confusionMatrix[example.expected][predicted] = (confusionMatrix[example.expected][predicted] ?? 0) + 1;
  });

  const f1Scores = labels.map((label) => {
    const tp = confusionMatrix[label]?.[label] ?? 0;
    const fp = labels.reduce((sum, other) => sum + (other === label ? 0 : confusionMatrix[other]?.[label] ?? 0), 0);
    const fn = labels.reduce((sum, other) => sum + (other === label ? 0 : confusionMatrix[label]?.[other] ?? 0), 0);
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    return precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  });

  const calibrationBuckets = [
    { minConfidence: 0, maxConfidence: 0.5 },
    { minConfidence: 0.5, maxConfidence: 0.75 },
    { minConfidence: 0.75, maxConfidence: 1 },
  ].map((bucket) => {
    const matching = examples.filter(
      (example) => example.prediction.modelConfidence >= bucket.minConfidence && (example.prediction.modelConfidence < bucket.maxConfidence || bucket.maxConfidence === 1),
    );
    const bucketCorrect = matching.filter((example) => topClass(example.prediction) === example.expected).length;
    return {
      ...bucket,
      accuracy: matching.length ? Number((bucketCorrect / matching.length).toFixed(3)) : 0,
      count: matching.length,
    };
  });

  return {
    sampleCount: examples.length,
    accuracy: examples.length ? Number((correct / examples.length).toFixed(3)) : 0,
    macroF1: f1Scores.length ? Number(average(f1Scores).toFixed(3)) : 0,
    confusionMatrix,
    calibrationBuckets,
    limitation: "Public dataset only; laptop-webcam validation is pending. This is not a medical device.",
  };
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
