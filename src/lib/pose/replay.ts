import { advanceFeedbackState, buildIssueSignature, createFeedbackState, type FeedbackCue } from "@/lib/feedback/state";
import { evaluateSafety } from "@/lib/pose/safety";
import { buildTrackingFrame, evaluateConfidence } from "@/lib/pose/confidence";
import { analyzeExercise, advancePhaseTracker, createPhaseTrackerState } from "@/lib/pose/exercises";
import { createSessionAnalysisBuffer, finalizeSessionAnalysis, recordCue, recordFrame, recordTelemetry } from "@/lib/pose/session-buffer";
import type { ExerciseId, FrameAnalysis, Landmark, SessionAnalysisBuffer, TrackingFrame } from "@/lib/pose/types";

export type ReplayFixtureFrame = {
  timestampMs: number;
  landmarks: Landmark[];
  worldLandmarks?: Landmark[];
  fps?: number;
  brightness?: number;
  motion?: number;
};

export type ReplayFixture = {
  exerciseId: ExerciseId;
  frames: ReplayFixtureFrame[];
  injuries?: string[];
};

export type ReplayResult = {
  repCount: number;
  pauseFrames: number;
  emittedCues: Array<{
    timestampMs: number;
    signature: string;
    message: string;
    severity: FeedbackCue["severity"];
  }>;
  finalAnalysis: FrameAnalysis | null;
  sessionAnalysis: SessionAnalysisBuffer;
};

function selectReplayCue(exerciseId: ExerciseId, frame: FrameAnalysis, safety: ReturnType<typeof evaluateSafety>): FeedbackCue {
  const build = (message: string, severity: FeedbackCue["severity"], source: FeedbackCue["source"], side?: string, secondaryNote?: string): FeedbackCue => ({
    message,
    severity,
    source,
    secondaryNote,
    signature: buildIssueSignature({ severity, message, side, channel: exerciseId }),
  });

  if (safety.blocked || safety.severity === "critical") {
    return build(safety.messages[0], "critical", "rule_engine", "body", frame.secondaryNote);
  }
  if (frame.injuryRisks.length) {
    return build(frame.injuryRisks[0], "warning", "rule_engine", frame.trackedSide, frame.secondaryNote);
  }
  if (safety.severity === "warning" && safety.messages.length) {
    return build(safety.messages[0], "warning", "rule_engine", frame.trackedSide, frame.secondaryNote);
  }
  if (frame.corrections.length) {
    return build(frame.corrections[0], "warning", "rule_engine", frame.trackedSide, frame.secondaryNote);
  }
  if (frame.positives.length) {
    return build(frame.positives[0], "info", "system", frame.trackedSide, frame.secondaryNote);
  }
  return build(frame.primaryFocus || frame.targetCue || "Strong rep. Keep the rhythm.", "info", "system", frame.trackedSide, frame.secondaryNote);
}

export function runReplayFixture(fixture: ReplayFixture): ReplayResult {
  let previousSmoothed: Landmark[] | null = null;
  let trackerState = createPhaseTrackerState(fixture.frames[0]?.timestampMs ?? 0);
  let feedbackState = createFeedbackState();
  const sessionBuffer = createSessionAnalysisBuffer();
  const emittedCues: ReplayResult["emittedCues"] = [];
  let repCount = 0;
  let pauseFrames = 0;
  let finalAnalysis: FrameAnalysis | null = null;

  fixture.frames.forEach((frame, index) => {
    const trackingFrame: TrackingFrame = buildTrackingFrame({
      exerciseId: fixture.exerciseId,
      rawLandmarks: frame.landmarks,
      worldLandmarks: frame.worldLandmarks,
      previousSmoothed,
      timestampMs: frame.timestampMs,
      frameIndex: index,
      fps: frame.fps ?? 24,
      brightness: frame.brightness ?? 85,
      motion: frame.motion,
    });
    previousSmoothed = trackingFrame.smoothedLandmarks;

    const confidence = evaluateConfidence(trackingFrame, fixture.exerciseId);
    const shouldPause = confidence.pauseTracking || !confidence.ready || confidence.avgVisibility < 0.55;
    if (shouldPause) {
      pauseFrames += 1;
      recordTelemetry(sessionBuffer, {
        timestampMs: frame.timestampMs,
        type: "low_confidence_pause",
        message: confidence.message,
        meta: { frameQuality: confidence.frameQuality, view: confidence.view },
      });
    }

    const previousState = trackerState;
    const phaseUpdate = shouldPause
      ? { state: previousState, phase: previousState.phase, rawPhase: previousState.rawPhase, phaseChanged: false, repCompleted: false, milestone: null }
      : advancePhaseTracker(fixture.exerciseId, trackingFrame, previousState, frame.timestampMs);
    trackerState = phaseUpdate.state;

    const analysis = analyzeExercise(fixture.exerciseId, trackingFrame, index, undefined, phaseUpdate.phase !== "idle" ? phaseUpdate.phase : undefined);
    const safety = evaluateSafety(fixture.exerciseId, trackingFrame.smoothedLandmarks, fixture.injuries ?? []);
    finalAnalysis = {
      ...analysis,
      safety: Math.max(0, analysis.safety - (safety.severity === "critical" ? 35 : safety.severity === "warning" ? 12 : 0)),
      overall: Math.max(0, analysis.overall - (safety.severity === "critical" ? 25 : safety.severity === "warning" ? 10 : 0)),
      frameQuality: trackingFrame.frameQuality,
      view: trackingFrame.view,
    };

    recordFrame(sessionBuffer, trackingFrame, finalAnalysis);

    if (!shouldPause && phaseUpdate.repCompleted) {
      repCount += 1;
      recordTelemetry(sessionBuffer, {
        timestampMs: frame.timestampMs,
        type: "rep_counted",
        message: `Replay counted rep ${repCount}.`,
        meta: { phase: phaseUpdate.phase, overall: finalAnalysis.overall },
      });
    }

    const cue = selectReplayCue(fixture.exerciseId, finalAnalysis, safety);
    const feedbackDecision = advanceFeedbackState(feedbackState, shouldPause ? null : cue, { now: frame.timestampMs, confidence: trackingFrame.trackingConfidence });
    feedbackState = feedbackDecision.nextState;

    if (feedbackDecision.shouldEmit) {
      emittedCues.push({
        timestampMs: frame.timestampMs,
        signature: cue.signature,
        message: cue.message,
        severity: cue.severity,
      });
      recordCue(sessionBuffer, cue, frame.timestampMs);
    }
  });

  return {
    repCount,
    pauseFrames,
    emittedCues,
    finalAnalysis,
    sessionAnalysis: finalizeSessionAnalysis(sessionBuffer),
  };
}
