import { buildReviewLabReport } from "@/lib/review-lab/evidence";

function session(module: "squat" | "bicep_curl" | "dance") {
  return {
    id: `demo-${module}`,
    userId: "demo-user-001",
    type: module === "dance" ? "dance" : "strength",
    exerciseType: module === "dance" ? "dance_basic" : module,
    date: new Date("2026-06-25T08:00:00.000Z"),
    duration: module === "dance" ? 12 : 18,
    compositeScore: module === "squat" ? 78 : module === "bicep_curl" ? 88 : 74,
    summary: `${module} demo evidence session.`,
    totalReps: module === "dance" ? 0 : 3,
    frameQualityStats: JSON.stringify({ readyRatio: 0.78, averageConfidence: 0.84 }),
    issueHistory: null,
    telemetry:
      module === "dance"
        ? JSON.stringify({
            phraseEvidence: [
              {
                phraseId: "groove-1",
                phraseLabel: "Bounce and hit",
                count: "1-2",
                timingScore: 72,
                poseSimilarity: 76,
                grooveScore: 78,
                reliability: 82,
                referenceCue: "Match the ghost skeleton arm hit.",
                learnerDeviation: "Right wrist arrived late on count 2.",
              },
            ],
          })
        : null,
    postSetAnalysis: null,
  };
}

const squatRep = {
  repNumber: 1,
  phase: "completed",
  durationMs: 2300,
  formScore: 78,
  romScore: 72,
  tempoScore: 84,
  safetyScore: 80,
  curlScorecard: null,
  squatScorecard: JSON.stringify({
    overall: 78,
    reliability: 86,
    failedMetrics: ["Depth", "Knee tracking"],
    metrics: {
      depth: { label: "Depth", score: 70, status: "warning", reliable: true, detail: "Rep stopped slightly above target depth." },
      kneeTracking: { label: "Knee tracking", score: 64, status: "fail", reliable: true, detail: "Knees drifted inward during ascent." },
    },
  }),
};

const curlRep = {
  repNumber: 1,
  phase: "completed",
  durationMs: 1800,
  formScore: 88,
  romScore: 90,
  tempoScore: 86,
  safetyScore: 92,
  squatScorecard: null,
  curlScorecard: JSON.stringify({
    overall: 88,
    reliability: 91,
    failedMetrics: [],
    metrics: {
      elbowPath: { label: "Elbow path", score: 88, status: "pass", reliable: true, detail: "Elbow stayed mostly pinned during the curl." },
      wristStack: { label: "Wrist stack", score: 91, status: "pass", reliable: true, detail: "Wrist stayed stacked through the rep." },
    },
  }),
};

export function getDemoReviewLabReports() {
  return [
    buildReviewLabReport({
      session: session("squat"),
      reps: [squatRep],
      feedbackEvents: [{ timestamp: 1200, message: "Track knees over toes on the ascent.", severity: "warning", source: "llm_coach" }],
    }),
    buildReviewLabReport({
      session: session("bicep_curl"),
      reps: [curlRep],
      feedbackEvents: [{ timestamp: 900, message: "Good wrist stack; keep elbow pinned.", severity: "info", source: "llm_coach" }],
    }),
    buildReviewLabReport({
      session: session("dance"),
      reps: [],
      feedbackEvents: [{ timestamp: 600, message: "Hit the wrist shape earlier on count 2.", severity: "warning", source: "llm_coach" }],
    }),
  ];
}

export function getDemoReviewLabReport(sessionId: string) {
  return getDemoReviewLabReports().find((report) => report.id === sessionId) ?? null;
}
