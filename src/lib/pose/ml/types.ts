import type { ExerciseId, Landmark } from "@/lib/pose/types";

export type MlExerciseId = Extract<ExerciseId, "squat" | "bicep_curl">;

export type PostureMistakeClass =
  | "clean"
  | "squat_depth"
  | "knee_collapse"
  | "torso_fold"
  | "hip_shift"
  | "curl_elbow_drift"
  | "curl_shoulder_hike"
  | "curl_wrist_fold"
  | "curl_incomplete_rom"
  | "unstable_camera";

export type PostureModelMetadata = {
  version: string;
  name: string;
  modelType: "interpretable_threshold_model" | "centroid_classifier";
  trainedOn: string[];
  clinicalClaim: "not_medical_device";
  limitations: string[];
};

export type PostureFeatureVector = {
  names: string[];
  values: Record<string, number>;
};

export type PostureMlInput = {
  exerciseId: MlExerciseId;
  phase: string;
  landmarkWindow: Landmark[][];
  confidence: number;
};

export type PostureMlPrediction = {
  predictedQuality: number;
  mistakeProbabilities: Record<PostureMistakeClass, number>;
  modelConfidence: number;
  modelVersion: string;
  clinicalClaim: "not_medical_device";
  suppressed: boolean;
  evidenceFeatures: Record<string, number>;
};

export type PublicLandmarkSample = {
  exerciseId: MlExerciseId;
  label?: PostureMistakeClass;
  landmarks: Landmark[];
  source: "mediapipe_33_landmark_row";
};
