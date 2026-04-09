import { describe, expect, it } from "vitest";
import { angle, average, clamp, scoreFromRange, scoreFromTarget } from "@/lib/pose/math";

describe("pose math helpers", () => {
  it("clamps values to the expected range", () => {
    expect(clamp(120, 0, 100)).toBe(100);
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(55, 0, 100)).toBe(55);
  });

  it("scores values against a target and range", () => {
    expect(scoreFromTarget(10, 10, 5)).toBe(100);
    expect(scoreFromRange(90, 80, 100, 10)).toBe(100);
    expect(scoreFromRange(140, 80, 100, 10)).toBeLessThan(50);
  });

  it("computes average and angles for pose points", () => {
    expect(average([50, 60, 70])).toBe(60);
    expect(
      Math.round(
        angle(
          { x: 0, y: 1 },
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ),
      ),
    ).toBe(90);
  });
});
