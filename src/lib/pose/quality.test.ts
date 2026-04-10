import { describe, expect, it } from "vitest";
import { evaluateFrameQuality } from "@/lib/pose/quality";
import type { Landmark } from "@/lib/pose/types";

function createLandmarks() {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 })) as Landmark[];
}

function setFrontBody(landmarks: Landmark[]) {
  landmarks[11] = { x: 0.4, y: 0.24, z: -0.02, visibility: 0.99 };
  landmarks[12] = { x: 0.6, y: 0.24, z: 0.02, visibility: 0.99 };
  landmarks[23] = { x: 0.43, y: 0.5, z: -0.01, visibility: 0.99 };
  landmarks[24] = { x: 0.57, y: 0.5, z: 0.01, visibility: 0.99 };
  landmarks[25] = { x: 0.43, y: 0.68, visibility: 0.99 };
  landmarks[26] = { x: 0.57, y: 0.68, visibility: 0.99 };
  landmarks[27] = { x: 0.42, y: 0.9, visibility: 0.99 };
  landmarks[28] = { x: 0.58, y: 0.9, visibility: 0.99 };
  landmarks[15] = { x: 0.32, y: 0.38, visibility: 0.99 };
  landmarks[16] = { x: 0.68, y: 0.38, visibility: 0.99 };
}

describe("frame quality evaluation", () => {
  it("marks a clean front-facing squat setup as ready", () => {
    const landmarks = createLandmarks();
    setFrontBody(landmarks);

    const result = evaluateFrameQuality({
      exerciseId: "squat",
      landmarks,
      worldLandmarks: landmarks,
      fps: 24,
      brightness: 82,
      motion: 2,
    });

    expect(result.ready).toBe(true);
    expect(result.frameQuality).toBe("ready");
    expect(result.view).toBe("front");
  });

  it("blocks push-up coaching when the camera angle is front-facing instead of side-on", () => {
    const landmarks = createLandmarks();
    setFrontBody(landmarks);

    const result = evaluateFrameQuality({
      exerciseId: "pushup",
      landmarks,
      worldLandmarks: landmarks,
      fps: 24,
      brightness: 82,
      motion: 2,
    });

    expect(result.ready).toBe(false);
    expect(result.frameQuality).toBe("wrong_angle");
    expect(result.pauseTracking).toBe(true);
  });

  it("pauses tracking under low light even when body visibility is good", () => {
    const landmarks = createLandmarks();
    setFrontBody(landmarks);

    const result = evaluateFrameQuality({
      exerciseId: "squat",
      landmarks,
      worldLandmarks: landmarks,
      fps: 24,
      brightness: 20,
      motion: 1,
    });

    expect(result.ready).toBe(false);
    expect(result.frameQuality).toBe("low_light");
    expect(result.message).toMatch(/lighting/i);
  });
});
