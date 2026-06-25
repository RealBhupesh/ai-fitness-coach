# Movement Intelligence Review Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a professor-facing Review Lab that turns squat, bicep curl, and dance sessions into explainable evidence reports with confidence, limitations, methodology, and export payloads.

**Architecture:** Add a focused server-side Review Lab module that derives report evidence from existing `workout_sessions`, `exercise_reps`, `session_feedback_events`, scorecards, telemetry, and post-set analysis. Expose authenticated API routes and build three app pages: dashboard, session report, and methodology. Keep raw video out of scope and use structured evidence only.

**Tech Stack:** Next.js App Router, React, TypeScript, Drizzle ORM, PostgreSQL, Vitest, existing auth/session guard, existing shadcn-style UI components.

---

## File Structure

Create:

- `src/lib/review-lab/types.ts`  
  Shared Review Lab types for modules, reports, evidence, methodology, export payloads.

- `src/lib/review-lab/methodology.ts`  
  Versioned methodology content and claim boundaries.

- `src/lib/review-lab/evidence.ts`  
  Pure functions that transform workout sessions, reps, feedback events, and telemetry into Review Lab reports.

- `src/lib/review-lab/demo-fixtures.ts`  
  Demo-mode fixture reports for squat, curl, and dance.

- `src/lib/review-lab/evidence.test.ts`  
  Unit tests for scorecard mapping, limitations, AI claim boundaries, and export payload shape.

- `src/app/api/review-lab/sessions/route.ts`  
  Authenticated list endpoint for Review Lab sessions.

- `src/app/api/review-lab/sessions/[sessionId]/route.ts`  
  Authenticated detail endpoint for one report.

- `src/app/api/review-lab/export/route.ts`  
  Authenticated export endpoint returning structured report payload.

- `src/app/api/review-lab/methodology/route.ts`  
  Public or authenticated methodology endpoint. Keep it public because it contains no user data and helps explain the project.

- `src/app/review-lab/page.tsx`  
  Dashboard page.

- `src/app/review-lab/[sessionId]/page.tsx`  
  Session evidence report page.

- `src/app/review-lab/methodology/page.tsx`  
  Methodology page.

- `tests/e2e/review-lab.spec.ts`  
  Smoke tests for dashboard/methodology rendering. Keep data-light because DB may be unavailable in CI.

Modify:

- `src/components/layout/AppLayout.tsx`  
  Add Review Lab navigation item.

- `src/proxy.ts`  
  Protect `/review-lab`.

- `src/lib/validation/schemas.ts`  
  Add export request schema.

- `README.md`  
  Mention Review Lab as an academic/evidence feature.

Do not modify:

- Pose scoring internals unless a type export is missing.
- Dance comparator internals.
- Raw video handling, because raw video is out of scope.

---

### Task 1: Define Review Lab Types and Methodology

**Files:**
- Create: `src/lib/review-lab/types.ts`
- Create: `src/lib/review-lab/methodology.ts`
- Test: `src/lib/review-lab/evidence.test.ts`

- [ ] **Step 1: Write the failing methodology/type test**

Create `src/lib/review-lab/evidence.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

describe("review lab methodology", () => {
  it("exposes versioned non-medical claim boundaries", async () => {
    const { REVIEW_LAB_METHODOLOGY } = await import("@/lib/review-lab/methodology");

    expect(REVIEW_LAB_METHODOLOGY.version).toMatch(/^review-lab-/);
    expect(REVIEW_LAB_METHODOLOGY.claimBoundary).toBe("AI coach guidance, not medical diagnosis");
    expect(REVIEW_LAB_METHODOLOGY.modules.map((module) => module.id)).toEqual(["squat", "bicep_curl", "dance"]);
    expect(REVIEW_LAB_METHODOLOGY.limitations).toContain("No medical diagnosis, injury assessment, or treatment recommendation.");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- src/lib/review-lab/evidence.test.ts
```

Expected: FAIL because `@/lib/review-lab/methodology` does not exist.

- [ ] **Step 3: Add `src/lib/review-lab/types.ts`**

Create:

