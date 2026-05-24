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

function shiftRequiredPoints(landmarks: Landmark[], deltaX: number) {
  [11, 12, 15, 16, 23, 24, 25, 26, 27, 28].forEach((index) => {
    landmarks[index] = { ...landmarks[index], x: (landmarks[index]?.x ?? 0.5) + deltaX };
  });
}

function widenRequiredPoints(landmarks: Landmark[]) {
  landmarks[11] = { ...landmarks[11], x: 0.08 };
  landmarks[12] = { ...landmarks[12], x: 0.92 };
  landmarks[15] = { ...landmarks[15], x: 0.02 };
  landmarks[16] = { ...landmarks[16], x: 0.98 };
  landmarks[23] = { ...landmarks[23], x: 0.1 };
  landmarks[24] = { ...landmarks[24], x: 0.9 };
  landmarks[27] = { ...landmarks[27], x: 0.08 };
  landmarks[28] = { ...landmarks[28], x: 0.92 };
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

  it("explains off-center setup with actionable camera framing guidance", () => {
    const landmarks = createLandmarks();
    setFrontBody(landmarks);
    shiftRequiredPoints(landmarks, -0.28);

    const result = evaluateFrameQuality({
      exerciseId: "squat",
      landmarks,
      worldLandmarks: landmarks,
      fps: 24,
      brightness: 82,
      motion: 1,
    });

    expect(result.ready).toBe(false);
    expect(result.frameQuality).toBe("partial_body");
    expect(result.message).toMatch(/center yourself/i);
  });

  it("explains too-close setup before starting live coaching", () => {
    const landmarks = createLandmarks();
    setFrontBody(landmarks);
    widenRequiredPoints(landmarks);

    const result = evaluateFrameQuality({
      exerciseId: "squat",
      landmarks,
      worldLandmarks: landmarks,
      fps: 24,
      brightness: 82,
      motion: 1,
    });

    expect(result.ready).toBe(false);
    expect(result.frameQuality).toBe("partial_body");
    expect(result.message).toMatch(/step back/i);
  });

  it("pauses tracking under low FPS with a concrete recovery message", () => {
    const landmarks = createLandmarks();
    setFrontBody(landmarks);

    const result = evaluateFrameQuality({
      exerciseId: "squat",
      landmarks,
      worldLandmarks: landmarks,
      fps: 10,
      brightness: 82,
      motion: 1,
    });

    expect(result.ready).toBe(false);
    expect(result.frameQuality).toBe("low_fps");
    expect(result.message).toMatch(/lower camera quality|close other apps/i);
  });
});
