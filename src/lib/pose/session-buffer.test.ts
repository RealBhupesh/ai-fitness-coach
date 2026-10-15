import { describe, expect, it } from "vitest";
import { workoutSessionInputSchema } from "@/lib/validation/schemas";
import { createSessionAnalysisBuffer, finalizeSessionAnalysis, recordCue, recordFrame, recordTelemetry } from "@/lib/pose/session-buffer";
import type { FeedbackCue } from "@/lib/feedback/state";
import type { FrameAnalysis, TrackingFrame } from "@/lib/pose/types";

function makeTrackingFrame(timestampMs: number, overall = 82): TrackingFrame {
  return {
    timestampMs,
    frameIndex: Math.floor(timestampMs / 100),
    fps: 24,
    rawLandmarks: [],
    smoothedLandmarks: [],
    worldLandmarks: [],
    avgVisibility: 0.9,
    posePresence: 0.9,
    trackingConfidence: 0.88,
    frameQuality: "ready",
    frameQualityMessage: "Ready",
    view: "front",
    viewMessage: "Valid",
    brightness: 80,
    motion: 2,
    reliability: { fullBody: true },
    dominantSide: "both",
  };
}

function makeAnalysis(overall: number, phase: string, issue?: string): FrameAnalysis {
  return {
    form: overall,
    rom: overall - 2,
    tempo: overall - 4,
    stability: overall - 1,
    symmetry: overall - 3,
    consistency: overall - 2,
    endurance: overall - 5,
    safety: overall,
    overall,
    phase,
    metrics: [],
    issues: issue ? [issue] : [],
    positives: [],
    corrections: issue ? [issue] : [],
    injuryRisks: [],
    primaryIssueKey: issue,
  };
}

describe("session analysis buffer", () => {
  it("records phase history, recurring issues, and quality stats", () => {
    const buffer = createSessionAnalysisBuffer();
    const cue: FeedbackCue = {
      signature: "warning:squat:body:knees_caving",
      message: "Drive your knees out.",
      severity: "warning",
      source: "rule_engine",
    };

    recordFrame(buffer, makeTrackingFrame(100, 88), makeAnalysis(88, "top"));
    recordCue(buffer, cue, 100);
    recordFrame(buffer, makeTrackingFrame(200, 80), makeAnalysis(80, "descent", cue.message));
    recordFrame(buffer, { ...makeTrackingFrame(300, 76), frameQuality: "low_light" }, makeAnalysis(76, "bottom", cue.message));
    recordTelemetry(buffer, { timestampMs: 300, type: "low_confidence_pause", message: "Lighting dipped." });

    const result = finalizeSessionAnalysis(buffer);

    expect(result.phaseHistory.map((item) => item.phase)).toEqual(["top", "descent", "bottom"]);
    expect(result.frameQualityStats.ready).toBe(2);
    expect(result.frameQualityStats.low_light).toBe(1);
    expect(result.telemetry).toHaveLength(1);
    expect(result.postSet.recurringIssues[0]).toBe("Drive your knees out.");
    expect(result.postSet.stabilityAverage).toBeGreaterThan(0);
  });
  it("serializes fractional camera timestamps as valid session evidence", () => {
    const buffer=createSessionAnalysisBuffer();
    recordFrame(buffer,makeTrackingFrame(1234.56),makeAnalysis(80,"top"));
    recordTelemetry(buffer,{timestampMs:1234.56,type:"calibration_ready",message:"Tracking recovered."});
    const result=workoutSessionInputSchema.safeParse({clientSessionId:crypto.randomUUID(),type:"strength",sessionAnalysis:finalizeSessionAnalysis(buffer)});
    expect(result.success).toBe(true);
    expect(buffer.phaseHistory[0].timestampMs).toBe(1235);
    expect(buffer.telemetry[0].timestampMs).toBe(1235);
    recordFrame(buffer,makeTrackingFrame(5000.3),makeAnalysis(80,"descent"),25.2);
    expect(buffer.phaseHistory[1].timestampMs).toBe(25);
  });

});
