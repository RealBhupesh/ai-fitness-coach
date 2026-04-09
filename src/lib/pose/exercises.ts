import { angle, average, clamp, distance, midpoint, scoreFromRange, scoreFromTarget } from "@/lib/pose/math";
import type { ExerciseId, FrameAnalysis, Landmark, LiveMetric, PoseExercise } from "@/lib/pose/types";

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

export const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32],
];

export const POSE_EXERCISES: PoseExercise[] = [
  {
    id: "squat",
    label: "Squat",
    icon: "S",
    category: "strength",
    repBased: true,
    tips: ["Keep heels down", "Chest tall", "Drive knees over toes"],
    calibration: ["Full body visible", "Side angle works best", "Feet inside the frame"],
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
    calibration: ["Show both legs", "Stand side-on", "Leave headroom above shoulders"],
  },
  {
    id: "bicep_curl",
    label: "Bicep Curl",
    icon: "C",
    category: "strength",
    repBased: true,
    tips: ["Pin elbows in", "Avoid torso swing", "Squeeze at the top"],
    calibration: ["Upper body in frame", "Front view preferred", "Keep wrists visible"],
  },
  {
    id: "jumping_jack",
    label: "Jumping Jack",
    icon: "J",
    category: "cardio",
    repBased: true,
    tips: ["Land softly", "Reach fully overhead", "Keep rhythm even"],
    calibration: ["Full body visible", "Leave space overhead", "Stand centered"],
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
    calibration: ["Full body visible", "Side view preferred", "Arms must stay in frame"],
  },
  {
    id: "dance_basic",
    label: "Dance Frame",
    icon: "D",
    category: "dance",
    repBased: false,
    tips: ["Keep ribs stacked over hips", "Reach both wrists evenly", "Keep knees soft on every count"],
    calibration: ["Front view preferred", "Both wrists visible", "Leave lateral room for arm lines"],
  },
];

const LM = (landmarks: Landmark[], index: number) => landmarks[index];
const vis = (landmark?: Landmark | null) => landmark?.visibility ?? 0;

