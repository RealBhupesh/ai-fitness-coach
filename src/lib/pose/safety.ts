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
  const leftWrist = L(landmarks, 15);

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
    const elbowAngle = angle(leftShoulder, leftElbow, leftWrist);
    if (elbowAngle < 20) {
      severity = "warning";
      messages.push("Avoid snapping the elbow closed. Slow the curl down.");
    }
  }

  if (exerciseId === "jumping_jack" && leftAnkle && rightAnkle) {
    const stance = distance(leftAnkle, rightAnkle);
    if (stance < 0.08) {
      messages.push("Land softly and keep knees unlocked.");
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
