import { isMetricReliable } from "@/lib/pose/confidence";
import { hipTilt, kneeSymmetry, shoulderTilt, trunkLean, trunkStackAngle } from "@/lib/pose/kinematics";
import { angle, average, clamp, distance, midpoint, scoreFromRange, scoreFromTarget } from "@/lib/pose/math";
import { EXERCISE_VIEW_POLICIES } from "@/lib/pose/quality";
import type { ExerciseContract, ExerciseId, FrameAnalysis, Landmark, LiveMetric, PoseExercise, TrackingFrame } from "@/lib/pose/types";

type ArmSide = "left" | "right";

type CurlSnapshot = {
  side: ArmSide;
  shoulder: Landmark | undefined;
  elbow: Landmark | undefined;
  wrist: Landmark | undefined;
  hip: Landmark | undefined;
  oppositeShoulder: Landmark | undefined;
  elbowAngle: number;
  visibility: number;
};

type MetricOptions = {
  reliable?: boolean;
  unreliableDetail?: string;
};

type PhaseCycleConfig = {
  load: string;
  complete: string;
};

export type PhaseTrackerState = {
  phase: string;
  rawPhase: string;
  phaseStartedAt: number;
  candidatePhase: string | null;
  candidateSince: number;
  cycleLoaded: boolean;
  cycleStartedAt: number;
};

export type PhaseTrackerUpdate = {
  state: PhaseTrackerState;
  phase: string;
  rawPhase: string;
  phaseChanged: boolean;
  repCompleted: boolean;
  milestone: "load" | "complete" | null;
};

export const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [28, 30],
  [29, 31],
  [30, 32],
];

export const POSE_EXERCISES: PoseExercise[] = [
  {
    id: "squat",
    label: "Squat",
    icon: "S",
    category: "strength",
    repBased: true,
    tips: ["Keep heels down", "Chest tall", "Drive knees over toes"],
    calibration: ["Full body visible", "Face the camera or stand at a 30-45 degree angle", "Keep both feet inside the frame"],
  },
  {
    id: "pushup",
    label: "Push-up",
    icon: "P",
    category: "strength",
    repBased: true,
    tips: ["Long body line", "Elbows around 45 degrees", "Control the bottom position"],
    calibration: ["Use a side view", "Head to heels visible", "Floor line visible"],
  },
  {
    id: "lunge",
    label: "Lunge",
    icon: "L",
    category: "strength",
    repBased: true,
    tips: ["Front shin vertical", "Torso stacked", "Split stance stable"],
    calibration: ["Show both legs", "Use a front or 30-45 degree view", "Leave headroom above shoulders"],
  },
  {
    id: "bicep_curl",
    label: "Bicep Curl",
    icon: "C",
    category: "strength",
    repBased: true,
    tips: ["Pin elbows in", "Avoid torso swing", "Squeeze at the top"],
    calibration: ["Upper body in frame", "Front or 30-45 degree view", "Keep both wrists visible"],
  },
  {
    id: "jumping_jack",
    label: "Jumping Jack",
    icon: "J",
    category: "cardio",
    repBased: true,
    tips: ["Land softly", "Reach fully overhead", "Keep rhythm even"],
    calibration: ["Full body visible", "Leave space overhead", "Face the camera"],
  },
  {
    id: "plank",
    label: "Plank",
    icon: "PL",
    category: "strength",
    repBased: false,
    tips: ["Ribs tucked", "Glutes on", "Shoulders stacked over elbows"],
    calibration: ["Use a side view", "Floor line visible", "Head to heels in frame"],
  },
  {
    id: "warrior",
    label: "Warrior",
    icon: "W",
    category: "mobility",
    repBased: false,
    tips: ["Front knee over ankle", "Reach long through both arms", "Lift through the crown"],
    calibration: ["Full body visible", "Use a side or slightly angled view", "Arms must stay in frame"],
  },
  {
    id: "dance_basic",
    label: "Dance Frame",
    icon: "D",
    category: "dance",
    repBased: false,
    tips: ["Keep ribs stacked over hips", "Reach both wrists evenly", "Keep knees soft on every count"],
    calibration: ["Front view required", "Both wrists visible", "Leave lateral room for arm lines"],
  },
];

export const EXERCISE_CONTRACTS: Record<ExerciseId, ExerciseContract> = {
  squat: {
    id: "squat",
    label: "Squat",
    viewPolicy: EXERCISE_VIEW_POLICIES.squat,
    readinessRules: ["Full body visible", "Front or 30-45 degree view", "Both feet visible"],
    feedbackKeys: ["depth", "knee_tracking", "torso_stack", "hip_centering", "symmetry", "shoulder_stability"],
  },
  pushup: {
    id: "pushup",
    label: "Push-up",
    viewPolicy: EXERCISE_VIEW_POLICIES.pushup,
    readinessRules: ["Side view", "Head to heels visible", "Floor line visible"],
    feedbackKeys: ["depth", "body_line", "tempo", "shoulder_stack", "hip_level"],
  },
  lunge: {
    id: "lunge",
    label: "Lunge",
    viewPolicy: EXERCISE_VIEW_POLICIES.lunge,
    readinessRules: ["Front or 30-45 degree view", "Both legs in frame", "Torso and feet visible"],
    feedbackKeys: ["front_knee", "torso_stack", "hip_level", "symmetry", "balance"],
  },
  bicep_curl: {
    id: "bicep_curl",
    label: "Bicep Curl",
    viewPolicy: EXERCISE_VIEW_POLICIES.bicep_curl,
    readinessRules: ["Upper body visible", "Front or angled view", "Elbows and wrists tracked"],
    feedbackKeys: ["top_finish", "bottom_extension", "elbow_path", "shoulder_stability", "wrist_stack", "symmetry"],
  },
  jumping_jack: {
    id: "jumping_jack",
    label: "Jumping Jack",
    viewPolicy: EXERCISE_VIEW_POLICIES.jumping_jack,
    readinessRules: ["Full body visible", "Front or angled view", "Space overhead and lateral room"],
    feedbackKeys: ["arm_reach", "foot_width", "tempo", "landing_control", "symmetry"],
  },
  plank: {
    id: "plank",
    label: "Plank",
    viewPolicy: EXERCISE_VIEW_POLICIES.plank,
    readinessRules: ["Side view", "Floor line visible", "Head to heels in frame"],
    feedbackKeys: ["body_line", "shoulder_stack", "hip_level", "neck_position"],
  },
  warrior: {
    id: "warrior",
    label: "Warrior",
    viewPolicy: EXERCISE_VIEW_POLICIES.warrior,
    readinessRules: ["Full body visible", "Side or angled view", "Arms must stay in frame"],
    feedbackKeys: ["front_knee", "arm_line", "hip_level", "torso_stack"],
  },
  dance_basic: {
    id: "dance_basic",
    label: "Dance Frame",
    viewPolicy: EXERCISE_VIEW_POLICIES.dance_basic,
    readinessRules: ["Front view", "Full body visible", "Room for arm lines"],
    feedbackKeys: ["frame_width", "arm_range", "torso_stability", "knee_bounce", "tempo_timing", "symmetry"],
  },
};

const LM = (landmarks: Landmark[], index: number) => landmarks[index];
const vis = (landmark?: Landmark | null) => landmark?.visibility ?? 0;