```ts
export type ReviewLabModule = "squat" | "bicep_curl" | "dance";

export type ReviewLabEvidenceSource =
  | "rule_engine"
  | "ml_evaluator"
  | "dance_comparator"
  | "camera_gate"
  | "ai_coach";

export type ReviewLabClaimBoundary = "AI coach guidance, not medical diagnosis";

export type ReviewLabMetricEvidence = {
  key: string;
  label: string;
  score: number;
  status: "pass" | "warning" | "fail" | "unreliable" | "review";
  value?: number;
  target?: string;
  detail: string;
  source: ReviewLabEvidenceSource;
  confidence: number;
};

export type ReviewLabMistakeEvidence = {
  label: string;
  probability: number;
  severity: "info" | "warning" | "critical";
  source: ReviewLabEvidenceSource;
  metricKey?: string;
  evidence: string;
};

export type ReviewLabCueEvidence = {
  timestamp: number;
  message: string;
  severity: "info" | "warning" | "critical";
  source: ReviewLabEvidenceSource;
  groundedBy: string[];
  claimBoundary: ReviewLabClaimBoundary;
};

export type ReviewLabRepEvidence = {
  kind: "rep";
  repNumber: number;
  phase: string;
  durationMs: number;
  overallScore: number;
  reliability: number;
  failedMetrics: string[];
  metrics: ReviewLabMetricEvidence[];
  mistakes: ReviewLabMistakeEvidence[];
};

export type ReviewLabPhraseEvidence = {
  kind: "phrase";
  phraseId: string;
  phraseLabel: string;
  count?: string;
  timingScore: number;
  poseSimilarity: number;
  grooveScore: number;
  reliability: number;
  referenceCue: string;
  learnerDeviation: string;
  metrics: ReviewLabMetricEvidence[];
  mistakes: ReviewLabMistakeEvidence[];
};

export type ReviewLabLimitation = {
  code:
    | "low_camera_confidence"
    | "body_out_of_frame"
    | "insufficient_reps"
    | "ml_unavailable"
    | "dance_reference_unavailable"
    | "not_medical_device";
  message: string;
  severity: "info" | "warning" | "critical";
};

export type ReviewLabSessionSummary = {
  id: string;
  module: ReviewLabModule;
  title: string;
  date: string;
  durationMinutes: number;
  overallScore: number;
  modelConfidence: number;
  cameraQuality: "ready" | "limited" | "unreliable";
  topMistake: string;
  evidenceCount: number;
  limitationCount: number;
};

export type ReviewLabReport = ReviewLabSessionSummary & {
  userId: string;
  summary: string;
  methodologyVersion: string;
  claimBoundary: ReviewLabClaimBoundary;
  metricTimeline: Array<{ label: string; value: number; timestamp?: number }>;
  evidence: Array<ReviewLabRepEvidence | ReviewLabPhraseEvidence>;
  mistakeProbabilities: ReviewLabMistakeEvidence[];
  aiCueHistory: ReviewLabCueEvidence[];
  limitations: ReviewLabLimitation[];
  exportStatus: "available";
};

export type ReviewLabMethodology = {
  version: string;
  claimBoundary: ReviewLabClaimBoundary;
  modules: Array<{
    id: ReviewLabModule;
    name: string;
    measuredSignals: string[];
    evidenceSources: ReviewLabEvidenceSource[];
  }>;
  scoringPolicy: string[];
  confidencePolicy: string[];
  limitations: string[];
  references: Array<{ label: string; url: string }>;
};

export type ReviewLabExportPayload = {
  generatedAt: string;
  report: ReviewLabReport;
  methodology: ReviewLabMethodology;
};
```

- [ ] **Step 4: Add `src/lib/review-lab/methodology.ts`**

Create:

```ts
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
    { label: "FDA Good Machine Learning Practice", url: "https://www.fda.gov/medical-devices/software-medical-device-samd/good-machine-learning-practice-medical-device-development-guiding-principles" },
    { label: "KIMORE methodology reference", url: "https://pubmed.ncbi.nlm.nih.gov/31217121/" },
  ],
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
npm run test -- src/lib/review-lab/evidence.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/lib/review-lab/types.ts src/lib/review-lab/methodology.ts src/lib/review-lab/evidence.test.ts
git commit -m "Add review lab methodology types"
```