function selectSide(landmarks: Landmark[]) {
  const left = average([vis(LM(landmarks, 11)), vis(LM(landmarks, 13)), vis(LM(landmarks, 15)), vis(LM(landmarks, 23)), vis(LM(landmarks, 25)), vis(LM(landmarks, 27))]);
  const right = average([vis(LM(landmarks, 12)), vis(LM(landmarks, 14)), vis(LM(landmarks, 16)), vis(LM(landmarks, 24)), vis(LM(landmarks, 26)), vis(LM(landmarks, 28))]);
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

const statusForScore = (score: number): LiveMetric["status"] => {
  if (score >= 88) return "excellent";
  if (score >= 72) return "good";
  if (score >= 55) return "warning";
  return "critical";
};

function metric(name: string, score: number, detail: string, value?: number, target?: string): LiveMetric {
  return { name, score, detail, value, target, status: statusForScore(score) };
}

function finalize(
  phase: string,
  metrics: LiveMetric[],
  extras: Partial<Pick<FrameAnalysis, "positives" | "corrections" | "injuryRisks" | "primaryFocus" | "trackedSide" | "targetCue">> = {},
): FrameAnalysis {
  const form = Math.round(average(metrics.slice(0, 2).map((item) => item.score)));
  const rom = Math.round(metrics.find((item) => item.name.includes("Range"))?.score ?? metrics[0]?.score ?? 0);
  const tempo = Math.round(metrics.find((item) => item.name.includes("Tempo"))?.score ?? form);
  const stability = Math.round(metrics.find((item) => item.name.includes("Stability"))?.score ?? average(metrics.map((item) => item.score)));
  const symmetry = Math.round(metrics.find((item) => item.name.includes("Symmetry"))?.score ?? stability);
  const consistency = Math.round(average([form, stability, symmetry]));
  const endurance = Math.round(average([form, rom, stability]));
  const safety = Math.round(Math.min(...metrics.map((item) => item.score)));
  const overall = Math.round(average([form, rom, tempo, stability, symmetry, consistency, endurance, safety]));
  const issues = metrics.filter((item) => item.score < 70).map((item) => item.detail);
  const corrections = extras.corrections ?? issues;
  const positives =
    extras.positives ??
    metrics
      .filter((item) => item.score >= 85)
      .slice(0, 3)
      .map((item) => item.detail);
  const injuryRisks = extras.injuryRisks ?? [];

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
    trackedSide: extras.trackedSide,
    targetCue: extras.targetCue,
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

function analyzeBicepCurl(landmarks: Landmark[]) {
  const { primary, secondary, trackedSide } = chooseCurlSnapshot(landmarks);
  const elbowAngle = primary.elbowAngle;
  const phase = getPhaseForExercise("bicep_curl", landmarks);
  const isTop = phase === "top";
  const isBottom = phase === "bottom";

  const topRangeScore = scoreFromRange(elbowAngle, 40, 70, 18);
  const bottomRangeScore = scoreFromRange(elbowAngle, 150, 175, 18);
  const midRangeScore = scoreFromRange(elbowAngle, 75, 145, 28);
  const rangeScore = isTop ? topRangeScore : isBottom ? bottomRangeScore : midRangeScore;

  const elbowForwardDrift = Math.abs((primary.elbow?.x ?? 0) - (primary.shoulder?.x ?? 0)) * 100;
  const shoulderHike = Math.max(0, ((primary.oppositeShoulder?.y ?? primary.shoulder?.y ?? 0) - (primary.shoulder?.y ?? 0)) * 100);
  const torsoSwing = Math.abs((primary.shoulder?.x ?? 0) - (primary.hip?.x ?? 0)) * 100;
  const wristBend = Math.abs((primary.wrist?.x ?? 0) - (primary.elbow?.x ?? 0)) * 100;
  const symmetryGap = secondary.visibility > 0.45 ? Math.abs(primary.elbowAngle - secondary.elbowAngle) : 0;

  const metrics = [
    metric(
      "Range",
      rangeScore,
      isTop
        ? elbowAngle > 72
          ? "Curl higher and finish with your forearm closer to your shoulder."
          : elbowAngle < 35
            ? "Squeeze at the top, then reverse; do not jam the elbow shut."
            : "Top squeeze looks strong."
        : isBottom
          ? elbowAngle < 150
            ? "Lower all the way down before the next rep."
            : elbowAngle > 177
              ? "Keep a soft elbow at the bottom; avoid snapping into lockout."
              : "Bottom position is controlled and long."
          : "Range is moving smoothly through the mid-zone.",
      Math.round(elbowAngle),
      isTop ? "40-70° top" : isBottom ? "150-175° bottom" : "75-145° mid",
    ),
    metric(
      "Elbow Path",
      scoreFromTarget(elbowForwardDrift, 0, 7),
      elbowForwardDrift > 8
        ? `Keep your ${trackedSide === "both" ? "elbows" : `${primary.side} elbow`} pinned to your ribs; it is drifting forward.`
        : `Good ${trackedSide === "both" ? "elbow path" : `${primary.side} elbow path`}; upper arm is staying still.`,
      Number(elbowForwardDrift.toFixed(1)),
      "0-7 drift",
    ),
    metric(
      "Shoulder Stability",
      scoreFromTarget(shoulderHike, 0, 5),
      shoulderHike > 6 ? `Stop shrugging your ${primary.side} shoulder to finish the curl.` : "Shoulder is staying quiet and out of the rep.",
      Number(shoulderHike.toFixed(1)),
      "0-5 lift",
    ),
    metric(
      "Torso Stability",
      scoreFromTarget(torsoSwing, 0, 8),
      torsoSwing > 9 ? "Brace your abs and stop swinging your torso to start the rep." : "Torso is quiet; the curl is coming from the arm.",
      Number(torsoSwing.toFixed(1)),
      "0-8 sway",
    ),
    metric(
      "Wrist Stack",
      scoreFromTarget(wristBend, 0, 14),
      wristBend > 16 ? `Straighten your ${primary.side} wrist; keep the dumbbell stacked over the forearm.` : "Wrist stays stacked over the forearm.",
      Number(wristBend.toFixed(1)),
      "0-14 bend",
    ),
    metric(
      "Symmetry",
      secondary.visibility > 0.45 ? scoreFromTarget(symmetryGap, 0, 12) : 88,
      secondary.visibility > 0.45
        ? symmetryGap > 13
          ? "One arm is moving ahead of the other; match both elbows and wrists."
          : "Both arms are moving together."
        : "Single-arm tracking is stable.",
      Math.round(symmetryGap),
      secondary.visibility > 0.45 ? "0-12° gap" : "single-arm",
    ),
  ];

  const positives = [
    metrics[1].score >= 85 ? `Your ${trackedSide === "both" ? "elbows are" : `${primary.side} elbow is`} staying tucked well.` : "",
    metrics[3].score >= 85 ? "Your torso is quiet; there is no cheating swing." : "",
    metrics[4].score >= 85 ? `Your ${primary.side} wrist is stacked well under the load.` : "",
    metrics[0].score >= 90 && isTop ? "You are finishing the rep with a clean squeeze at the top." : "",
    metrics[0].score >= 90 && isBottom ? "You are getting full controlled length at the bottom." : "",
  ].filter(Boolean);

  const corrections = metrics
    .filter((item) => item.score < 78)
    .sort((a, b) => a.score - b.score)
    .map((item) => item.detail)
    .slice(0, 4);

  const injuryRisks = [
    elbowAngle < 28 ? "You are crushing the elbow shut at the top. Squeeze and reverse instead of forcing the joint closed." : "",
    elbowAngle > 178 ? "You are locking the elbow hard at the bottom. Keep a soft elbow and control the lowering." : "",
    torsoSwing > 13 ? "Torso swing is starting the lift. That shifts load into the low back instead of the biceps." : "",
    shoulderHike > 7 ? "Shrugging to finish the curl can irritate the front of the shoulder." : "",
    wristBend > 18 ? "A bent wrist under load can irritate the wrist and forearm tendons." : "",
  ].filter(Boolean);

  return finalize(phase, metrics, {
    positives,
    corrections,
    injuryRisks,
    primaryFocus: injuryRisks[0] ?? corrections[0] ?? positives[0],
    trackedSide,
  });
}

function analyzeDanceBasic(landmarks: Landmark[], danceBeat = 0, danceTargetCue?: string) {
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

  const shoulderLevel = Math.abs((leftShoulder?.y ?? 0) - (rightShoulder?.y ?? 0)) * 100;
  const hipLevel = Math.abs((leftHip?.y ?? 0) - (rightHip?.y ?? 0)) * 100;
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
      Math.round(average([scoreFromTarget(armHeightMismatch, 0, 7), scoreFromTarget(averageArmLift, targetArmLift, openCount ? 10 : 8)])),
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
    trackedSide: "both",
    targetCue: cue,
  });
}