function resolveLandmarks(input: Landmark[] | TrackingFrame) {
  return Array.isArray(input) ? input : input.analysisLandmarks ?? input.smoothedLandmarks;
}

function resolveReliability(input: Landmark[] | TrackingFrame, key: string, indices: number[], options?: { minAverage?: number; minPoint?: number }) {
  if (!Array.isArray(input) && key in input.reliability) {
    return input.reliability[key];
  }
  return isMetricReliable(Array.isArray(input) ? input : input.smoothedLandmarks, indices, options);
}

const REP_CYCLE_BY_EXERCISE: Partial<Record<ExerciseId, PhaseCycleConfig>> = {
  squat: { load: "bottom", complete: "top" },
  pushup: { load: "bottom", complete: "top" },
  lunge: { load: "bottom", complete: "top" },
  bicep_curl: { load: "top", complete: "bottom" },
  jumping_jack: { load: "open", complete: "closed" },
};

function selectSide(landmarks: Landmark[]) {
  const left = average([
    vis(LM(landmarks, 11)),
    vis(LM(landmarks, 13)),
    vis(LM(landmarks, 15)),
    vis(LM(landmarks, 23)),
    vis(LM(landmarks, 25)),
    vis(LM(landmarks, 27)),
  ]);
  const right = average([
    vis(LM(landmarks, 12)),
    vis(LM(landmarks, 14)),
    vis(LM(landmarks, 16)),
    vis(LM(landmarks, 24)),
    vis(LM(landmarks, 26)),
    vis(LM(landmarks, 28)),
  ]);
  return left >= right ? "left" : "right";
}

function sideLandmarks(landmarks: Landmark[], side = selectSide(landmarks)) {
  return {
    shoulder: LM(landmarks, side === "left" ? 11 : 12),
    elbow: LM(landmarks, side === "left" ? 13 : 14),
    wrist: LM(landmarks, side === "left" ? 15 : 16),
    hip: LM(landmarks, side === "left" ? 23 : 24),
  };
}

function armIndices(side: ArmSide) {
  return side === "left" ? [11, 13, 15, 23] : [12, 14, 16, 24];
}

const statusForScore = (score: number): LiveMetric["status"] => {
  if (score >= 88) return "excellent";
  if (score >= 72) return "good";
  if (score >= 55) return "warning";
  return "critical";
};

function metric(
  name: string,
  rawScore: number,
  detail: string,
  value?: number,
  target?: string,
  options: MetricOptions = {},
): LiveMetric {
  const reliable = options.reliable ?? true;
  const normalizedScore = reliable
    ? clamp(Math.round(rawScore), 0, 100)
    : Math.max(78, clamp(Math.round(rawScore), 0, 100));

  return {
    name,
    score: normalizedScore,
    detail: reliable
      ? detail
      : options.unreliableDetail ?? `${name} is not reliable enough to coach yet. Improve visibility before trusting that cue.`,
    value,
    target,
    status: statusForScore(normalizedScore),
    reliable,
  };
}

function finalize(
  phase: string,
  metrics: LiveMetric[],
  extras: Partial<Pick<FrameAnalysis, "positives" | "corrections" | "injuryRisks" | "primaryFocus" | "primaryIssueKey" | "secondaryNote" | "trackedSide" | "targetCue">> = {},
): FrameAnalysis {
  const reliableMetrics = metrics.filter((item) => item.reliable !== false);
  const issueMetrics = reliableMetrics.filter((item) => item.score < 70);
  const correctionMetrics = reliableMetrics.filter((item) => item.score < 78);
  const positiveMetrics = reliableMetrics.filter((item) => item.score >= 85).slice(0, 3);
  const scoringMetrics = metrics.length ? metrics : [metric("Control", 80, "Stay centered and keep moving with control.")];

  const form = Math.round(average(scoringMetrics.slice(0, 2).map((item) => item.score)));
  const rom = Math.round(
    scoringMetrics.find((item) => item.name.includes("Range") || item.name.includes("Depth") || item.name.includes("Finish") || item.name.includes("Extension"))?.score ??
      scoringMetrics[0]?.score ??
      0,
  );
  const tempo = Math.round(scoringMetrics.find((item) => item.name.includes("Tempo"))?.score ?? form);
  const stability = Math.round(
    scoringMetrics.find((item) => item.name.includes("Stability") || item.name.includes("Stack"))?.score ?? average(scoringMetrics.map((item) => item.score)),
  );
  const symmetry = Math.round(
    scoringMetrics.find((item) => item.name.includes("Symmetry") || item.name.includes("Balance"))?.score ?? stability,
  );
  const consistency = Math.round(average([form, stability, symmetry]));
  const endurance = Math.round(average([form, rom, stability]));
  const safety = Math.round(Math.min(...scoringMetrics.map((item) => item.score)));
  const overall = Math.round(average([form, rom, tempo, stability, symmetry, consistency, endurance, safety]));

  const issues = issueMetrics.map((item) => item.detail);
  const corrections = extras.corrections ?? correctionMetrics.map((item) => item.detail);
  const positives = extras.positives ?? positiveMetrics.map((item) => item.detail);
  const injuryRisks = extras.injuryRisks ?? [];
  const unreliableMetrics = metrics.filter((item) => item.reliable === false).map((item) => item.name);

  return {
    form,
    rom,
    tempo,
    stability,
    symmetry,
    consistency,
    endurance,
    safety,
    overall,
    phase,
    metrics,
    issues,
    positives,
    corrections,
    injuryRisks,
    primaryFocus: extras.primaryFocus ?? corrections[0] ?? injuryRisks[0] ?? positives[0],
    primaryIssueKey: extras.primaryIssueKey,
    secondaryNote: extras.secondaryNote,
    trackedSide: extras.trackedSide,
    targetCue: extras.targetCue,
    unreliableMetrics,
  };
}

function withTrackingContext(result: FrameAnalysis, input: Landmark[] | TrackingFrame) {
  if (Array.isArray(input)) {
    return result;
  }
  return {
    ...result,
    frameQuality: input.frameQuality,
    view: input.view,
  };
}

function getCurlSnapshot(landmarks: Landmark[], side: ArmSide): CurlSnapshot {
  const { shoulder, elbow, wrist, hip } = sideLandmarks(landmarks, side);
  return {
    side,
    shoulder,
    elbow,
    wrist,
    hip,
    oppositeShoulder: LM(landmarks, side === "left" ? 12 : 11),
    elbowAngle: angle(shoulder, elbow, wrist),
    visibility: average([vis(shoulder), vis(elbow), vis(wrist), vis(hip)]),
  };
}

function chooseCurlSnapshot(landmarks: Landmark[]) {
  const left = getCurlSnapshot(landmarks, "left");
  const right = getCurlSnapshot(landmarks, "right");
  const bothVisible = left.visibility > 0.6 && right.visibility > 0.6;
  const primarySide: ArmSide =
    left.visibility === right.visibility
      ? Math.abs(left.elbowAngle - 95) <= Math.abs(right.elbowAngle - 95)
        ? "left"
        : "right"
      : left.visibility > right.visibility
        ? "left"
        : "right";
  const primary = primarySide === "left" ? left : right;
  const secondary = primarySide === "left" ? right : left;

  return {
    primary,
    secondary,
    trackedSide: bothVisible && Math.abs(left.elbowAngle - right.elbowAngle) <= 12 ? ("both" as const) : primarySide,
  };
}

