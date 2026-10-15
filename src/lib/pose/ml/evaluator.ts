import { angle, average, clamp, distance } from "@/lib/pose/math";
import type { Landmark } from "@/lib/pose/types";
import type {
  MlExerciseId,
  PostureFeatureVector,
  PostureMistakeClass,
  PostureMlInput,
  PostureMlPrediction,
  PostureModelMetadata,
  PublicLandmarkSample,
} from "@/lib/pose/ml/types";

const MISTAKE_CLASSES: PostureMistakeClass[] = [
  "clean",
  "squat_depth",
  "knee_collapse",
  "torso_fold",
  "hip_shift",
  "curl_elbow_drift",
  "curl_shoulder_hike",
  "curl_wrist_fold",
  "curl_incomplete_rom",
  "unstable_camera",
];

export const DEFAULT_POSTURE_MODEL_METADATA: PostureModelMetadata = {
  version: "heuristic-rules-v2",
  name: "Handwritten posture indicators (not a trained model)",
  modelType: "interpretable_threshold_model",
  trainedOn: [],
  clinicalClaim: "not_medical_device",
  limitations: [
    "Handwritten thresholds have not been fitted to a training dataset.",
    "Laptop-webcam validation is required before stronger real-world accuracy claims.",
    "Outputs are AI coach guidance and must not be used as diagnosis or treatment advice.",
  ],
};

function blankProbabilities() {
  return Object.fromEntries(MISTAKE_CLASSES.map((key) => [key, 0])) as Record<PostureMistakeClass, number>;
}

function lm(landmarks: Landmark[], index: number) {
  return landmarks[index] ?? { x: 0, y: 0, z: 0, visibility: 0 };
}

function visibility(landmark?: Landmark) {
  return landmark?.visibility ?? 0;
}

function safeRatio(value: number, denominator: number) {
  return denominator > 0.0001 ? value / denominator : 0;
}

function avgPoint(window: Landmark[][], index: number): Landmark {
  const points = window.map((frame) => lm(frame, index));
  return {
    x: average(points.map((point) => point.x)),
    y: average(points.map((point) => point.y)),
    z: average(points.map((point) => point.z ?? 0)),
    visibility: average(points.map(visibility)),
  };
}