export function getPhaseForExercise(exerciseId: ExerciseId, landmarks: Landmark[]) {
  const side = selectSide(landmarks);
  const leftHip = LM(landmarks, side === "left" ? 23 : 24);
  const leftKnee = LM(landmarks, side === "left" ? 25 : 26);
  const leftAnkle = LM(landmarks, side === "left" ? 27 : 28);
  const leftShoulder = LM(landmarks, side === "left" ? 11 : 12);
  const leftElbow = LM(landmarks, side === "left" ? 13 : 14);
  const leftWrist = LM(landmarks, side === "left" ? 15 : 16);
  const rightWrist = LM(landmarks, 16);
  const rightAnkle = LM(landmarks, 28);

  if (exerciseId === "squat" || exerciseId === "lunge") {
    const kneeAngle = angle(leftHip, leftKnee, leftAnkle);
    if (kneeAngle < 110) return "bottom";
    if (kneeAngle < 145) return "lowering";
    return "top";
  }

  if (exerciseId === "pushup") {
    const elbowAngle = angle(leftShoulder, leftElbow, leftWrist);
    if (elbowAngle < 95) return "bottom";
    if (elbowAngle < 145) return "lowering";
    return "top";
  }

  if (exerciseId === "bicep_curl") {
    const elbowAngle = angle(leftShoulder, leftElbow, leftWrist);
    if (elbowAngle < 62) return "top";
    if (elbowAngle < 145) return "curling";
    return "bottom";
  }

  if (exerciseId === "jumping_jack") {
    const wristSpread = distance(leftWrist, rightWrist);
    const ankleSpread = distance(leftAnkle, rightAnkle);
    return wristSpread > 0.45 && ankleSpread > 0.3 ? "open" : "closed";
  }

  return "hold";
}