function getAverageSquatKneeAngle(landmarks: Landmark[]) {
  return average([
    angle(LM(landmarks, 23), LM(landmarks, 25), LM(landmarks, 27)),
    angle(LM(landmarks, 24), LM(landmarks, 26), LM(landmarks, 28)),
  ]);
}

function getBicepRawPhase(input: Landmark[] | TrackingFrame, previousPhase = "idle") {
  const landmarks = resolveLandmarks(input);
  const { primary } = chooseCurlSnapshot(landmarks);
  const elbowAngle = primary.elbowAngle;

  if (previousPhase === "top") {
    return elbowAngle >= 74 ? "curling" : "top";
  }
  if (previousPhase === "bottom") {
    return elbowAngle <= 142 ? "curling" : "bottom";
  }
  if (previousPhase === "curling") {
    if (elbowAngle <= 68) return "top";
    if (elbowAngle >= 150) return "bottom";
    return "curling";
  }

  if (elbowAngle <= 68) return "top";
  if (elbowAngle < 146) return "curling";
  return "bottom";
}

function getSquatRawPhase(input: Landmark[] | TrackingFrame, previousPhase = "idle") {
  const landmarks = resolveLandmarks(input);
  const kneeAngle = getAverageSquatKneeAngle(landmarks);

  if (previousPhase === "bottom") {
    return kneeAngle > 120 ? "rising" : "bottom";
  }
  if (previousPhase === "rising") {
    if (kneeAngle >= 160) return "top";
    if (kneeAngle <= 115) return "bottom";
    return "rising";
  }
  if (previousPhase === "lowering") {
    if (kneeAngle <= 115) return "bottom";
    if (kneeAngle >= 160) return "top";
    return "lowering";
  }
  if (previousPhase === "top") {
    return kneeAngle < 154 ? "lowering" : "top";
  }

  if (kneeAngle <= 115) return "bottom";
  if (kneeAngle < 154) return "lowering";
  return "top";
}

function dwellForPhase(exerciseId: ExerciseId, phase: string) {
  if (exerciseId === "bicep_curl") {
    if (phase === "top") return 120;
    if (phase === "bottom") return 140;
    return 90;
  }

  if (exerciseId === "squat") {
    if (phase === "bottom") return 150;
    if (phase === "top") return 110;
    return 95;
  }

  if (exerciseId === "jumping_jack") {
    return 60;
  }

  return 75;
}

export function createPhaseTrackerState(now = 0): PhaseTrackerState {
  return {
    phase: "idle",
    rawPhase: "idle",
    phaseStartedAt: now,
    candidatePhase: null,
    candidateSince: 0,
    cycleLoaded: false,
    cycleStartedAt: now,
  };
}

export function advancePhaseTracker(
  exerciseId: ExerciseId,
  input: Landmark[] | TrackingFrame,
  previousState: PhaseTrackerState | null,
  now: number,
): PhaseTrackerUpdate {
  const previous = previousState ?? createPhaseTrackerState(now);
  const rawPhase = getPhaseForExercise(exerciseId, input, previous.phase);
  const next: PhaseTrackerState = { ...previous, rawPhase };
  let phaseChanged = false;
  let nextPhase = previous.phase;

  if (rawPhase === previous.phase) {
    next.candidatePhase = null;
    next.candidateSince = 0;
  } else if (previous.candidatePhase !== rawPhase) {
    next.candidatePhase = rawPhase;
    next.candidateSince = now;
  } else if (now - previous.candidateSince >= dwellForPhase(exerciseId, rawPhase)) {
    nextPhase = rawPhase;
    next.phase = rawPhase;
    next.phaseStartedAt = now;
    next.candidatePhase = null;
    next.candidateSince = 0;
    phaseChanged = true;
  }

  let repCompleted = false;
  let milestone: "load" | "complete" | null = null;
  const cycle = REP_CYCLE_BY_EXERCISE[exerciseId];
  if (phaseChanged && cycle) {
    if (nextPhase === cycle.load) {
      next.cycleLoaded = true;
      next.cycleStartedAt = now;
      milestone = "load";
    } else if (nextPhase === cycle.complete) {
      if (next.cycleLoaded) {
        repCompleted = true;
        next.cycleLoaded = false;
        milestone = "complete";
      }
      next.cycleStartedAt = now;
    }
  }

  return {
    state: next,
    phase: next.phase,
    rawPhase,
    phaseChanged,
    repCompleted,
    milestone,
  };
}

