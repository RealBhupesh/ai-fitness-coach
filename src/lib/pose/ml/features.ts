import { angle, average } from "@/lib/pose/math";
import type { Landmark } from "@/lib/pose/types";
import type { MlExerciseId } from "@/lib/pose/ml/types";
export const FEATURE_VERSION = "temporal-v2";
export const FEATURE_NAMES = ["angleMean", "angleMin", "angleMax", "angleRange", "angleVelocity", "torsoTilt", "elbowDrift", "kneeWidthRatio", "hipShift", "shoulderTilt", "visibility", "duration"] as const;
export type TimedLandmarks = { timestampMs: number; landmarks: Landmark[] };
export function temporalFeatures(frames: TimedLandmarks[], exercise: MlExerciseId): number[] {
  if (frames.length < 2) throw new Error("INSUFFICIENT_WINDOW");
  const sorted = [...frames].sort((a,b) => a.timestampMs - b.timestampMs);
  const duration = (sorted.at(-1)!.timestampMs - sorted[0].timestampMs) / 1000;
  if (duration <= 0 || duration > 2.1) throw new Error("INVALID_WINDOW_DURATION");
  const values = sorted.map(({ landmarks: p }) => {
    const required = [11,12,13,14,15,16,23,24,25,26,27,28];
    if (required.some(i => !p[i] || !Number.isFinite(p[i].x) || !Number.isFinite(p[i].y))) throw new Error("INVALID_LANDMARKS");
    const scale = Math.max(Math.hypot(p[11].x-p[23].x,p[11].y-p[23].y),Math.hypot(p[12].x-p[24].x,p[12].y-p[24].y),0.001);
    const a = exercise === "squat" ? average([angle(p[23],p[25],p[27]),angle(p[24],p[26],p[28])])/180 : average([angle(p[11],p[13],p[15]),angle(p[12],p[14],p[16])])/180;
    return [a, Math.abs(average([p[11].x,p[12].x])-average([p[23].x,p[24].x]))/scale, average([Math.abs(p[13].x-p[11].x),Math.abs(p[14].x-p[12].x)])/scale, Math.abs(p[25].x-p[26].x)/Math.max(Math.abs(p[27].x-p[28].x),0.05), Math.abs(average([p[23].x,p[24].x])-average([p[27].x,p[28].x]))/scale, Math.abs(p[11].y-p[12].y)/scale, average(required.map(i=>p[i].visibility ?? 0))];
  });
  const angles = values.map(v=>v[0]);
  const velocity = average(angles.slice(1).map((a,i)=>Math.abs(a-angles[i])/Math.max((sorted[i+1].timestampMs-sorted[i].timestampMs)/1000,0.01)));
  return [average(angles),Math.min(...angles),Math.max(...angles),Math.max(...angles)-Math.min(...angles),velocity,...[1,2,3,4,5,6].map(i=>average(values.map(v=>v[i]))),duration].map(v=>Number(v.toFixed(8)));
}