---

### Task 2: Build Pure Evidence Mapping

**Files:**
- Modify: `src/lib/review-lab/evidence.test.ts`
- Create: `src/lib/review-lab/evidence.ts`

- [ ] **Step 1: Add failing tests for squat, curl, dance, and limitations**

Append to `src/lib/review-lab/evidence.test.ts`:

```ts
function strengthSession(overrides: Partial<any> = {}) {
  return {
    id: "session-1",
    userId: "user-1",
    type: "strength",
    exerciseType: "squat",
    date: new Date("2026-06-25T08:00:00.000Z"),
    duration: 24,
    caloriesBurned: 140,
    completed: true,
    compositeScore: 82,
    scoringBreakdown: JSON.stringify({ form: 80, rom: 76, tempo: 88, safety: 84 }),
    summary: "Squat set completed.",
    totalReps: 2,
    frameQualityStats: JSON.stringify({ readyRatio: 0.72, averageConfidence: 0.81 }),
    issueHistory: JSON.stringify([{ issue: "Knee tracking", count: 2 }]),
    telemetry: null,
    postSetAnalysis: null,
    createdAt: new Date("2026-06-25T08:00:00.000Z"),
    ...overrides,
  };
}

function feedbackEvent(message: string) {
  return {
    id: "event-1",
    sessionId: "session-1",
    timestamp: 1200,
    type: "cue",
    message,
    severity: "warning",
    source: "llm_coach",
    createdAt: new Date("2026-06-25T08:00:01.000Z"),
  };
}

describe("review lab evidence builder", () => {
  it("maps squat scorecard reps into professor-readable evidence", async () => {
    const { buildReviewLabReport } = await import("@/lib/review-lab/evidence");
    const report = buildReviewLabReport({
      session: strengthSession(),
      reps: [
        {
          repNumber: 1,
          phase: "completed",
          durationMs: 2200,
          formScore: 76,
          romScore: 70,
          tempoScore: 88,
          safetyScore: 82,
          squatScorecard: JSON.stringify({
            overall: 76,
            reliability: 84,
            failedMetrics: ["Knee tracking"],
            metrics: {
              kneeTracking: {
                key: "kneeTracking",
                label: "Knee tracking",
                score: 62,
                value: 18,
                target: "Knees track over toes",
                status: "fail",
                reliable: true,
                detail: "Knees drifted inward.",
              },
            },
          }),
          curlScorecard: null,
        },
      ],
      feedbackEvents: [feedbackEvent("Rep 1: track knees over toes.")],
    });

    expect(report.module).toBe("squat");
    expect(report.evidence[0].kind).toBe("rep");
    expect(report.evidence[0].failedMetrics).toContain("Knee tracking");
    expect(report.mistakeProbabilities[0].label).toBe("Knee tracking");
    expect(report.aiCueHistory[0].claimBoundary).toBe("AI coach guidance, not medical diagnosis");
  });

  it("maps curl scorecard reps into curl evidence", async () => {
    const { buildReviewLabReport } = await import("@/lib/review-lab/evidence");
    const report = buildReviewLabReport({
      session: strengthSession({ exerciseType: "bicep_curl", compositeScore: 88 }),
      reps: [
        {
          repNumber: 1,
          phase: "completed",
          durationMs: 1800,
          formScore: 88,
          romScore: 90,
          tempoScore: 84,
          safetyScore: 92,
          squatScorecard: null,
          curlScorecard: JSON.stringify({
            overall: 88,
            reliability: 91,
            failedMetrics: [],
            metrics: {
              wristStack: {
                key: "wristStack",
                label: "Wrist stack",
                score: 90,
                status: "pass",
                reliable: true,
                detail: "Wrist stayed stacked over forearm.",
              },
            },
          }),
        },
      ],
      feedbackEvents: [],
    });

    expect(report.module).toBe("bicep_curl");
    expect(report.evidence[0].kind).toBe("rep");
    expect(report.evidence[0].metrics[0].label).toBe("Wrist stack");
  });

  it("maps dance telemetry into phrase evidence", async () => {
    const { buildReviewLabReport } = await import("@/lib/review-lab/evidence");
    const report = buildReviewLabReport({
      session: strengthSession({
        type: "dance",
        exerciseType: "dance_basic",
        compositeScore: 74,
        totalReps: 0,
        telemetry: JSON.stringify({
          phraseEvidence: [
            {
              phraseId: "groove-1",
              phraseLabel: "Bounce and hit",
              count: "1-2",
              timingScore: 68,
              poseSimilarity: 72,
              grooveScore: 77,
              reliability: 80,
              referenceCue: "Match the ghost skeleton arm hit.",
              learnerDeviation: "Right wrist was late on count 2.",
            },
          ],
        }),
      }),
      reps: [],
      feedbackEvents: [],
    });

    expect(report.module).toBe("dance");
    expect(report.evidence[0].kind).toBe("phrase");
    expect(report.evidence[0].phraseLabel).toBe("Bounce and hit");
  });

  it("adds low-camera-confidence limitations", async () => {
    const { buildReviewLabReport } = await import("@/lib/review-lab/evidence");
    const report = buildReviewLabReport({
      session: strengthSession({
        frameQualityStats: JSON.stringify({ readyRatio: 0.31, averageConfidence: 0.42 }),
      }),
      reps: [],
      feedbackEvents: [],
    });

    expect(report.limitations.map((limitation) => limitation.code)).toContain("low_camera_confidence");
    expect(report.cameraQuality).toBe("unreliable");
  });
});
```

