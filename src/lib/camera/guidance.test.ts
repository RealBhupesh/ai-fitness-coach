import { describe, expect, it } from "vitest";
import { buildUnreliableCameraGuidance } from "@/lib/camera/guidance";

describe("camera guidance", () => {
  it("suppresses movement advice when camera tracking is unreliable", () => {
    const guidance = buildUnreliableCameraGuidance({
      frameQuality: "low_light",
      message: "Lighting is too low.",
      brightness: 18,
      centered: true,
      tooClose: false,
      tooFar: false,
      avgVisibility: 0.42,
    });

    expect(guidance?.title).toBe("Tracking paused");
    expect(guidance?.message).toMatch(/lighting|movement advice is paused/i);
  });

  it("returns no pause guidance when tracking is ready", () => {
    expect(
      buildUnreliableCameraGuidance({
        frameQuality: "ready",
        message: "Ready.",
        brightness: 80,
        centered: true,
        tooClose: false,
        tooFar: false,
        avgVisibility: 0.9,
      }),
    ).toBeNull();
  });
});