function analyzeBicepCurl(input: Landmark[] | TrackingFrame, phaseOverride?: string) {
  const landmarks = resolveLandmarks(input);
  const { primary, secondary, trackedSide } = chooseCurlSnapshot(landmarks);
  const elbowAngle = primary.elbowAngle;
  const phase = phaseOverride ?? getPhaseForExercise("bicep_curl", input);

  const upperArmLength = Math.max(distance(primary.shoulder, primary.elbow), 0.04);
  const forearmLength = Math.max(distance(primary.elbow, primary.wrist), 0.04);
  const torsoLength = Math.max(distance(primary.shoulder, primary.hip), 0.06);
  const shoulderSpan = Math.max(distance(primary.shoulder, primary.oppositeShoulder), 0.08);
  const elbowPathReliable = resolveReliability(input, primary.side === "left" ? "leftArm" : "rightArm", [...armIndices(primary.side), primary.side === "left" ? 12 : 11], {
    minAverage: 0.64,
    minPoint: 0.48,
  });
  const armReliable = resolveReliability(input, primary.side === "left" ? "leftArm" : "rightArm", armIndices(primary.side), {
    minAverage: 0.68,
    minPoint: 0.52,
  });
  const symmetryReliable =
    secondary.visibility > 0.58 &&
    resolveReliability(input, "wrists", [...armIndices(primary.side), ...armIndices(secondary.side)], {
      minAverage: 0.62,
      minPoint: 0.45,
    });

  const elbowForwardDrift = (Math.abs((primary.elbow?.x ?? 0) - (primary.shoulder?.x ?? 0)) / upperArmLength) * 100;
  const shoulderHike = (Math.max(0, ((primary.oppositeShoulder?.y ?? primary.shoulder?.y ?? 0) - (primary.shoulder?.y ?? 0))) / shoulderSpan) * 100;
  const torsoSwing = (Math.abs((primary.shoulder?.x ?? 0) - (primary.hip?.x ?? 0)) / torsoLength) * 100;
  const wristFold = (Math.abs((primary.wrist?.x ?? 0) - (primary.elbow?.x ?? 0)) / forearmLength) * 100;
  const symmetryGap = Math.abs(primary.elbowAngle - secondary.elbowAngle);
  const topActive = phase === "top" || elbowAngle <= 118;
  const bottomActive = phase === "bottom" || elbowAngle >= 112;

  const metrics = [
    metric(
      "Top Finish",
      scoreFromRange(elbowAngle, 42, 68, 16),
      elbowAngle > 72
        ? "Finish the curl higher; bring the forearm closer to the shoulder without letting the elbow travel."
        : elbowAngle < 34
          ? "You are closing the elbow too hard at the top. Squeeze, then reverse before the joint jams shut."
          : "Top squeeze is clean and controlled.",
      Math.round(elbowAngle),
      "42-68 degrees",
      {
        reliable: armReliable && topActive,
        unreliableDetail: "Top squeeze is not reliable to judge until the elbow and wrist stay clearly visible near the top.",
      },
    ),
    metric(
      "Bottom Extension",
      scoreFromRange(elbowAngle, 150, 174, 16),
      elbowAngle < 148
        ? "Lower farther until the arm is almost straight before the next curl."
        : elbowAngle > 177
          ? "Stop just short of a hard lockout at the bottom."
          : "Bottom extension is full without snapping the joint.",
      Math.round(elbowAngle),
      "150-174 degrees",
      {
        reliable: armReliable && bottomActive,
        unreliableDetail: "Bottom extension is not reliable to judge until the arm is visible through the full lowering phase.",
      },
    ),
    metric(
      "Elbow Path",
      scoreFromRange(elbowForwardDrift, 0, 28, 12),
      elbowForwardDrift > 30
        ? `Keep your ${trackedSide === "both" ? "elbows" : `${primary.side} elbow`} pinned to your ribs; it is drifting forward.`
        : `Good ${trackedSide === "both" ? "elbow path" : `${primary.side} elbow path`}; the upper arm is staying quiet.`,
      Number(elbowForwardDrift.toFixed(1)),
      "0-28 drift",
      {
        reliable: elbowPathReliable,
        unreliableDetail: "Elbow path is not stable enough to judge until the shoulder, elbow, and hip are all clearly tracked.",
      },
    ),
    metric(
      "Shoulder Stability",
      scoreFromRange(shoulderHike, 0, 7, 8),
      shoulderHike > 8
        ? `Stop shrugging your ${primary.side} shoulder to finish the curl.`
        : "Shoulder is staying quiet and out of the rep.",
      Number(shoulderHike.toFixed(1)),
      "0-7 lift",
      {
        reliable: elbowPathReliable,
        unreliableDetail: "Shoulder height is too noisy to coach right now. Square up and keep both shoulders visible.",
      },
    ),
    metric(
      "Torso Stability",
      scoreFromRange(torsoSwing, 0, 11, 8),
      torsoSwing > 12
        ? "Brace your abs and stop swinging your torso to start the curl."
        : "Torso stays quiet; the curl is coming from the arm.",
      Number(torsoSwing.toFixed(1)),
      "0-11 sway",
      {
        reliable: resolveReliability(input, "trunk", primary.side === "left" ? [11, 23] : [12, 24], {
          minAverage: 0.6,
          minPoint: 0.45,
        }),
        unreliableDetail: "Torso control is too noisy to judge until the shoulder and hip stay clearly visible.",
      },
    ),
    metric(
      "Wrist Stack",
      scoreFromRange(wristFold, 0, 26, 10),
      wristFold > 28
        ? `Straighten your ${primary.side} wrist; keep the dumbbell stacked over the forearm.`
        : "Wrist stays stacked over the forearm.",
      Number(wristFold.toFixed(1)),
      "0-26 fold",
      {
        reliable: false,
        unreliableDetail: "Hand orientation is not measured by this pose-only scorecard.",
      },
    ),
    metric(
      "Symmetry",
      scoreFromRange(symmetryGap, 0, 12, 8),
      symmetryGap > 13
        ? "One arm is moving ahead of the other. Match both elbows and wrists."
        : "Both arms are moving together.",
      Math.round(symmetryGap),
      symmetryReliable ? "0-12 degrees gap" : "single-arm",
      {
        reliable: symmetryReliable,
        unreliableDetail: "Symmetry is not stable enough to judge until both arms stay visible together.",
      },
    ),
  ];

  const reliableCorrections = metrics
    .filter((item) => item.reliable !== false && item.score < 78)
    .sort((a, b) => a.score - b.score);

  const positives = [
    metrics[2].reliable !== false && metrics[2].score >= 85 ? `Your ${trackedSide === "both" ? "elbows are" : `${primary.side} elbow is`} staying tucked well.` : "",
    metrics[4].reliable !== false && metrics[4].score >= 85 ? "Your torso is quiet; there is no cheating swing." : "",
    metrics[5].reliable !== false && metrics[5].score >= 85 ? `Your ${primary.side} wrist is stacked well under the load.` : "",
    metrics[0].reliable !== false && metrics[0].score >= 88 ? "You are finishing the rep with a clean top squeeze." : "",
    metrics[1].reliable !== false && metrics[1].score >= 88 ? "You are getting full controlled length at the bottom." : "",
  ].filter(Boolean);

  const injuryRisks = [
    metrics[0].reliable !== false && elbowAngle < 28
      ? "You are crushing the elbow shut at the top. Squeeze and reverse instead of forcing the joint closed."
      : "",
    metrics[1].reliable !== false && elbowAngle > 178
      ? "You are locking the elbow hard at the bottom. Keep a soft elbow and control the lowering."
      : "",
    metrics[4].reliable !== false && torsoSwing > 16
      ? "Torso swing is starting the lift. That shifts load into the low back instead of the biceps."
      : "",
    metrics[3].reliable !== false && shoulderHike > 9
      ? "Shrugging to finish the curl can irritate the front of the shoulder."
      : "",
    metrics[5].reliable !== false && wristFold > 30
      ? "A folded wrist under load can irritate the wrist and forearm tendons."
      : "",
  ].filter(Boolean);

  return finalize(phase, metrics, {
    positives,
    corrections: reliableCorrections.map((item) => item.detail).slice(0, 4),
    injuryRisks,
    primaryFocus: injuryRisks[0] ?? reliableCorrections[0]?.detail ?? positives[0],
    secondaryNote: positives[0] ?? (phase === "top" ? "Own the squeeze, then lower slowly." : "Brace and keep the elbow pinned."),
    trackedSide,
  });
}