- [ ] **Step 2: Run tests to verify failures**

Run:

```bash
npm run test -- src/lib/review-lab/evidence.test.ts
```

Expected: FAIL because `buildReviewLabReport` does not exist.

- [ ] **Step 3: Add `src/lib/review-lab/evidence.ts`**

Create:

```ts
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
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- src/lib/review-lab/evidence.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/review-lab/evidence.ts src/lib/review-lab/evidence.test.ts
git commit -m "Build review lab evidence reports"
```

---

### Task 3: Add Demo Fixtures and Server Data Access

**Files:**
- Create: `src/lib/review-lab/demo-fixtures.ts`
- Modify: `src/lib/review-lab/evidence.test.ts`

- [ ] **Step 1: Add failing demo fixture test**

Append:

```ts
describe("review lab demo fixtures", () => {
  it("provides one squat, one curl, and one dance report", async () => {
    const { getDemoReviewLabReports } = await import("@/lib/review-lab/demo-fixtures");
    const reports = getDemoReviewLabReports();

    expect(reports.map((report) => report.module)).toEqual(["squat", "bicep_curl", "dance"]);
    expect(reports.every((report) => report.limitations.some((limitation) => limitation.code === "not_medical_device"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/lib/review-lab/evidence.test.ts
```

Expected: FAIL because `demo-fixtures.ts` does not exist.

- [ ] **Step 3: Add demo fixtures**

Create `src/lib/review-lab/demo-fixtures.ts`:

```ts
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
      feedbackEvents: [{ timestamp: 1200, type: "cue", message: "Track knees over toes on the ascent.", severity: "warning", source: "llm_coach" }],
    }),
    buildReviewLabReport({
      session: session("bicep_curl"),
      reps: [curlRep],
      feedbackEvents: [{ timestamp: 900, type: "cue", message: "Good wrist stack; keep elbow pinned.", severity: "info", source: "llm_coach" }],
    }),
    buildReviewLabReport({
      session: session("dance"),
      reps: [],
      feedbackEvents: [{ timestamp: 600, type: "cue", message: "Hit the wrist shape earlier on count 2.", severity: "warning", source: "llm_coach" }],
    }),
  ];
}

export function getDemoReviewLabReport(sessionId: string) {
  return getDemoReviewLabReports().find((report) => report.id === sessionId) ?? null;
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -- src/lib/review-lab/evidence.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/review-lab/demo-fixtures.ts src/lib/review-lab/evidence.test.ts
git commit -m "Add review lab demo fixtures"
```

---

### Task 4: Add API Routes

