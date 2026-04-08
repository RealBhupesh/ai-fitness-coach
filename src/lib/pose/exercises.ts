import { angle, average, clamp, distance, midpoint, scoreFromRange, scoreFromTarget } from "@/lib/pose/math";
import type { ExerciseId, FrameAnalysis, Landmark, LiveMetric, PoseExercise } from "@/lib/pose/types";

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
    tips: ["Tall spine", "Level shoulders", "Stay on the beat"],
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

function sideLandmarks(landmarks: Landmark[]) {
  const side = selectSide(landmarks);
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

function finalize(phase: string, metrics: LiveMetric[]): FrameAnalysis {
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
  };
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

export function analyzeExercise(exerciseId: ExerciseId, landmarks: Landmark[], danceBeat = 0): FrameAnalysis {
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

  const shoulderLevel = Math.abs((leftShoulder?.y ?? 0) - (rightShoulder?.y ?? 0)) * 100;
  const hipLevel = Math.abs((leftHip?.y ?? 0) - (rightHip?.y ?? 0)) * 100;
  const wristHeight = average([(leftWrist?.y ?? 0), (rightWrist?.y ?? 0)]);
  const beatTarget = danceBeat % 2 === 0 ? 0.32 : 0.55;
  return {
    ...finalize("dance", [
      metric("Shoulder Level", scoreFromTarget(shoulderLevel, 0, 5), shoulderLevel > 6 ? "Level the shoulders for a cleaner frame." : "Shoulder line is clean."),
      metric("Hip Level", scoreFromTarget(hipLevel, 0, 6), hipLevel > 7 ? "Square the hips forward." : "Hip line is stable."),
      metric("Rhythm", scoreFromTarget(wristHeight, beatTarget, 0.14), "Match the cue timing with your arm line.", Number(wristHeight.toFixed(2)), "beat cue"),
      metric("Stability", scoreFromTarget(Math.abs((leftWrist?.x ?? 0) - (rightWrist?.x ?? 0)) * 100, 55, 20), "Keep the dance frame open."),
    ]),
    targetCue: danceBeat % 2 === 0 ? "Open frame on the beat" : "Drop into the next groove",
  };
}