export function extractPostureFeatures(input: PostureMlInput): PostureFeatureVector {
  const window = input.landmarkWindow.filter((frame) => frame.length >= 29);
  const points = window.length ? window : [input.landmarkWindow[0] ?? []];
  const leftShoulder = avgPoint(points, 11);
  const rightShoulder = avgPoint(points, 12);
  const leftElbow = avgPoint(points, 13);
  const rightElbow = avgPoint(points, 14);
  const leftWrist = avgPoint(points, 15);
  const rightWrist = avgPoint(points, 16);
  const leftHip = avgPoint(points, 23);
  const rightHip = avgPoint(points, 24);
  const leftKnee = avgPoint(points, 25);
  const rightKnee = avgPoint(points, 26);
  const leftAnkle = avgPoint(points, 27);
  const rightAnkle = avgPoint(points, 28);
  const shoulderSpan = Math.max(distance(leftShoulder, rightShoulder), 0.001);
  const hipSpan = distance(leftHip, rightHip);
  const torsoLength = average([distance(leftShoulder, leftHip), distance(rightShoulder, rightHip)]);
  const kneeWidth = distance(leftKnee, rightKnee);
  const ankleWidth = distance(leftAnkle, rightAnkle);
  const leftKneeAngle = angle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = angle(rightHip, rightKnee, rightAnkle);
  const leftElbowAngle = angle(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = angle(rightShoulder, rightElbow, rightWrist);
  const elbowDrift = average([
    Math.abs(leftElbow.x - leftShoulder.x),
    Math.abs(rightElbow.x - rightShoulder.x),
  ]);
  const shoulderHike = Math.abs(leftShoulder.y - rightShoulder.y);
  const wristFold = average([
    Math.abs(leftWrist.x - leftElbow.x),
    Math.abs(rightWrist.x - rightElbow.x),
  ]);
  const avgVisibility = average(
    points.flatMap((frame) => [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].map((index) => visibility(frame[index]))),
  );

  const values = {
    confidence: input.confidence,
    avgVisibility,
    shoulderSpan,
    hipSpanRatio: safeRatio(hipSpan, shoulderSpan),
    torsoLengthRatio: safeRatio(torsoLength, shoulderSpan),
    avgKneeAngle: average([leftKneeAngle, rightKneeAngle]),
    kneeSymmetryGap: Math.abs(leftKneeAngle - rightKneeAngle),
    kneeWidthRatio: safeRatio(kneeWidth, shoulderSpan),
    ankleWidthRatio: safeRatio(ankleWidth, shoulderSpan),
    avgElbowAngle: average([leftElbowAngle, rightElbowAngle]),
    elbowSymmetryGap: Math.abs(leftElbowAngle - rightElbowAngle),
    elbowDriftRatio: safeRatio(elbowDrift, shoulderSpan),
    shoulderHikeRatio: safeRatio(shoulderHike, shoulderSpan),
    wristFoldRatio: safeRatio(wristFold, shoulderSpan),
  };

  return {
    names: Object.keys(values),
    values,
  };
}

function predictionFromProbabilities(probabilities: Record<PostureMistakeClass, number>, features: Record<string, number>, suppressed = false): PostureMlPrediction {
  const worstMistake = Math.max(...MISTAKE_CLASSES.filter((key) => key !== "clean").map((key) => probabilities[key]));
  const clean = probabilities.clean;
  const predictedQuality = suppressed ? 0 : clamp(Math.round(clean * 100 - worstMistake * 18), 0, 100);
  const modelConfidence = suppressed ? 0 : clamp(Number(Math.max(clean, worstMistake).toFixed(2)), 0, 1);

  return {
    predictedQuality,
    mistakeProbabilities: probabilities,
    modelConfidence: 0,
    calibratedConfidence: null,
    source: "heuristic",
    evaluationStatus: "heuristic",
    featureVersion: "isotropic-geometry-v2",
    supportedFaults: ["squat_depth", "knee_collapse", "hip_shift", "curl_elbow_drift", "curl_shoulder_hike", "curl_incomplete_rom"],
    suppressionReason: suppressed ? "Insufficient visible joints" : undefined,
    modelVersion: DEFAULT_POSTURE_MODEL_METADATA.version,
    clinicalClaim: "not_medical_device",
    suppressed,
    evidenceFeatures: features,
  };
}

export function evaluatePostureMl(input: PostureMlInput): PostureMlPrediction {
  const featureVector = extractPostureFeatures(input);
  const features = featureVector.values;
  const probabilities = blankProbabilities();

  if (input.confidence < 0.65 || features.avgVisibility < 0.55 || !input.landmarkWindow.length) {
    probabilities.unstable_camera = 0.94;
    probabilities.clean = 0.02;
    return predictionFromProbabilities(probabilities, features, true);
  }

  if (input.exerciseId === "squat") {
    const kneeCollapse = clamp((0.62 - features.kneeWidthRatio) / 0.45, 0, 1);
    const shallowDepth = ["bottom", "rising", "concentric"].includes(input.phase) ? clamp((features.avgKneeAngle - 118) / 34, 0, 1) : 0;
    const overDepth = clamp((78 - features.avgKneeAngle) / 22, 0, 1);
    const symmetry = clamp(features.kneeSymmetryGap / 28, 0, 1);
    probabilities.knee_collapse = Number(kneeCollapse.toFixed(2));
    probabilities.squat_depth = Number(shallowDepth.toFixed(2));
    probabilities.hip_shift = Number(symmetry.toFixed(2));
    probabilities.torso_fold = 0;
  } else {
    const elbowDrift = clamp((features.elbowDriftRatio - 0.38) / 0.64, 0, 1);
    const shoulderHike = clamp((features.shoulderHikeRatio - 0.16) / 0.44, 0, 1);
    const wristFold = clamp((features.wristFoldRatio - 0.72) / 0.8, 0, 1);
    const incompleteRom = ["top", "bottom"].includes(input.phase) ? clamp(Math.min(Math.abs(features.avgElbowAngle - 56), Math.abs(features.avgElbowAngle - 164)) / 80, 0, 1) : 0;
    probabilities.curl_elbow_drift = Number(elbowDrift.toFixed(2));
    probabilities.curl_shoulder_hike = Number(shoulderHike.toFixed(2));
    probabilities.curl_wrist_fold = 0;
    probabilities.curl_incomplete_rom = Number(incompleteRom.toFixed(2));
  }

  const worstMistake = Math.max(...MISTAKE_CLASSES.filter((key) => key !== "clean" && key !== "unstable_camera").map((key) => probabilities[key]));
  probabilities.clean = Number(clamp(1 - worstMistake * 0.92, 0.02, 0.98).toFixed(2));
  return predictionFromProbabilities(probabilities, features);
}

function readNumber(row: Record<string, string | number>, names: string[]) {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== "") return Number(value);
  }
  return 0;
}

export function adaptMediapipeLandmarkRow(
  row: Record<string, string | number>,
  options: { exerciseId: MlExerciseId; label?: PostureMistakeClass },
): PublicLandmarkSample {
  return {
    exerciseId: options.exerciseId,
    label: options.label,
    source: "mediapipe_33_landmark_row",
    landmarks: Array.from({ length: 33 }, (_, index) => ({
      x: readNumber(row, [`x_${index}`, `${index}_x`, `landmark_${index}_x`]),
      y: readNumber(row, [`y_${index}`, `${index}_y`, `landmark_${index}_y`]),
      z: readNumber(row, [`z_${index}`, `${index}_z`, `landmark_${index}_z`]),
      visibility: readNumber(row, [`visibility_${index}`, `v_${index}`, `${index}_visibility`, `landmark_${index}_visibility`]) || 1,
    })),
  };
}
