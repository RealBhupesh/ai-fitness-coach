import { angle, average, distance, midpoint } from "@/lib/pose/math";
import type { ExerciseId, Landmark, SafetyResult } from "@/lib/pose/types";

const L = (landmarks: Landmark[], index: number) => landmarks[index];

export function evaluateSafety(exerciseId: ExerciseId, landmarks: Landmark[], injuries: string[] = []): SafetyResult {
  const messages: string[] = [];
  let blocked = false;
  let severity: SafetyResult["severity"] = "info";

  const leftShoulder = L(landmarks, 11);
  const rightShoulder = L(landmarks, 12);
  const leftHip = L(landmarks, 23);
  const rightHip = L(landmarks, 24);
  const leftKnee = L(landmarks, 25);
  const rightKnee = L(landmarks, 26);
  const leftAnkle = L(landmarks, 27);
  const rightAnkle = L(landmarks, 28);
  const leftElbow = L(landmarks, 13);
  const rightElbow = L(landmarks, 14);
  const leftWrist = L(landmarks, 15);
  const rightWrist = L(landmarks, 16);

  if (injuries.some((item) => /knee/i.test(item)) && ["squat", "lunge", "jumping_jack"].includes(exerciseId)) {
    blocked = true;
    severity = "critical";
    messages.push("Knee-sensitive profile: switch to a lower-impact exercise.");
  }

  if (injuries.some((item) => /shoulder/i.test(item)) && ["pushup", "bicep_curl", "dance_basic"].includes(exerciseId)) {
    severity = blocked ? "critical" : "warning";
    messages.push("Shoulder-sensitive profile: keep movement pain-free and reduce range if needed.");
  }

  if (exerciseId === "squat" && leftShoulder && rightShoulder && leftHip && rightHip && leftKnee && rightKnee) {
    const torsoCenter = midpoint(leftShoulder, rightShoulder);
    const hipCenter = midpoint(leftHip, rightHip);
    const kneeCenter = midpoint(leftKnee, rightKnee);
    const torsoAngle = angle(torsoCenter, hipCenter, kneeCenter);
    if (torsoAngle < 45) {
      severity = "critical";
      messages.push("Torso leaning too far forward. Stop and reset before the next rep.");
    }
  }

  if (exerciseId === "pushup" && leftShoulder && leftHip && leftAnkle) {
    const line = angle(leftShoulder, leftHip, leftAnkle);
    if (line < 150) {
      severity = "warning";
      messages.push("Hips are dropping. Brace your core before continuing.");
    }
  }

  if (exerciseId === "lunge" && leftHip && leftKnee && leftAnkle) {
    const kneeAngle = angle(leftHip, leftKnee, leftAnkle);
    if (kneeAngle < 70) {
      severity = "warning";
      messages.push("Front knee is collapsing too deep. Shorten the stance.");
    }
  }

  if (exerciseId === "bicep_curl" && leftShoulder && leftElbow && leftWrist) {
    const rightShoulderLocal = rightShoulder;
    const leftElbowAngle = angle(leftShoulder, leftElbow, leftWrist);
    const rightElbowAngle = angle(rightShoulderLocal, rightElbow, rightWrist);
    const trackedSide =
      average([leftElbow?.visibility ?? 0, leftWrist?.visibility ?? 0]) >= average([rightElbow?.visibility ?? 0, rightWrist?.visibility ?? 0])
        ? "left"
        : "right";
    const shoulder = trackedSide === "left" ? leftShoulder : rightShoulderLocal;
    const elbow = trackedSide === "left" ? leftElbow : rightElbow;
    const wrist = trackedSide === "left" ? leftWrist : rightWrist;
    const hip = trackedSide === "left" ? leftHip : rightHip;
    const oppositeShoulder = trackedSide === "left" ? rightShoulderLocal : leftShoulder;
    const elbowAngle = trackedSide === "left" ? leftElbowAngle : rightElbowAngle;
    const torsoSwing = Math.abs((shoulder?.x ?? 0) - (hip?.x ?? 0)) * 100;
    const shoulderHike = Math.max(0, ((oppositeShoulder?.y ?? shoulder?.y ?? 0) - (shoulder?.y ?? 0)) * 100);
    const wristBend = Math.abs((wrist?.x ?? 0) - (elbow?.x ?? 0)) * 100;

    if (elbowAngle < 24) {
      severity = "warning";
      messages.push("Do not crush the elbow shut at the top. Squeeze, then reverse under control.");
    }
    if (elbowAngle > 178) {
      severity = "warning";
      messages.push("Do not snap into lockout at the bottom. Keep a soft elbow.");
    }
    if (torsoSwing > 15) {
      severity = "warning";
      messages.push("Torso swing is taking over the curl. Reduce momentum before the next rep.");
    }
    if (shoulderHike > 8) {
      severity = "warning";
      messages.push("Your shoulder is shrugging to finish the curl. Keep the shoulder down and the elbow pinned.");
    }
    if (wristBend > 18) {
      severity = "warning";
      messages.push("Your wrist is folding under the load. Stack the wrist over the forearm.");
    }
  }

  if (exerciseId === "jumping_jack" && leftAnkle && rightAnkle) {
    const stance = distance(leftAnkle, rightAnkle);
    if (stance < 0.08) {
      messages.push("Land softly and keep knees unlocked.");
    }
  }

  if (exerciseId === "dance_basic" && leftShoulder && rightShoulder && leftHip && rightHip && leftKnee && rightKnee && leftAnkle && rightAnkle) {
    const shoulderCenter = midpoint(leftShoulder, rightShoulder);
    const hipCenter = midpoint(leftHip, rightHip);
    const torsoLean = Math.abs((shoulderCenter?.x ?? 0) - (hipCenter?.x ?? 0)) * 100;
    const shoulderTilt = Math.abs((leftShoulder?.y ?? 0) - (rightShoulder?.y ?? 0)) * 100;
    const hipTilt = Math.abs((leftHip?.y ?? 0) - (rightHip?.y ?? 0)) * 100;
    const leftKneeAngle = angle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = angle(rightHip, rightKnee, rightAnkle);
    const averageKneeAngle = average([leftKneeAngle, rightKneeAngle]);

    if (averageKneeAngle > 175) {
      severity = "warning";
      messages.push("Your knees are locking on the beat. Keep them soft so the joints do not take the impact.");
    }
    if (torsoLean > 14) {
      severity = "warning";
      messages.push("Your torso is leaning off-center. Stack ribs over hips before the next phrase.");
    }
    if (shoulderTilt > 11) {
      severity = "warning";
      messages.push("One shoulder is hiking higher than the other. Relax the neck and level the shoulders.");
    }
    if (hipTilt > 11) {
      severity = "warning";
      messages.push("Your hips are tilting instead of shifting smoothly. Re-center before the next count.");
    }
  }

  const shoulderLevel = leftShoulder && rightShoulder ? Math.abs(leftShoulder.y - rightShoulder.y) : 0;
  const hipLevel = leftHip && rightHip ? Math.abs(leftHip.y - rightHip.y) : 0;
  if (average([shoulderLevel, hipLevel]) > 0.08 && severity !== "critical") {
    severity = "warning";
    messages.push("You are rotating out of alignment. Reset your stance.");
  }

  return {
    blocked,
    severity,
    messages: messages.length ? messages : ["No major safety concerns detected."],
  };
}