**Files:**
- Modify: `src/lib/validation/schemas.ts`
- Create: `src/app/api/review-lab/sessions/route.ts`
- Create: `src/app/api/review-lab/sessions/[sessionId]/route.ts`
- Create: `src/app/api/review-lab/export/route.ts`
- Create: `src/app/api/review-lab/methodology/route.ts`

- [ ] **Step 1: Add export schema**

Modify `src/lib/validation/schemas.ts` near other API schemas:

```ts
export const reviewLabExportSchema = z.object({
  sessionId: z.string().min(1).max(160),
});
```

- [ ] **Step 2: Add list route**

Create `src/app/api/review-lab/sessions/route.ts`:

```ts
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { exerciseReps, sessionFeedbackEvents, workoutSessions } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { buildReviewLabReport, summarizeReviewLabReport } from "@/lib/review-lab/evidence";
import { getDemoReviewLabReports } from "@/lib/review-lab/demo-fixtures";

export async function GET(request: Request) {
  try {
    const session = await requireServerSession(request);
    if (isDemoUser(session.user.id)) {
      return NextResponse.json({ sessions: getDemoReviewLabReports().map(summarizeReviewLabReport) });
    }

    const sessions = await db.query.workoutSessions.findMany({
      where: eq(workoutSessions.userId, session.user.id),
      orderBy: [desc(workoutSessions.date)],
      limit: 50,
    });

    const reports = await Promise.all(
      sessions.map(async (item) => {
        const [reps, events] = await Promise.all([
          db.query.exerciseReps.findMany({ where: eq(exerciseReps.sessionId, item.id) }),
          db.query.sessionFeedbackEvents.findMany({ where: eq(sessionFeedbackEvents.sessionId, item.id) }),
        ]);
        return summarizeReviewLabReport(buildReviewLabReport({ session: item, reps, feedbackEvents: events }));
      }),
    );

    return NextResponse.json({ sessions: reports });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

- [ ] **Step 3: Add detail route**

Create `src/app/api/review-lab/sessions/[sessionId]/route.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { exerciseReps, sessionFeedbackEvents, workoutSessions } from "@/db/schema";
import { requireServerSession } from "@/lib/auth/session";
import { isDemoUser } from "@/lib/dummy-auth";
import { buildReviewLabReport } from "@/lib/review-lab/evidence";
import { getDemoReviewLabReport } from "@/lib/review-lab/demo-fixtures";

export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const authSession = await requireServerSession(request);
    const { sessionId } = await context.params;

    if (isDemoUser(authSession.user.id)) {
      const report = getDemoReviewLabReport(sessionId);
      return report ? NextResponse.json({ report }) : NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const workout = await db.query.workoutSessions.findFirst({
      where: and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, authSession.user.id)),
    });

    if (!workout) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [reps, events] = await Promise.all([
      db.query.exerciseReps.findMany({ where: eq(exerciseReps.sessionId, workout.id) }),
      db.query.sessionFeedbackEvents.findMany({ where: eq(sessionFeedbackEvents.sessionId, workout.id) }),
    ]);

    return NextResponse.json({ report: buildReviewLabReport({ session: workout, reps, feedbackEvents: events }) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

- [ ] **Step 4: Add export route**

Create `src/app/api/review-lab/export/route.ts`:

```ts
import { NextResponse } from "next/server";
import { reviewLabExportSchema } from "@/lib/validation/schemas";
import { REVIEW_LAB_METHODOLOGY } from "@/lib/review-lab/methodology";

export async function POST(request: Request) {
  const parsed = reviewLabExportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid export request", details: parsed.error.flatten() }, { status: 400 });
  }

  const url = new URL(`/api/review-lab/sessions/${encodeURIComponent(parsed.data.sessionId)}`, request.url);
  const reportResponse = await fetch(url, { headers: { cookie: request.headers.get("cookie") ?? "" } });
  if (!reportResponse.ok) {
    return NextResponse.json({ error: "Report unavailable" }, { status: reportResponse.status });
  }

  const { report } = await reportResponse.json();
  return NextResponse.json({
    export: {
      generatedAt: new Date().toISOString(),
      report,
      methodology: REVIEW_LAB_METHODOLOGY,
    },
  });
}
```

- [ ] **Step 5: Add methodology route**

Create `src/app/api/review-lab/methodology/route.ts`:

```ts
import { NextResponse } from "next/server";
import { REVIEW_LAB_METHODOLOGY } from "@/lib/review-lab/methodology";

export async function GET() {
  return NextResponse.json({ methodology: REVIEW_LAB_METHODOLOGY });
}
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Run review lab tests**

Run:

```bash
npm run test -- src/lib/review-lab/evidence.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/lib/validation/schemas.ts src/app/api/review-lab src/lib/review-lab
git commit -m "Add review lab API routes"
```

---

### Task 5: Build Review Lab Dashboard UI

**Files:**
- Create: `src/app/review-lab/page.tsx`
- Modify: `src/components/layout/AppLayout.tsx`
- Modify: `src/proxy.ts`

- [ ] **Step 1: Add navigation and route protection**

Modify `src/components/layout/AppLayout.tsx` imports to include `ClipboardCheck` from `lucide-react`, then add a main nav item after Dashboard:

```ts
{ href: "/review-lab", label: "Review Lab", icon: ClipboardCheck },
```

Modify `src/proxy.ts` protected prefixes:

```ts
"/review-lab",
```

- [ ] **Step 2: Create dashboard page**

Create `src/app/review-lab/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Download, FileText, ShieldAlert } from "lucide-react";
import type { ReviewLabSessionSummary } from "@/lib/review-lab/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function moduleLabel(module: string) {
  if (module === "bicep_curl") return "Bicep curl";
  if (module === "dance") return "Dance phrase";
  return "Squat";
}

