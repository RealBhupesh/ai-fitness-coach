import { average, clamp } from "@/lib/pose/math";
import { consistencyAverage, fatigueDropFromFrames, tempoDriftFromFrames } from "@/lib/pose/kinematics";
import type { FeedbackCue } from "@/lib/feedback/state";
import type {
  FrameAnalysis,
  FrameQualityState,
  SessionAnalysisBuffer,
  SessionFramePoint,
  SessionPhasePoint,
  SessionPostSetAnalysis,
  SessionTelemetryEvent,
  TrackingFrame,
} from "@/lib/pose/types";

function emptyFrameQualityStats(): Record<FrameQualityState, number> {
  return {
    ready: 0,
    partial_body: 0,
    wrong_angle: 0,
    low_light: 0,
    motion_blur: 0,
    occluded: 0,
    camera_lost: 0,
    low_fps: 0,
  };
}

const EMPTY_POST_SET: SessionPostSetAnalysis = {
  stabilityAverage: 0,
  asymmetryAverage: 0,
  tempoDrift: 0,
  fatigueDrop: 0,
  consistencyAverage: 0,
  recurringIssues: [],
};

export function createSessionAnalysisBuffer(): SessionAnalysisBuffer {
  return {
    frames: [],
    issueHistory: [],
    phaseHistory: [],
    frameQualityStats: emptyFrameQualityStats(),
    telemetry: [],
    postSet: EMPTY_POST_SET,
  };
}

export function recordFrame(buffer: SessionAnalysisBuffer, trackingFrame: TrackingFrame, analysis: FrameAnalysis, sessionTimestampMs = trackingFrame.timestampMs) {
  const timestampMs = Math.max(0, Math.round(sessionTimestampMs));
  const point: SessionFramePoint = {
    timestampMs,
    overall: analysis.overall,
    form: analysis.form,
    rom: analysis.rom,
    tempo: analysis.tempo,
    stability: analysis.stability,
    symmetry: analysis.symmetry,
    safety: analysis.safety,
    phase: analysis.phase,
    frameQuality: trackingFrame.frameQuality,
    issueSignature: analysis.primaryIssueKey,
  };

  buffer.frames.push(point);
  buffer.frameQualityStats[trackingFrame.frameQuality] += 1;

  const lastPhase = buffer.phaseHistory[buffer.phaseHistory.length - 1];
  if (!lastPhase || lastPhase.phase !== analysis.phase) {
    const phasePoint: SessionPhasePoint = {
      timestampMs,
      phase: analysis.phase,
    };
    buffer.phaseHistory.push(phasePoint);
  }
}

export function recordCue(buffer: SessionAnalysisBuffer, cue: FeedbackCue, timestampMs: number) {
  const last = buffer.issueHistory[buffer.issueHistory.length - 1];
  if (last?.signature === cue.signature) {
    return;
  }

  buffer.issueHistory.push({
    timestampMs: Math.max(0, Math.round(timestampMs)),
    signature: cue.signature,
    message: cue.message,
    severity: cue.severity,
  });
}

export function recordTelemetry(buffer: SessionAnalysisBuffer, event: SessionTelemetryEvent) {
  buffer.telemetry.push({ ...event, timestampMs: Math.max(0, Math.round(event.timestampMs)) });
}

export function finalizeSessionAnalysis(buffer: SessionAnalysisBuffer) {
  const frames = buffer.frames;
  const stabilityAverage = frames.length ? Math.round(average(frames.map((frame) => frame.stability))) : 0;
  const asymmetryAverage = frames.length ? clamp(Math.round(100 - average(frames.map((frame) => frame.symmetry))), 0, 100) : 0;
  const recurringIssues = Array.from(
    buffer.issueHistory.reduce((map, item) => {
      map.set(item.message, (map.get(item.message) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([message]) => message);

  buffer.postSet = {
    stabilityAverage,
    asymmetryAverage,
    tempoDrift: tempoDriftFromFrames(frames),
    fatigueDrop: fatigueDropFromFrames(frames),
    consistencyAverage: consistencyAverage(frames),
    recurringIssues,
  };

  return buffer;
}