export function analyzeExercise(exerciseId: ExerciseId, landmarks: Landmark[], danceBeat = 0, danceTargetCue?: string): FrameAnalysis {
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
    const kneeLeft = angle(leftHip, leftKnee, leftAnkle);
    const kneeRight = angle(rightHip, rightKnee, rightAnkle);
    const torso = angle(midpoint(leftShoulder, rightShoulder), midpoint(leftHip, rightHip), midpoint(leftKnee, rightKnee));
    const avgKnee = average([kneeLeft, kneeRight]);
    return finalize(getPhaseForExercise(exerciseId, landmarks), [
      metric("Depth", scoreFromRange(avgKnee, 85, 110, 35), avgKnee > 120 ? "Go deeper into the squat." : "Depth is under control.", Math.round(avgKnee), "85-110°"),
      metric("Torso", scoreFromRange(torso, 55, 90, 30), torso < 50 ? "Keep the chest higher." : "Torso position looks stable.", Math.round(torso), "55-90°"),
      metric("Symmetry", scoreFromTarget(Math.abs(kneeLeft - kneeRight), 0, 18), "Balance both legs evenly.", Math.round(Math.abs(kneeLeft - kneeRight)), "0-18°"),
      metric("Stability", scoreFromTarget(Math.abs((leftShoulder?.y ?? 0) - (rightShoulder?.y ?? 0)) * 100, 0, 5), "Keep shoulders level through the rep."),
    ]);
  }

  if (exerciseId === "pushup") {
    const elbow = angle(leftShoulder, leftElbow, leftWrist);
    const bodyLine = angle(leftShoulder, leftHip, leftAnkle);
    return finalize(getPhaseForExercise(exerciseId, landmarks), [
      metric("Elbow", scoreFromRange(elbow, 75, 100, 30), elbow > 110 ? "Lower until elbows bend deeper." : "Press with controlled elbow angle.", Math.round(elbow), "75-100°"),
      metric("Range", scoreFromRange(bodyLine, 165, 180, 20), bodyLine < 160 ? "Keep hips from sagging." : "Strong body line.", Math.round(bodyLine), "165-180°"),
      metric("Tempo", scoreFromTarget(elbow, 90, 50), "Keep the rep smooth, not rushed."),
      metric("Stability", scoreFromTarget(Math.abs((leftHip?.y ?? 0) - (leftShoulder?.y ?? 0)) * 100, 18, 12), "Brace the core to stabilize."),
    ]);
  }

  if (exerciseId === "lunge") {
    const leftLeg = angle(leftHip, leftKnee, leftAnkle);
    const rightLeg = angle(rightHip, rightKnee, rightAnkle);
    const frontKnee = Math.min(leftLeg, rightLeg);
    const torso = Math.abs((leftShoulder?.x ?? 0) - (leftHip?.x ?? 0)) * 100;
    return finalize(getPhaseForExercise(exerciseId, landmarks), [
      metric("Front Knee", scoreFromRange(frontKnee, 80, 100, 25), frontKnee > 105 ? "Sink deeper into the front leg." : "Front knee angle looks solid.", Math.round(frontKnee), "80-100°"),
      metric("Torso", scoreFromTarget(torso, 0, 10), torso > 12 ? "Stack the torso over the hips." : "Good torso control."),
      metric("Symmetry", scoreFromTarget(Math.abs(leftLeg - rightLeg), 0, 20), "Keep both legs sharing the work."),
      metric("Stability", scoreFromTarget(Math.abs((leftHip?.y ?? 0) - (rightHip?.y ?? 0)) * 100, 0, 6), "Keep the pelvis level."),
    ]);
  }

  if (exerciseId === "bicep_curl") {
    return analyzeBicepCurl(landmarks);
  }

  if (exerciseId === "dance_basic") {
    return analyzeDanceBasic(landmarks, danceBeat, danceTargetCue);
  }

  if (false) {
    const { shoulder, elbow, wrist, hip } = sideLandmarks(landmarks);
    const elbowAngle = angle(shoulder, elbow, wrist);
    const extensionScore = scoreFromRange(elbowAngle, 145, 175, 25);
    const contractionScore = scoreFromRange(elbowAngle, 35, 75, 20);
    const rangeScore = Math.round(average([extensionScore, contractionScore]));
    const elbowDrift = distance(elbow, hip) > 0 && distance(shoulder, hip) > 0
      ? Math.abs(distance(elbow, hip) - distance(shoulder, hip)) * 100
      : Math.abs((elbow?.x ?? 0) - (shoulder?.x ?? 0)) * 100;
    const torsoSwing = Math.abs((shoulder?.x ?? 0) - (hip?.x ?? 0)) * 100;
    const wristControl = Math.abs((wrist?.x ?? 0) - (elbow?.x ?? 0)) * 100;
    return finalize(getPhaseForExercise(exerciseId, landmarks), [
      metric(
        "Range",
        rangeScore,
        elbowAngle > 125
          ? "Reach full contraction at the top of the curl."
          : elbowAngle < 30
            ? "Avoid over-closing your elbow at the top."
            : "Range is controlled through the curl.",
        Math.round(elbowAngle),
        "35-75° top / 145-175° bottom",
      ),
      metric(
        "Elbow Path",
        scoreFromTarget(elbowDrift, 0, 10),
        elbowDrift > 11 ? "Pin your elbow by your ribs; avoid drifting forward." : "Elbow path is stable.",
      ),
      metric(
        "Torso Stability",
        scoreFromTarget(torsoSwing, 0, 9),
        torsoSwing > 10 ? "Stop swinging your torso; slow down and brace." : "Torso is stable.",
      ),
      metric(
        "Wrist Control",
        scoreFromTarget(wristControl, 0, 18),
        wristControl > 20 ? "Keep your wrist neutral and stacked over the forearm." : "Wrist alignment looks good.",
      ),
    ]);
  }

  if (exerciseId === "jumping_jack") {
    const wristSpread = distance(leftWrist, rightWrist) * 100;
    const ankleSpread = distance(leftAnkle, rightAnkle) * 100;
    return finalize(getPhaseForExercise(exerciseId, landmarks), [
      metric("Arm Reach", scoreFromRange(wristSpread, 55, 95, 20), wristSpread < 50 ? "Reach wider overhead." : "Arm line is open.", Math.round(wristSpread), "55-95"),
      metric("Foot Width", scoreFromRange(ankleSpread, 35, 75, 18), ankleSpread < 30 ? "Open the feet more." : "Foot pattern is strong.", Math.round(ankleSpread), "35-75"),
      metric("Tempo", scoreFromTarget(wristSpread - ankleSpread, 20, 25), "Keep arms and feet moving together."),
      metric("Stability", scoreFromTarget(Math.abs((leftShoulder?.y ?? 0) - (rightShoulder?.y ?? 0)) * 100, 0, 8), "Stay tall as you land."),
    ]);
  }

  if (exerciseId === "plank") {
    const bodyLine = angle(leftShoulder, leftHip, leftAnkle);
    const shoulderStack = Math.abs((leftShoulder?.x ?? 0) - (leftElbow?.x ?? 0)) * 100;
    return finalize("hold", [
      metric("Body Line", scoreFromRange(bodyLine, 168, 180, 16), bodyLine < 165 ? "Lift through the core." : "Strong plank line.", Math.round(bodyLine), "168-180°"),
      metric("Shoulder Stack", scoreFromTarget(shoulderStack, 0, 8), shoulderStack > 10 ? "Shift shoulders over elbows." : "Shoulders are stacked."),
      metric("Stability", scoreFromTarget(Math.abs((leftHip?.y ?? 0) - (rightHip?.y ?? 0)) * 100, 0, 6), "Keep the hips level."),
      metric("Tempo", 100, "Controlled isometric hold."),
    ]);
  }

  if (exerciseId === "warrior") {
    const frontKnee = angle(leftHip, leftKnee, leftAnkle);
    const armLine = Math.abs(((leftWrist?.y ?? 0) + (rightWrist?.y ?? 0)) / 2 - ((leftShoulder?.y ?? 0) + (rightShoulder?.y ?? 0)) / 2) * 100;
    return finalize("hold", [
      metric("Front Knee", scoreFromRange(frontKnee, 82, 100, 20), frontKnee > 105 ? "Bend deeper into the front leg." : "Front knee is tracking well.", Math.round(frontKnee), "82-100°"),
      metric("Arm Line", scoreFromTarget(armLine, 0, 7), armLine > 8 ? "Reach both arms parallel to the floor." : "Arms are extended cleanly."),
      metric("Stability", scoreFromTarget(Math.abs((leftHip?.y ?? 0) - (rightHip?.y ?? 0)) * 100, 0, 8), "Square the hips with the pose."),
      metric("Tempo", 100, "Hold steady and breathe."),
    ]);
  }

  return finalize("hold", [
    metric("Control", 80, "Stay centered and keep moving with control."),
    metric("Stability", 80, "Keep the movement organized from shoulders to hips."),
    metric("Rhythm", 80, "Keep the timing even."),
    metric("Safety", 80, "No major issues detected."),
  ]);
}
