import type { ReviewLabMethodology } from "@/lib/review-lab/types";

export const REVIEW_LAB_METHODOLOGY: ReviewLabMethodology = {
  version: "review-lab-2026-06-25",
  claimBoundary: "AI coach guidance, not medical diagnosis",
  modules: [
    {
      id: "squat",
      name: "Squat Form Review",
      measuredSignals: ["depth", "knee tracking", "torso stack", "hip centering", "symmetry", "tempo", "camera confidence"],
      evidenceSources: ["rule_engine", "ml_evaluator", "camera_gate", "ai_coach"],
    },
    {
      id: "bicep_curl",
      name: "Bicep Curl Review",
      measuredSignals: ["elbow path", "wrist stack", "shoulder stability", "range of motion", "tempo", "symmetry", "camera confidence"],
      evidenceSources: ["rule_engine", "ml_evaluator", "camera_gate", "ai_coach"],
    },
    {
      id: "dance",
      name: "Dance Phrase Review",
      measuredSignals: ["pose similarity", "timing", "groove bounce", "arm hit", "torso control", "reference skeleton deviation"],
      evidenceSources: ["dance_comparator", "camera_gate", "ai_coach"],
    },
  ],
  scoringPolicy: [
    "Deterministic scorecards provide the primary measured evidence for strength exercises.",
    "ML posture predictions may add mistake probabilities when available, but do not override camera-quality gates.",
    "Dance reports use phrase-level comparison against the packaged reference skeleton.",
    "AI wording is generated only from measured evidence and report context.",
  ],
  confidencePolicy: [
    "Camera confidence below usable thresholds adds limitations to the report.",
    "Low-confidence evidence is marked unreliable instead of hidden.",
    "Reports must separate measured evidence from AI-generated wording.",
  ],
  limitations: [
    "No medical diagnosis, injury assessment, or treatment recommendation.",
    "Laptop webcam results depend on lighting, camera placement, body visibility, clothing, and background.",
    "Public-dataset and fixture validation do not replace real-world multi-user validation.",
    "Raw video storage is not part of the first Review Lab version.",
  ],
  references: [
    { label: "MediaPipe Pose Landmarker", url: "https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker" },
    {
      label: "FDA Good Machine Learning Practice",
      url: "https://www.fda.gov/medical-devices/software-medical-device-samd/good-machine-learning-practice-medical-device-development-guiding-principles",
    },
    { label: "KIMORE methodology reference", url: "https://pubmed.ncbi.nlm.nih.gov/31217121/" },
  ],
};