export default function ReviewLabPage() {
  const [sessions, setSessions] = useState<ReviewLabSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/review-lab/sessions", { credentials: "include" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <Badge className="mb-3 gap-1">
          <ClipboardCheck className="h-3 w-3" />
          Professor proof layer
        </Badge>
        <h1 className="text-3xl font-black uppercase leading-none md:text-5xl">Movement Intelligence Review Lab</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Review squat, curl, and dance sessions with measured evidence, confidence, AI cue grounding, and explicit limitations.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="h-8 w-64 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No review sessions yet</CardTitle>
            <CardDescription>Complete a squat, curl, or dance session to generate structured evidence.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/coach/workout"><Button>Start workout</Button></Link>
            <Link href="/coach/dance"><Button variant="outline">Start dance</Button></Link>
            <Link href="/review-lab/methodology"><Button variant="outline">View methodology</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => (
            <Card key={session.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Badge>{moduleLabel(session.module)}</Badge>
                  <Badge variant={session.cameraQuality === "ready" ? "secondary" : "outline"}>{session.cameraQuality}</Badge>
                </div>
                <CardTitle>{session.title}</CardTitle>
                <CardDescription>{new Date(session.date).toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>Overall score</span>
                    <span>{session.overallScore}/100</span>
                  </div>
                  <Progress value={session.overallScore} />
                </div>
                <div className="rounded-lg border bg-card/70 p-3 text-sm">
                  <p className="font-semibold">Top finding</p>
                  <p className="mt-1 text-muted-foreground">{session.topMistake}</p>
                </div>
                {session.limitationCount > 0 ? (
                  <div className="flex items-center gap-2 text-sm text-amber-500">
                    <ShieldAlert className="h-4 w-4" />
                    {session.limitationCount} limitation{session.limitationCount === 1 ? "" : "s"} attached
                  </div>
                ) : null}
                <div className="mt-auto flex gap-2">
                  <Link href={`/review-lab/${session.id}`} className="flex-1">
                    <Button className="w-full gap-2"><FileText className="h-4 w-4" /> Review</Button>
                  </Link>
                  <Button variant="outline" className="gap-2" disabled>
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add src/app/review-lab/page.tsx src/components/layout/AppLayout.tsx src/proxy.ts
git commit -m "Add review lab dashboard"
```

---

### Task 6: Build Session Report UI

**Files:**
- Create: `src/app/review-lab/[sessionId]/page.tsx`

- [ ] **Step 1: Create report page**

Create `src/app/review-lab/[sessionId]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, Brain, Download, FileText, ShieldCheck } from "lucide-react";
import type { ReviewLabReport } from "@/lib/review-lab/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function ReviewLabSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<ReviewLabReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/review-lab/sessions/${encodeURIComponent(params.sessionId)}`, { credentials: "include" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setReport(data.report ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  const exportReport = async () => {
    const response = await fetch("/api/review-lab/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId: params.sessionId }),
    });
    if (!response.ok) return;
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `review-lab-${params.sessionId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading report...</div>;
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>Report unavailable</CardTitle>
            <CardDescription>The session may not exist or may not belong to this account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/review-lab"><Button>Back to Review Lab</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge className="mb-3">{report.claimBoundary}</Badge>
          <h1 className="text-3xl font-black uppercase leading-none md:text-5xl">{report.title}</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{report.summary}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/review-lab/methodology"><Button variant="outline">Methodology</Button></Link>
          <Button className="gap-2" onClick={exportReport}><Download className="h-4 w-4" /> Export JSON</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Score", `${report.overallScore}/100`],
          ["Confidence", `${Math.round(report.modelConfidence * 100)}%`],
          ["Camera", report.cameraQuality],
          ["Evidence", String(report.evidenceCount)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-black capitalize">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Evidence Timeline</CardTitle>
          <CardDescription>Rep-by-rep or phrase-by-phrase measured evidence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {report.evidence.map((item, index) => (
            <div key={index} className="rounded-lg border bg-card/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold">
                  {item.kind === "rep" ? `Rep ${item.repNumber}` : item.phraseLabel}
                </h3>
                <Badge variant="outline">{item.kind === "rep" ? `${item.overallScore}/100` : `${item.timingScore}/100 timing`}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {item.metrics.map((metric) => (
                  <div key={metric.key} className="rounded-md border bg-background/60 p-3">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{metric.label}</span>
                      <span>{metric.score}/100</span>
                    </div>
                    <Progress value={metric.score} />
                    <p className="mt-2 text-xs text-muted-foreground">{metric.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> AI Cue Grounding</CardTitle>
            <CardDescription>Every cue is tied to measured evidence and claim boundaries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.aiCueHistory.length ? report.aiCueHistory.map((cue, index) => (
              <div key={index} className="rounded-lg border bg-card/70 p-3">
                <p className="font-medium">{cue.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">Grounded by: {cue.groundedBy.join(", ")}</p>
                <Badge className="mt-2" variant="outline">{cue.claimBoundary}</Badge>
              </div>
            )) : <p className="text-sm text-muted-foreground">No AI cues were saved for this session.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Limitations</CardTitle>
            <CardDescription>Conditions that reduce the strength of system claims.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.limitations.map((limitation) => (
              <div key={limitation.code} className="flex gap-3 rounded-lg border bg-card/70 p-3 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium capitalize">{limitation.code.replace(/_/g, " ")}</p>
                  <p className="text-muted-foreground">{limitation.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/app/review-lab/[sessionId]/page.tsx
git commit -m "Add review lab session report"
```

---

### Task 7: Build Methodology Page

**Files:**
- Create: `src/app/review-lab/methodology/page.tsx`

- [ ] **Step 1: Create methodology page**

Create `src/app/review-lab/methodology/page.tsx`:

```tsx
import Link from "next/link";
import { REVIEW_LAB_METHODOLOGY } from "@/lib/review-lab/methodology";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReviewLabMethodologyPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <Badge className="mb-3">{REVIEW_LAB_METHODOLOGY.version}</Badge>
        <h1 className="text-3xl font-black uppercase leading-none md:text-5xl">Review Lab Methodology</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          How FitCoach AI turns movement sessions into explainable evidence while staying honest about confidence and limitations.
        </p>
      </div>

      <Card className="border-primary/25 bg-primary/5">
        <CardHeader>
          <CardTitle>Claim Boundary</CardTitle>
          <CardDescription>{REVIEW_LAB_METHODOLOGY.claimBoundary}</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {REVIEW_LAB_METHODOLOGY.modules.map((module) => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle>{module.name}</CardTitle>
              <CardDescription>{module.id.replace(/_/g, " ")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-sm font-semibold">Measured signals</p>
              <div className="flex flex-wrap gap-2">
                {module.measuredSignals.map((signal) => <Badge key={signal} variant="secondary">{signal}</Badge>)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {[
        ["Scoring Policy", REVIEW_LAB_METHODOLOGY.scoringPolicy],
        ["Confidence Policy", REVIEW_LAB_METHODOLOGY.confidencePolicy],
        ["Limitations", REVIEW_LAB_METHODOLOGY.limitations],
      ].map(([title, items]) => (
        <Card key={title as string}>
          <CardHeader>
            <CardTitle>{title as string}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {(items as string[]).map((item) => <li key={item}>- {item}</li>)}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>References</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {REVIEW_LAB_METHODOLOGY.references.map((reference) => (
            <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer" className="block text-sm text-primary">
              {reference.label}
            </a>
          ))}
        </CardContent>
      </Card>

      <Link href="/review-lab"><Button>Back to Review Lab</Button></Link>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/app/review-lab/methodology/page.tsx
git commit -m "Add review lab methodology page"
```

---

### Task 8: Add E2E Smoke Coverage and README Update

**Files:**
- Create: `tests/e2e/review-lab.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add Playwright smoke test**

Create `tests/e2e/review-lab.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("methodology page explains Review Lab claim boundary", async ({ page }) => {
  await page.goto("/review-lab/methodology");
  await expect(page.getByRole("heading", { name: /review lab methodology/i })).toBeVisible();
  await expect(page.getByText(/AI coach guidance, not medical diagnosis/i)).toBeVisible();
});
```

- [ ] **Step 2: Update README**

Add a section after “Dance Module”:

```md
## Movement Intelligence Review Lab

The Review Lab is a professor-facing evidence layer for squat, bicep curl, and dance sessions.

Routes:
- `/review-lab`
- `/review-lab/[sessionId]`
- `/review-lab/methodology`

It shows structured evidence, camera confidence, AI cue grounding, limitations, and exportable report payloads. It does not store raw video and does not make medical-grade or diagnostic claims.
```

- [ ] **Step 3: Run E2E smoke test**

Run:

```bash
npm run test:e2e -- tests/e2e/review-lab.spec.ts
```

Expected: PASS. If local auth redirects block `/review-lab/methodology`, update `src/proxy.ts` so `/review-lab/methodology` remains public or update the test to use the public methodology route only.

- [ ] **Step 4: Run full validation**

Run:

```bash
npm run typecheck
npm run test
npm run lint
DATABASE_URL=postgres://postgres:postgres@localhost:5432/fitcoach BETTER_AUTH_SECRET=local-development-secret-with-more-than-32-chars BETTER_AUTH_URL=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:3000 npm run build
```

Expected:

- typecheck passes
- Vitest passes
- lint passes
- build passes

- [ ] **Step 5: Commit**

Run:

```bash
git add tests/e2e/review-lab.spec.ts README.md
git commit -m "Document and test review lab"
```

---

## Self-Review

Spec coverage:

- Professor-facing dashboard: Task 5.
- Session evidence report: Task 6.
- Methodology page: Task 7.
- Structured evidence snapshots: Task 2.
- Squat/curl/dance support: Tasks 2 and 3.
- API routes: Task 4.
- AI cue grounding and non-medical boundary: Tasks 1, 2, 6, 7.
- Low-confidence limitations: Task 2.
- Export payload: Tasks 1, 4, 6.
- Tests: Tasks 1, 2, 3, 8.
- No raw video: methodology and README explicitly state out of scope.

Placeholder scan:

- No placeholder markers.
- Every task includes files, code, commands, and expected outcomes.

Type consistency:

- `ReviewLabModule` uses `"squat" | "bicep_curl" | "dance"` throughout.
- Report APIs return `{ sessions }`, `{ report }`, `{ export }`, and `{ methodology }`.
- UI imports shared `ReviewLabSessionSummary` and `ReviewLabReport` from `src/lib/review-lab/types.ts`.
