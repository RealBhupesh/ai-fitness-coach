import { buildIssueSignature, type CoachLevel, type FeedbackCue } from "@/lib/feedback/state";
import type { FrameAnalysis, LiveMetric } from "@/lib/pose/types";
import type { evaluateSafety } from "@/lib/pose/safety";

type SafetyResult = ReturnType<typeof evaluateSafety>;

const METRIC_PRIORITY: Record<string, string[]> = {
  squat: ["Knee Tracking", "Torso Stack", "Depth", "Hip Centering", "Symmetry", "Shoulder Stability"],
  bicep_curl: ["Elbow Path", "Shoulder Stability", "Torso Stability", "Wrist Stack", "Bottom Extension", "Top Finish", "Symmetry"],
};

const BICEP_CURL_THRESHOLD: Record<CoachLevel, number> = {
  easy: 64,
  normal: 78,
  hard: 86,
};

function metricPriority(exerciseId: string, metricName: string) {
  const index = METRIC_PRIORITY[exerciseId]?.indexOf(metricName) ?? -1;
  return index === -1 ? 99 : index;
}

function sideFor(frame: FrameAnalysis): FeedbackCue["side"] {
  return frame.trackedSide ?? "body";
}

function cueFromMetric(exerciseId: string, frame: FrameAnalysis, metric: LiveMetric, confidence?: number, coachLevel: CoachLevel = "normal"): FeedbackCue {
  const severity: FeedbackCue["severity"] = metric.status === "critical" || (coachLevel === "hard" && metric.score < 62) ? "critical" : "warning";
  const side = sideFor(frame);
  return {
    message: metric.detail,
    severity,
    source: "rule_engine",
    secondaryNote: frame.secondaryNote,
    signature: buildIssueSignature({ severity, message: metric.detail, side, channel: exerciseId }),
    metricName: metric.name,
    side,
    phase: frame.phase,
    score: metric.score,
    value: metric.value,
    target: metric.target,
    confidence,
  };
}

function issueThreshold(exerciseId: string, coachLevel: CoachLevel) {
  if (exerciseId === "bicep_curl") return BICEP_CURL_THRESHOLD[coachLevel];
  return 78;
}

function bestMetricIssue(exerciseId: string, frame: FrameAnalysis, coachLevel: CoachLevel) {
  const threshold = issueThreshold(exerciseId, coachLevel);
  return frame.metrics
    .filter((metric) => metric.reliable !== false && metric.score < threshold)
    .sort((a, b) => {
      const severityDelta = (a.status === "critical" ? 0 : 1) - (b.status === "critical" ? 0 : 1);
      if (severityDelta !== 0) return severityDelta;
      const priorityDelta = metricPriority(exerciseId, a.name) - metricPriority(exerciseId, b.name);
      if (priorityDelta !== 0) return priorityDelta;
      if (coachLevel === "hard") return a.score - b.score;
      return a.score - b.score;
    })[0];
}

function bestPositiveMetric(exerciseId: string, frame: FrameAnalysis) {
  return frame.metrics
    .filter((metric) => metric.reliable !== false && metric.score >= 85)
    .sort((a, b) => metricPriority(exerciseId, a.name) - metricPriority(exerciseId, b.name) || b.score - a.score)[0];
}

function softenEasyCurlCue(cue: FeedbackCue) {
  if (cue.severity !== "warning") return cue;
  return {
    ...cue,
    message: cue.message
      .replace(/^Keep your /, "Try keeping your ")
      .replace(/^Stop /, "Reduce ")
      .replace(/^Brace /, "Gently brace ")
      .replace(/\.$/, " when you can."),
    secondaryNote: cue.secondaryNote ?? "Easy mode only calls out bigger curl issues.",
  };
}

export function selectFeedbackCue(
  exerciseId: string,
  frame: FrameAnalysis,
  safety: SafetyResult,
  confidence?: number,
  options: { coachLevel?: CoachLevel } = {},
): FeedbackCue {
  const coachLevel = options.coachLevel ?? "normal";
  const build = (
    message: string,
    severity: FeedbackCue["severity"],
    source: FeedbackCue["source"],
    side: FeedbackCue["side"] = sideFor(frame),
    metric?: LiveMetric,
  ): FeedbackCue => ({
    message,
    severity,
    source,
    secondaryNote: frame.secondaryNote,
    signature: buildIssueSignature({ severity, message, side, channel: exerciseId }),
    metricName: metric?.name,
    side,
    phase: frame.phase,
    score: metric?.score,
    value: metric?.value,
    target: metric?.target,
    confidence,
  });

  if (safety.blocked || safety.severity === "critical") {
    return build(safety.messages[0], "critical", "rule_engine", "body");
  }

  if (frame.injuryRisks.length) {
    return build(frame.injuryRisks[0], "warning", "rule_engine");
  }

  if (safety.severity === "warning" && safety.messages.length) {
    return build(safety.messages[0], "warning", "rule_engine");
  }

  const metricIssue = bestMetricIssue(exerciseId, frame, coachLevel);
  if (metricIssue) {
    const cue = cueFromMetric(exerciseId, frame, metricIssue, confidence, coachLevel);
    return exerciseId === "bicep_curl" && coachLevel === "easy" ? softenEasyCurlCue(cue) : cue;
  }

  const positiveMetric = bestPositiveMetric(exerciseId, frame);
  const positiveMessage = positiveMetric?.detail ?? frame.positives[0] ?? frame.primaryFocus ?? frame.targetCue ?? "Strong rep. Keep the rhythm.";
  return build(positiveMessage, "info", "system", sideFor(frame), positiveMetric);
}
