import { describe, expect, it } from "vitest";
import { selectFeedbackCue } from "@/lib/feedback/cues";
import type { FrameAnalysis } from "@/lib/pose/types";

const safetyOk = {
  blocked: false,
  severity: "info" as const,
  messages: [],
};

function frame(overrides: Partial<FrameAnalysis> = {}): FrameAnalysis {
  return {
    form: 72,
    rom: 72,
    tempo: 80,
    stability: 70,
    symmetry: 90,
    consistency: 76,
    endurance: 74,
    safety: 70,
    overall: 76,
    phase: "bottom",
    metrics: [],
    issues: [],
    positives: [],
    corrections: [],
    injuryRisks: [],
    trackedSide: "both",
    ...overrides,
  };
}

describe("feedback cue selection", () => {
  it("prioritizes high-risk squat knee tracking and carries metric evidence", () => {
    const cue = selectFeedbackCue(
      "squat",
      frame({
        metrics: [
          { name: "Depth", score: 62, detail: "Sit deeper.", status: "warning", reliable: true, value: 120, target: "86-108 degrees" },
          {
            name: "Knee Tracking",
            score: 70,
            detail: "Drive both knees over the middle toes.",
            status: "warning",
            reliable: true,
            value: 18,
            target: "0-10 inward collapse",
          },
        ],
      }),
      safetyOk,
      0.91,
    );

    expect(cue.message).toMatch(/knees/i);
    expect(cue.metricName).toBe("Knee Tracking");
    expect(cue.phase).toBe("bottom");
    expect(cue.confidence).toBe(0.91);
  });

  it("does not choose unreliable low-scoring metrics", () => {
    const cue = selectFeedbackCue(
      "bicep_curl",
      frame({
        phase: "top",
        trackedSide: "left",
        metrics: [
          { name: "Wrist Stack", score: 78, detail: "Wrist stack is not reliable.", status: "good", reliable: false },
          { name: "Elbow Path", score: 92, detail: "Good left elbow path.", status: "excellent", reliable: true },
        ],
        positives: ["Good left elbow path."],
      }),
      safetyOk,
      0.88,
    );

    expect(cue.severity).toBe("info");
    expect(cue.metricName).toBe("Elbow Path");
    expect(cue.message).toMatch(/elbow/i);
  });

  it("lets hard bicep curl mode flag smaller technique misses", () => {
    const hardCue = selectFeedbackCue(
      "bicep_curl",
      frame({
        phase: "curling",
        trackedSide: "left",
        metrics: [{ name: "Shoulder Stability", score: 82, detail: "Stop shrugging your left shoulder.", status: "good", reliable: true }],
      }),
      safetyOk,
      0.9,
      { coachLevel: "hard" },
    );
    const easyCue = selectFeedbackCue(
      "bicep_curl",
      frame({
        phase: "curling",
        trackedSide: "left",
        metrics: [
          { name: "Shoulder Stability", score: 82, detail: "Stop shrugging your left shoulder.", status: "good", reliable: true },
          { name: "Elbow Path", score: 92, detail: "Good left elbow path.", status: "excellent", reliable: true },
        ],
        positives: ["Good left elbow path."],
      }),
      safetyOk,
      0.9,
      { coachLevel: "easy" },
    );

    expect(hardCue.severity).toBe("warning");
    expect(hardCue.metricName).toBe("Shoulder Stability");
    expect(easyCue.severity).toBe("info");
  });
});