function analyzeSquat(input: Landmark[] | TrackingFrame, phaseOverride?: string) {
  const landmarks = resolveLandmarks(input);
  const leftShoulder = LM(landmarks, 11);
  const rightShoulder = LM(landmarks, 12);
  const leftHip = LM(landmarks, 23);
  const rightHip = LM(landmarks, 24);
  const leftKnee = LM(landmarks, 25);
  const rightKnee = LM(landmarks, 26);
  const leftAnkle = LM(landmarks, 27);
  const rightAnkle = LM(landmarks, 28);
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const kneeCenter = midpoint(leftKnee, rightKnee);
  const ankleCenter = midpoint(leftAnkle, rightAnkle);
  const phase = phaseOverride ?? getPhaseForExercise("squat", input);

  const { left: kneeLeft, right: kneeRight, gap: symmetryGap } = kneeSymmetry(landmarks);
  const avgKnee = average([kneeLeft, kneeRight]);
  const torsoAngle = trunkStackAngle(landmarks);
  const shoulderSpan = Math.max(distance(leftShoulder, rightShoulder), 0.08);
  const shoulderTiltValue = shoulderTilt(landmarks);
  const ankleWidth = distance(leftAnkle, rightAnkle);
  const kneeWidth = distance(leftKnee, rightKnee);
  const kneeCollapse = (Math.max(0, ankleWidth - kneeWidth) / shoulderSpan) * 100;
  const hipShift = (Math.abs((hipCenter?.x ?? 0) - (ankleCenter?.x ?? kneeCenter?.x ?? 0)) / shoulderSpan) * 100;
  const depthActive = phase !== "top" || avgKnee < 150;
  const squatReliable = resolveReliability(input, "fullBody", [11, 12, 23, 24, 25, 26, 27, 28], {
    minAverage: 0.64,
    minPoint: 0.48,
  });

  const metrics = [
    metric(
      "Depth",
      scoreFromRange(avgKnee, 86, 108, 18),
      avgKnee > 114
        ? "Sit 5-10 cm deeper until the hips reach knee level."
        : avgKnee < 74
          ? "Do not force yourself deeper than you can control. Stay stacked and own the bottom."
          : "Depth is solid and controlled.",
      Math.round(avgKnee),
      "86-108 degrees",
      {
        reliable: squatReliable && depthActive,
        unreliableDetail: "Depth is not reliable to judge until both hips, knees, and ankles stay visible through the descent.",
      },
    ),
    metric(
      "Knee Tracking",
      scoreFromTarget(kneeCollapse, 0, 10),
      kneeCollapse > 12
        ? "Drive both knees over the middle toes. They are collapsing inward at the bottom."
        : "Knees are tracking cleanly over the feet.",
      Number(kneeCollapse.toFixed(1)),
      "0-10 inward collapse",
      {
        reliable: squatReliable && depthActive,
        unreliableDetail: "Knee tracking is not reliable to judge until knees and ankles stay visible through the bottom.",
      },
    ),
    metric(
      "Torso Stack",
      scoreFromRange(torsoAngle, 58, 82, 16),
      torsoAngle < 56
        ? "Keep your chest over mid-foot and brace the ribs down. You are folding too far forward."
        : torsoAngle > 90
          ? "Stand a little taller through the chest instead of leaning back out of the squat."
          : "Torso stack looks controlled over the mid-foot.",
      Math.round(torsoAngle),
      "58-82 degrees",
      {
        reliable: squatReliable,
        unreliableDetail: "Torso stack is too noisy to coach until the shoulders, hips, and knees are fully visible.",
      },
    ),
    metric(
      "Hip Centering",
      scoreFromTarget(hipShift, 0, 11),
      hipShift > 12
        ? "Keep your hips centered between both heels. You are shifting off one side."
        : "Hip path is centered between both feet.",
      Number(hipShift.toFixed(1)),
      "0-11 shift",
      {
        reliable: squatReliable,
        unreliableDetail: "Hip centering is not stable enough to judge until both legs stay fully in frame.",
      },
    ),
    metric(
      "Symmetry",
      scoreFromTarget(symmetryGap, 0, 14),
      symmetryGap > 15
        ? "Match both knees. One leg is taking more of the squat than the other."
        : "Both knees are sharing the work evenly.",
      Math.round(symmetryGap),
      "0-14 degrees gap",
      {
        reliable: squatReliable,
        unreliableDetail: "Knee symmetry is too noisy to coach until both legs stay clearly visible.",
      },
    ),
    metric(
      "Shoulder Stability",
      scoreFromTarget(shoulderTiltValue, 0, 8),
      shoulderTiltValue > 9
        ? "Level your shoulders and stop twisting as you squat."
        : "Shoulders are staying level through the rep.",
      Number(shoulderTiltValue.toFixed(1)),
      "0-8 tilt",
      {
        reliable: resolveReliability(input, "trunk", [11, 12], {
          minAverage: 0.6,
          minPoint: 0.45,
        }),
        unreliableDetail: "Shoulder level is too noisy to trust until both shoulders are clearly visible.",
      },
    ),
  ];

  const reliableCorrections = metrics
    .filter((item) => item.reliable !== false && item.score < 78)
    .sort((a, b) => a.score - b.score);

  const positives = [
    metrics[0].reliable !== false && metrics[0].score >= 86 ? "Depth is landing in a strong, controlled bottom position." : "",
    metrics[1].reliable !== false && metrics[1].score >= 85 ? "Your knees are tracking cleanly over your feet." : "",
    metrics[2].reliable !== false && metrics[2].score >= 85 ? "Your chest is staying stacked over the mid-foot." : "",
    metrics[3].reliable !== false && metrics[3].score >= 85 ? "You are staying centered instead of drifting off one side." : "",
    metrics[4].reliable !== false && metrics[4].score >= 85 ? "Both legs are sharing the squat evenly." : "",
  ].filter(Boolean);

  const injuryRisks = [
    metrics[2].reliable !== false && torsoAngle < 48
      ? "Your torso is collapsing too far forward. Reset before the next rep so the low back does not take the load."
      : "",
    metrics[0].reliable !== false && avgKnee < 68
      ? "You are dropping deeper than you can control. Stay in the deepest position you can own safely."
      : "",
    metrics[1].reliable !== false && kneeCollapse > 18
      ? "Your knees are collapsing inward. Reset your stance before loading the next rep."
      : "",
    metrics[3].reliable !== false && hipShift > 18
      ? "You are shifting hard onto one side at the bottom. Re-center before loading the next rep."
      : "",
  ].filter(Boolean);

  return finalize(phase, metrics, {
    positives,
    corrections: reliableCorrections.map((item) => item.detail).slice(0, 4),
    injuryRisks,
    primaryFocus: injuryRisks[0] ?? reliableCorrections[0]?.detail ?? positives[0],
    secondaryNote: positives[0] ?? "Sit between the heels, then stand straight through mid-foot.",
    trackedSide: "both",
  });
}

