export type FeedbackSeverity = "critical" | "warning" | "info";
export type FeedbackSource = "rule_engine" | "llm_coach" | "system";

export type FeedbackCue = {
  signature: string;
  message: string;
  secondaryNote?: string;
  severity: FeedbackSeverity;
  source: FeedbackSource;
};

export type FeedbackStateSnapshot = {
  issueSignature: string | null;
  lastIssueChangeAt: number;
  consecutiveFramesInIssue: number;
  lastSpokenSignatureAt: Record<string, number>;
  lastEmittedSignature: string | null;
  lastEmittedAt: number;
};

export type FeedbackDecision = {
  nextState: FeedbackStateSnapshot;
  shouldEmit: boolean;
  reason: "none" | "safety" | "changed_stable" | "repeat_cooldown";
};

const STABLE_FRAMES: Record<FeedbackSeverity, number> = {
  critical: 1,
  warning: 6,
  info: 10,
};

const REPEAT_COOLDOWN_MS: Record<FeedbackSeverity, number> = {
  critical: 1_500,
  warning: 10_000,
  info: 14_000,
};

export function createFeedbackState(): FeedbackStateSnapshot {
  return {
    issueSignature: null,
    lastIssueChangeAt: 0,
    consecutiveFramesInIssue: 0,
    lastSpokenSignatureAt: {},
    lastEmittedSignature: null,
    lastEmittedAt: 0,
  };
}

export function normalizeFeedbackToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, "_");
}

export function buildIssueSignature(options: {
  severity: FeedbackSeverity;
  message: string;
  side?: string;
  channel?: string;
}) {
  const side = options.side ? normalizeFeedbackToken(options.side) : "body";
  const channel = options.channel ? normalizeFeedbackToken(options.channel) : "live";
  return [options.severity, channel, side, normalizeFeedbackToken(options.message)].join(":");
}

export function advanceFeedbackState(
  previousState: FeedbackStateSnapshot,
  cue: FeedbackCue | null,
  options: {
    now: number;
    confidence: number;
    confidenceGate?: number;
  },
): FeedbackDecision {
  const nextState: FeedbackStateSnapshot = {
    ...previousState,
    lastSpokenSignatureAt: { ...previousState.lastSpokenSignatureAt },
  };

  if (!cue?.signature) {
    nextState.issueSignature = null;
    nextState.consecutiveFramesInIssue = 0;
    return { nextState, shouldEmit: false, reason: "none" };
  }

  if (previousState.issueSignature !== cue.signature) {
    nextState.issueSignature = cue.signature;
    nextState.lastIssueChangeAt = options.now;
    nextState.consecutiveFramesInIssue = 1;
  } else {
    nextState.consecutiveFramesInIssue += 1;
  }

  const lastSpokenAt = nextState.lastSpokenSignatureAt[cue.signature] ?? 0;
  const confidenceGate = options.confidenceGate ?? 0.66;
  const confidenceReady = options.confidence >= confidenceGate;

  if (cue.severity === "critical") {
    if (options.now - lastSpokenAt >= REPEAT_COOLDOWN_MS.critical) {
      nextState.lastSpokenSignatureAt[cue.signature] = options.now;
      nextState.lastEmittedSignature = cue.signature;
      nextState.lastEmittedAt = options.now;
      return { nextState, shouldEmit: true, reason: "safety" };
    }
    return { nextState, shouldEmit: false, reason: "none" };
  }

  if (!confidenceReady) {
    return { nextState, shouldEmit: false, reason: "none" };
  }

  const stableFramesRequired = STABLE_FRAMES[cue.severity];
  if (nextState.consecutiveFramesInIssue < stableFramesRequired) {
    return { nextState, shouldEmit: false, reason: "none" };
  }

  const isNewIssue = previousState.lastEmittedSignature !== cue.signature;
  if (isNewIssue) {
    nextState.lastSpokenSignatureAt[cue.signature] = options.now;
    nextState.lastEmittedSignature = cue.signature;
    nextState.lastEmittedAt = options.now;
    return { nextState, shouldEmit: true, reason: "changed_stable" };
  }

  if (options.now - lastSpokenAt >= REPEAT_COOLDOWN_MS[cue.severity]) {
    nextState.lastSpokenSignatureAt[cue.signature] = options.now;
    nextState.lastEmittedSignature = cue.signature;
    nextState.lastEmittedAt = options.now;
    return { nextState, shouldEmit: true, reason: "repeat_cooldown" };
  }

  return { nextState, shouldEmit: false, reason: "none" };
}
