import type { Landmark } from "@/lib/pose/types";

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

export function distance(a?: Landmark | null, b?: Landmark | null) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a?: Landmark | null, b?: Landmark | null): Landmark | null {
  if (!a || !b) return null;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

export function angle(a?: Landmark | null, b?: Landmark | null, c?: Landmark | null) {
  if (!a || !b || !c) return 0;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magnitude = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!magnitude) return 0;
  const cosine = clamp(dot / magnitude, -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
}

/** Convert width/height-normalized image points into isotropic height units. */
export function toAnalysisLandmarks(points: Landmark[], aspectRatio: number): Landmark[] {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) throw new Error("Invalid image aspect ratio");
  return points.map(point => ({ ...point, x: point.x * aspectRatio, z: (point.z ?? 0) * aspectRatio }));
}

export function scoreFromTarget(value: number, target: number, tolerance: number) {
  const deviation = Math.abs(value - target);
  return clamp(Math.round(100 - (deviation / Math.max(tolerance, 1)) * 100), 0, 100);
}

export function scoreFromRange(value: number, min: number, max: number, tolerance = 15) {
  if (value >= min && value <= max) return 100;
  if (value < min) return scoreFromTarget(value, min, tolerance);
  return scoreFromTarget(value, max, tolerance);
}