function analyzeDanceBasic(input: Landmark[] | TrackingFrame, danceBeat = 0, danceTargetCue?: string) {
  const landmarks = resolveLandmarks(input);
  const leftShoulder = LM(landmarks, 11);
  const rightShoulder = LM(landmarks, 12);
  const leftWrist = LM(landmarks, 15);
  const rightWrist = LM(landmarks, 16);
  const leftHip = LM(landmarks, 23);
  const rightHip = LM(landmarks, 24);
  const leftKnee = LM(landmarks, 25);
  const rightKnee = LM(landmarks, 26);
  const leftAnkle = LM(landmarks, 27);
  const rightAnkle = LM(landmarks, 28);
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const phaseIndex = ((danceBeat % 4) + 4) % 4;
  const openCount = phaseIndex === 0 || phaseIndex === 2;
  const phase = openCount ? "hit" : phaseIndex === 1 ? "groove" : "reset";

  const shoulderLevel = shoulderTilt(landmarks);
  const hipLevel = hipTilt(landmarks);
  const frameWidth = distance(leftWrist, rightWrist) * 100;
  const armHeightMismatch = Math.abs((leftWrist?.y ?? 0) - (rightWrist?.y ?? 0)) * 100;
  const averageArmLift = average([
    ((leftShoulder?.y ?? 0) - (leftWrist?.y ?? 0)) * 100,
    ((rightShoulder?.y ?? 0) - (rightWrist?.y ?? 0)) * 100,
  ]);
  const torsoLean = Math.abs((shoulderCenter?.x ?? 0) - (hipCenter?.x ?? 0)) * 100;
  const leftKneeAngle = angle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = angle(rightHip, rightKnee, rightAnkle);
  const averageKneeAngle = average([leftKneeAngle, rightKneeAngle]);
  const asymmetry = average([armHeightMismatch, shoulderLevel, hipLevel]);

  const targetFrameWidth = openCount ? 72 : 56;
  const targetArmLift = openCount ? 10 : 1;
  const targetKneeAngle = openCount ? 162 : 150;
  const cue = danceTargetCue ?? (openCount ? "Hit the next count with a wide frame" : "Settle into the groove with soft knees");

  const metrics = [
    metric(
      "Frame Width",
      scoreFromTarget(frameWidth, targetFrameWidth, openCount ? 18 : 16),
      openCount
        ? frameWidth < 56
          ? "Reach both wrists wider on this count so the frame reads bigger."
          : frameWidth > 96
            ? "Keep the frame wide but connected; do not over-stretch the arms past control."
            : "Frame width is reading clean on the beat."
        : frameWidth < 42
          ? "Open the elbows slightly more so the groove does not collapse inward."
          : "Your frame stays open while you groove.",
      Number(frameWidth.toFixed(1)),
      openCount ? "54-90 width" : "40-72 width",
    ),
    metric(
      "Arm Range",
      Math.round(
        average([
          scoreFromTarget(armHeightMismatch, 0, 7),
          scoreFromTarget(averageArmLift, targetArmLift, openCount ? 10 : 8),
        ]),
      ),
      armHeightMismatch > 8
        ? "One wrist is dropping below the other. Match both arm lines on the count."
        : openCount && averageArmLift < 2
          ? "Lift both wrists higher so the hit lands at shoulder level."
          : !openCount && averageArmLift > 12
            ? "Let the arms settle slightly on the groove instead of holding them too high."
            : "Both arms are matching the line well.",
      Number(averageArmLift.toFixed(1)),
      openCount ? "lift 2-20" : "lift -7 to 9",
    ),
    metric(
      "Torso Stability",
      scoreFromTarget(torsoLean, 0, 8),
      torsoLean > 9 ? "Stack your ribs over your hips. Your torso is leaning off-center." : "Torso stays stacked over the hips.",
      Number(torsoLean.toFixed(1)),
      "0-8 lean",
    ),
    metric(
      "Knee Bounce",
      scoreFromTarget(averageKneeAngle, targetKneeAngle, openCount ? 16 : 14),
      averageKneeAngle > 173
        ? "Soften both knees. You are locking out between counts."
        : averageKneeAngle < 126
          ? "You are sinking too low for this groove. Keep the bounce lighter and quicker."
          : "Knee bounce matches the groove.",
      Math.round(averageKneeAngle),
      openCount ? "146-178 degrees" : "136-164 degrees",
    ),
    metric(
      "Tempo Timing",
      scoreFromTarget(averageArmLift, targetArmLift, openCount ? 8 : 7),
      openCount
        ? averageArmLift < 1
          ? "You are late getting the arms up. Hit the count earlier."
          : "The arm hit is landing on time."
        : averageArmLift > 10
          ? "You are holding the hit too long. Drop into the groove sooner."
          : "Your groove timing is matching the beat.",
      Number(averageArmLift.toFixed(1)),
      openCount ? "hit higher" : "groove lower",
    ),
    metric(
      "Symmetry",
      scoreFromTarget(asymmetry, 0, 7),
      asymmetry > 8 ? "Shoulders, hips, and wrists are not matching side to side. Clean up the left-right balance." : "Left-right balance looks controlled.",
      Number(asymmetry.toFixed(1)),
      "0-7 mismatch",
    ),
  ];

  const positives = [
    metrics[0].score >= 85 ? "Your frame width is clear and readable." : "",
    metrics[1].score >= 85 ? "Both wrists are matching the line well." : "",
    metrics[2].score >= 85 ? "Your torso is stacked cleanly over the hips." : "",
    metrics[3].score >= 85 ? "Your knees stay soft instead of snapping straight." : "",
    metrics[4].score >= 88 ? "Your timing is landing with the music instead of chasing it." : "",
  ].filter(Boolean);

  const corrections = metrics
    .filter((item) => item.score < 78)
    .sort((a, b) => a.score - b.score)
    .map((item) => item.detail)
    .slice(0, 4);

  const injuryRisks = [
    averageKneeAngle > 175 ? "Your knees are locking on the beat. Keep a soft bend so the joints do not absorb the whole impact." : "",
    torsoLean > 13 ? "Your torso is dumping sideways instead of staying stacked. That can irritate the low back if it keeps repeating." : "",
    shoulderLevel > 10 ? "One shoulder is hiking higher than the other. Do not shrug into the arm line." : "",
    hipLevel > 10 ? "Your hips are tilting instead of shifting smoothly. Reset your stance before the next phrase." : "",
  ].filter(Boolean);

  return finalize(phase, metrics, {
    positives,
    corrections,
    injuryRisks,
    primaryFocus: injuryRisks[0] ?? corrections[0] ?? cue,
    secondaryNote: positives[0] ?? cue,
    trackedSide: "both",
    targetCue: cue,
  });
}

export function getPhaseForExercise(exerciseId: ExerciseId, input: Landmark[] | TrackingFrame, previousPhase = "idle") {
  const landmarks = resolveLandmarks(input);
  const side = selectSide(landmarks);
  const trackedHip = LM(landmarks, side === "left" ? 23 : 24);
  const trackedKnee = LM(landmarks, side === "left" ? 25 : 26);
  const trackedAnkle = LM(landmarks, side === "left" ? 27 : 28);
  const trackedShoulder = LM(landmarks, side === "left" ? 11 : 12);
  const trackedElbow = LM(landmarks, side === "left" ? 13 : 14);
  const trackedWrist = LM(landmarks, side === "left" ? 15 : 16);
  const rightWrist = LM(landmarks, 16);
  const rightAnkle = LM(landmarks, 28);

  if (exerciseId === "squat") {
    return getSquatRawPhase(landmarks, previousPhase);
  }

  if (exerciseId === "lunge") {
    const kneeAngle = angle(trackedHip, trackedKnee, trackedAnkle);
    if (previousPhase === "bottom") return kneeAngle > 118 ? "rising" : "bottom";
    if (previousPhase === "rising") {
      if (kneeAngle >= 150) return "top";
      if (kneeAngle <= 112) return "bottom";
      return "rising";
    }
    if (previousPhase === "lowering") {
      if (kneeAngle <= 112) return "bottom";
      if (kneeAngle >= 150) return "top";
      return "lowering";
    }
    if (previousPhase === "top") return kneeAngle < 144 ? "lowering" : "top";
    if (kneeAngle < 112) return "bottom";
    if (kneeAngle < 144) return "lowering";
    return "top";
  }

  if (exerciseId === "pushup") {
    const elbowAngle = angle(trackedShoulder, trackedElbow, trackedWrist);
    if (previousPhase === "bottom") return elbowAngle > 105 ? "rising" : "bottom";
    if (previousPhase === "rising") {
      if (elbowAngle >= 162) return "top";
      if (elbowAngle <= 98) return "bottom";
      return "rising";
    }
    if (previousPhase === "lowering") {
      if (elbowAngle <= 98) return "bottom";
      if (elbowAngle >= 162) return "top";
      return "lowering";
    }
    if (previousPhase === "top") return elbowAngle < 150 ? "lowering" : "top";
    if (elbowAngle < 98) return "bottom";
    if (elbowAngle < 150) return "lowering";
    return "top";
  }

  if (exerciseId === "bicep_curl") {
    return getBicepRawPhase(landmarks, previousPhase);
  }

  if (exerciseId === "jumping_jack") {
    const shoulderWidth = Math.max(distance(LM(landmarks, 11), LM(landmarks, 12)), 0.05);
    const wristSpread = distance(trackedWrist, rightWrist) / shoulderWidth;
    const ankleSpread = distance(trackedAnkle, rightAnkle) / shoulderWidth;
    if (previousPhase === "open") {
      return wristSpread < 1.6 || ankleSpread < 1.1 ? "closing" : "open";
    }
    if (previousPhase === "closing") {
      if (wristSpread < 1.25 && ankleSpread < 0.9) return "closed";
      if (wristSpread > 1.8 && ankleSpread > 1.2) return "open";
      return "closing";
    }
    return wristSpread > 1.8 && ankleSpread > 1.2 ? "open" : "closed";
  }

  return "hold";
}

