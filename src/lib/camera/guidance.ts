import type { ConfidenceStatus } from "@/lib/pose/types";

export function buildUnreliableCameraGuidance(
  confidence: Pick<ConfidenceStatus, "frameQuality" | "message" | "brightness" | "centered" | "tooClose" | "tooFar" | "avgVisibility">,
) {
  if (confidence.frameQuality === "ready" && confidence.avgVisibility >= 0.55) return null;
  const fix = !confidence.centered
    ? "Move your full body into the center of the frame."
    : confidence.tooClose
      ? "Step back until your full body is visible."
      : confidence.tooFar
        ? "Step closer so joints are easier to track."
        : confidence.brightness < 35
          ? "Add light in front of you and avoid backlighting."
          : "Hold still for a moment so the tracker can lock on.";
  return {
    title: "Tracking paused",
    message: `Movement advice is paused because tracking is unreliable. ${fix}`,
    reason: confidence.message,
  };
}
