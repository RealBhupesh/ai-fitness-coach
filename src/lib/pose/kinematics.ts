import { angle, average, clamp, distance, midpoint } from "@/lib/pose/math";
import type { Landmark, SessionFramePoint } from "@/lib/pose/types";

export function jointAngle(a?: Landmark | null, b?: Landmark | null, c?: Landmark | null) {
  return angle(a, b, c);
}

export function segmentOrientation(start?: Landmark | null, end?: Landmark | null) {
  if (!start || !end) return 0;
  return (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
}

export function bilateralSymmetry(left: number, right: number) {
  return Math.abs(left - right);
}

export function centerOfMassProxy(landmarks: Landmark[]) {
  const shoulders = midpoint(landmarks[11], landmarks[12]);
  const hips = midpoint(landmarks[23], landmarks[24]);
  const knees = midpoint(landmarks[25], landmarks[26]);

  return midpoint(midpoint(shoulders, hips), knees);
}

export function trunkLean(landmarks: Landmark[]) {
  const shoulders = midpoint(landmarks[11], landmarks[12]);
  const hips = midpoint(landmarks[23], landmarks[24]);
  return Math.abs((shoulders?.x ?? 0) - (hips?.x ?? 0)) * 100;
}

export function trunkStackAngle(landmarks: Landmark[]) {
  const shoulders = midpoint(landmarks[11], landmarks[12]);
  const hips = midpoint(landmarks[23], landmarks[24]);
  const knees = midpoint(landmarks[25], landmarks[26]);
  return jointAngle(shoulders, hips, knees);
}

export function shoulderTilt(landmarks: Landmark[]) {
  const left = landmarks[11];
  const right = landmarks[12];
  const span = Math.max(distance(left, right), 0.08);
  return (Math.abs((left?.y ?? 0) - (right?.y ?? 0)) / span) * 100;
}

export function hipTilt(landmarks: Landmark[]) {
  const left = landmarks[23];
  const right = landmarks[24];
  const span = Math.max(distance(left, right), 0.08);
  return (Math.abs((left?.y ?? 0) - (right?.y ?? 0)) / span) * 100;
}

export function kneeSymmetry(landmarks: Landmark[]) {
  const left = jointAngle(landmarks[23], landmarks[25], landmarks[27]);
  const right = jointAngle(landmarks[24], landmarks[26], landmarks[28]);
  return {
    left,
    right,
    gap: bilateralSymmetry(left, right),
  };
}

export function tempoDriftFromFrames(frames: SessionFramePoint[]) {
  if (frames.length < 6) return 0;
  const chunk = Math.max(1, Math.floor(frames.length / 3));
  const first = average(frames.slice(0, chunk).map((item) => item.tempo));
  const last = average(frames.slice(-chunk).map((item) => item.tempo));
  return Math.round(last - first);
}

export function fatigueDropFromFrames(frames: SessionFramePoint[]) {
  if (frames.length < 6) return 0;
  const chunk = Math.max(1, Math.floor(frames.length / 3));
  const first = average(frames.slice(0, chunk).map((item) => item.overall));
  const last = average(frames.slice(-chunk).map((item) => item.overall));
  return Math.round(first - last);
}

export function consistencyAverage(frames: SessionFramePoint[]) {
  if (!frames.length) return 0;
  const overall = average(frames.map((item) => item.overall));
  const deviation = average(frames.map((item) => Math.abs(item.overall - overall)));
  return clamp(Math.round(100 - deviation * 2), 0, 100);
}