export function analyzeExercise(
  exerciseId: ExerciseId,
  input: Landmark[] | TrackingFrame,
  danceBeat = 0,
  danceTargetCue?: string,
  phaseOverride?: string,
): FrameAnalysis {
  const landmarks = resolveLandmarks(input);
  const leftShoulder = LM(landmarks, 11);
  const rightShoulder = LM(landmarks, 12);
  const leftElbow = LM(landmarks, 13);
  const rightElbow = LM(landmarks, 14);
  const leftWrist = LM(landmarks, 15);
  const rightWrist = LM(landmarks, 16);
  const leftHip = LM(landmarks, 23);
  const rightHip = LM(landmarks, 24);
  const leftKnee = LM(landmarks, 25);
  const rightKnee = LM(landmarks, 26);
  const leftAnkle = LM(landmarks, 27);
  const rightAnkle = LM(landmarks, 28);

  if (exerciseId === "squat") {
    return withTrackingContext(analyzeSquat(input, phaseOverride), input);
  }

  if (exerciseId === "pushup") {
    const phase = phaseOverride ?? getPhaseForExercise(exerciseId, input);
    const elbow = average([angle(leftShoulder, leftElbow, leftWrist), angle(rightShoulder, rightElbow, rightWrist)]);
    const bodyLine = average([angle(leftShoulder, leftHip, leftAnkle), angle(rightShoulder, rightHip, rightAnkle)]);
    const shoulderStack = average([
      Math.abs((leftShoulder?.x ?? 0) - (leftElbow?.x ?? 0)) * 100,
      Math.abs((rightShoulder?.x ?? 0) - (rightElbow?.x ?? 0)) * 100,
    ]);
    const hipLevel = Math.abs((leftHip?.y ?? 0) - (rightHip?.y ?? 0)) * 100;
    const pushReliable = resolveReliability(input, "trunk", [11, 13, 15, 23, 25, 27], { minAverage: 0.62, minPoint: 0.45 });
    const metrics = [
      metric(
        "Depth",
        scoreFromRange(elbow, 72, 96, 16),
        elbow > 104 ? "Lower until elbows bend to roughly 90 degrees before pressing up." : "Depth is controlled and consistent.",
        Math.round(elbow),
        "72-96 degrees",
        { reliable: pushReliable },
      ),
      metric(
        "Body Line",
        scoreFromRange(bodyLine, 166, 180, 14),
        bodyLine < 164 ? "Brace harder and keep shoulders, hips, and heels in one line." : "Body line is staying long and stacked.",
        Math.round(bodyLine),
        "166-180 degrees",
        { reliable: pushReliable },
      ),
      metric(
        "Shoulder Stack",
        scoreFromTarget(shoulderStack, 0, 8),
        shoulderStack > 10 ? "Shift shoulders directly over the hands instead of hanging back." : "Shoulders stay stacked over the hands.",
        Number(shoulderStack.toFixed(1)),
        "0-8 offset",
        { reliable: resolveReliability(input, "trunk", [11, 13, 14, 12], { minAverage: 0.6, minPoint: 0.45 }) },
      ),
      metric(
        "Hip Stability",
        scoreFromTarget(hipLevel, 0, 7),
        hipLevel > 8 ? "Level the hips; one side is dropping during the rep." : "Hips are staying level through the set.",
        Number(hipLevel.toFixed(1)),
        "0-7 tilt",
        { reliable: resolveReliability(input, "trunk", [23, 24], { minAverage: 0.6, minPoint: 0.45 }) },
      ),
    ];
    const corrections = metrics.filter((item) => item.reliable !== false && item.score < 78).sort((a, b) => a.score - b.score).map((item) => item.detail);
    return withTrackingContext(
      finalize(phase, metrics, {
        corrections: corrections.slice(0, 4),
        positives: metrics.filter((item) => item.reliable !== false && item.score >= 85).map((item) => item.detail).slice(0, 3),
        injuryRisks: [
          metrics[1].reliable !== false && bodyLine < 156 ? "Your hips are sagging enough to dump stress into the low back. Reset before the next rep." : "",
        ].filter(Boolean),
        primaryFocus: corrections[0],
        secondaryNote: corrections[0] ? "Own the body line first, then chase depth." : "Long spine, steady lowering, strong press.",
        trackedSide: "both",
      }),
      input,
    );
  }

  if (exerciseId === "lunge") {
    const phase = phaseOverride ?? getPhaseForExercise(exerciseId, input);
    const leftLeg = angle(leftHip, leftKnee, leftAnkle);
    const rightLeg = angle(rightHip, rightKnee, rightAnkle);
    const frontKnee = Math.min(leftLeg, rightLeg);
    const torso = trunkLean(landmarks);
    const pelvisLevel = hipTilt(landmarks);
    const lungeReliable = resolveReliability(input, "lowerBody", [23, 24, 25, 26, 27, 28], { minAverage: 0.63, minPoint: 0.45 });
    const metrics = [
      metric(
        "Front Knee",
        scoreFromRange(frontKnee, 82, 102, 16),
        frontKnee > 108 ? "Sink deeper into the front leg so the rep finishes lower." : "Front knee depth is in a strong range.",
        Math.round(frontKnee),
        "82-102 degrees",
        { reliable: lungeReliable },
      ),
      metric(
        "Torso Stack",
        scoreFromTarget(torso, 0, 10),
        torso > 12 ? "Stack the ribs over the hips instead of leaning forward into the front leg." : "Torso stays stacked over the hips.",
        Number(torso.toFixed(1)),
        "0-10 lean",
        { reliable: resolveReliability(input, "trunk", [11, 12, 23, 24], { minAverage: 0.6, minPoint: 0.45 }) },
      ),
      metric(
        "Hip Level",
        scoreFromTarget(pelvisLevel, 0, 8),
        pelvisLevel > 9 ? "Level the hips; one side is hiking during the lunge." : "Pelvis is staying level and controlled.",
        Number(pelvisLevel.toFixed(1)),
        "0-8 tilt",
        { reliable: lungeReliable },
      ),
      metric(
        "Leg Balance",
        scoreFromTarget(Math.abs(leftLeg - rightLeg), 0, 18),
        Math.abs(leftLeg - rightLeg) > 20 ? "Slow down and let both legs share the position instead of collapsing into one side." : "Both legs are contributing evenly.",
        Math.round(Math.abs(leftLeg - rightLeg)),
        "0-18 gap",
        { reliable: lungeReliable },
      ),
    ];
    const corrections = metrics.filter((item) => item.reliable !== false && item.score < 78).sort((a, b) => a.score - b.score).map((item) => item.detail);
    return withTrackingContext(
      finalize(phase, metrics, {
        corrections: corrections.slice(0, 4),
        positives: metrics.filter((item) => item.reliable !== false && item.score >= 85).map((item) => item.detail).slice(0, 3),
        injuryRisks: [
          metrics[2].reliable !== false && pelvisLevel > 12 ? "Pelvis tilt is large enough to load one hip more than the other. Reset before the next rep." : "",
        ].filter(Boolean),
        primaryFocus: corrections[0],
        secondaryNote: corrections[0] ? "Stay tall and lower straight down." : "Tall torso, quiet hips, even pressure in both legs.",
        trackedSide: "both",
      }),
      input,
    );
  }

  if (exerciseId === "bicep_curl") {
    return withTrackingContext(analyzeBicepCurl(input, phaseOverride), input);
  }

  if (exerciseId === "dance_basic") {
    return withTrackingContext(analyzeDanceBasic(input, danceBeat, danceTargetCue), input);
  }

  if (exerciseId === "jumping_jack") {
    const phase = phaseOverride ?? getPhaseForExercise(exerciseId, input);
    const wristSpread = distance(leftWrist, rightWrist) * 100;
    const ankleSpread = distance(leftAnkle, rightAnkle) * 100;
    const kneeAngles = kneeSymmetry(landmarks);
    const landingSoftness = average([kneeAngles.left, kneeAngles.right]);
    const shoulderLevel = shoulderTilt(landmarks);
    const metrics = [
      metric("Arm Reach", scoreFromRange(wristSpread, 58, 98, 16), wristSpread < 56 ? "Reach wider overhead on the open phase." : "Arm line is opening fully.", Math.round(wristSpread), "58-98"),
      metric("Foot Width", scoreFromRange(ankleSpread, 36, 78, 14), ankleSpread < 34 ? "Open the feet more on the jump." : "Foot pattern is opening cleanly.", Math.round(ankleSpread), "36-78"),
      metric(
        "Timing Sync",
        scoreFromTarget(wristSpread - ankleSpread, 18, 16),
        Math.abs(wristSpread - ankleSpread - 18) > 18 ? "Keep arms and feet opening together instead of chasing one another." : "Arms and feet are staying in sync.",
        Math.round(wristSpread - ankleSpread),
        "sync delta near 18",
      ),
      metric(
        "Landing Control",
        scoreFromRange(landingSoftness, 150, 172, 14),
        landingSoftness > 176 ? "Land with softer knees instead of snapping them straight." : "Knees stay soft when you land.",
        Math.round(landingSoftness),
        "150-172 degrees",
      ),
      metric(
        "Symmetry",
        scoreFromTarget(shoulderLevel, 0, 8),
        shoulderLevel > 9 ? "Stay tall and stop hiking one shoulder as you jump." : "Shoulders stay level through the pattern.",
        Number(shoulderLevel.toFixed(1)),
        "0-8 tilt",
      ),
    ];
    const corrections = metrics.filter((item) => item.reliable !== false && item.score < 78).sort((a, b) => a.score - b.score).map((item) => item.detail);
    return withTrackingContext(
      finalize(phase, metrics, {
        corrections: corrections.slice(0, 4),
        positives: metrics.filter((item) => item.score >= 85).map((item) => item.detail).slice(0, 3),
        injuryRisks: [
          landingSoftness > 178 ? "You are landing with locked knees. Keep the landing soft before the next rep." : "",
        ].filter(Boolean),
        primaryFocus: corrections[0],
        secondaryNote: corrections[0] ? "Open wide, then land softly." : "Wide reach, quick feet, soft landing.",
        trackedSide: "both",
      }),
      input,
    );
  }

  if (exerciseId === "plank") {
    const bodyLine = average([angle(leftShoulder, leftHip, leftAnkle), angle(rightShoulder, rightHip, rightAnkle)]);
    const shoulderStack = average([
      Math.abs((leftShoulder?.x ?? 0) - (leftElbow?.x ?? 0)) * 100,
      Math.abs((rightShoulder?.x ?? 0) - (rightElbow?.x ?? 0)) * 100,
    ]);
    const hipLevel = hipTilt(landmarks);
    const neckPosition = average([
      Math.abs((leftShoulder?.y ?? 0) - (leftWrist?.y ?? 0)) * 100,
      Math.abs((rightShoulder?.y ?? 0) - (rightWrist?.y ?? 0)) * 100,
    ]);
    const metrics = [
      metric("Body Line", scoreFromRange(bodyLine, 168, 180, 12), bodyLine < 166 ? "Lift through the core and pull ribs toward hips." : "Body line is strong and long.", Math.round(bodyLine), "168-180 degrees"),
      metric("Shoulder Stack", scoreFromTarget(shoulderStack, 0, 8), shoulderStack > 10 ? "Shift shoulders directly over elbows." : "Shoulders are stacked over elbows.", Number(shoulderStack.toFixed(1)), "0-8 offset"),
      metric("Hip Level", scoreFromTarget(hipLevel, 0, 6), hipLevel > 7 ? "Keep both hips level instead of rotating." : "Hips are staying level.", Number(hipLevel.toFixed(1)), "0-6 tilt"),
      metric("Neck Position", scoreFromTarget(neckPosition, 18, 10), neckPosition > 30 ? "Lengthen the neck and keep your gaze slightly ahead of the hands." : "Neck position stays neutral.", Number(neckPosition.toFixed(1)), "neutral"),
    ];
    const corrections = metrics.filter((item) => item.score < 78).sort((a, b) => a.score - b.score).map((item) => item.detail);
    return withTrackingContext(
      finalize("hold", metrics, {
        corrections: corrections.slice(0, 4),
        positives: metrics.filter((item) => item.score >= 85).map((item) => item.detail).slice(0, 3),
        injuryRisks: [
          bodyLine < 158 ? "The hips are sagging enough to push stress into the low back. Reset the plank before continuing." : "",
        ].filter(Boolean),
        primaryFocus: corrections[0],
        secondaryNote: corrections[0] ? "Long line from shoulders to heels." : "Long spine, quiet hips, steady breath.",
        trackedSide: "both",
      }),
      input,
    );
  }

  if (exerciseId === "warrior") {
    const frontKnee = angle(leftHip, leftKnee, leftAnkle);
    const armLine = Math.abs((((leftWrist?.y ?? 0) + (rightWrist?.y ?? 0)) / 2) - (((leftShoulder?.y ?? 0) + (rightShoulder?.y ?? 0)) / 2)) * 100;
    return withTrackingContext(finalize("hold", [
      metric("Front Knee", scoreFromRange(frontKnee, 82, 100, 20), frontKnee > 105 ? "Bend deeper into the front leg." : "Front knee is tracking well.", Math.round(frontKnee), "82-100 degrees"),
      metric("Arm Line", scoreFromTarget(armLine, 0, 7), armLine > 8 ? "Reach both arms parallel to the floor." : "Arms are extended cleanly."),
      metric("Stability", scoreFromTarget(Math.abs((leftHip?.y ?? 0) - (rightHip?.y ?? 0)) * 100, 0, 8), "Square the hips with the pose."),
      metric("Tempo", 100, "Hold steady and breathe."),
    ]), input);
  }

  return withTrackingContext(finalize("hold", [
    metric("Control", 80, "Stay centered and keep moving with control."),
    metric("Stability", 80, "Keep the movement organized from shoulders to hips."),
    metric("Rhythm", 80, "Keep the timing even."),
    metric("Safety", 80, "No major issues detected."),
  ]), input);
}
