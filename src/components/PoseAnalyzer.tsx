"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, CameraOff, GripVertical, Maximize2, Mic, Minimize2, Monitor, RotateCcw, Smartphone, Timer, Volume2, VolumeX, Waves, Zap } from "lucide-react";
import { toast } from "sonner";
import { SessionSetupCard } from "@/components/coach/SessionSetupCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createCameraController, getCameraProfile } from "@/lib/camera/controller";
import { compareDanceFrame } from "@/lib/dance/comparator";
import type { DanceComparison, DanceRoutinePack } from "@/lib/dance/types";
import { advanceFeedbackState, buildIssueSignature, createFeedbackState, type FeedbackCue } from "@/lib/feedback/state";
import { createVoiceFeedbackController } from "@/lib/feedback/voice";
import { useUserProfile } from "@/hooks/useUserProfile";
import { cn } from "@/lib/utils";
import { evaluateConfidence } from "@/lib/pose/confidence";
import { advancePhaseTracker, analyzeExercise, createPhaseTrackerState, EXERCISE_CONTRACTS, POSE_CONNECTIONS, POSE_EXERCISES } from "@/lib/pose/exercises";
import { average } from "@/lib/pose/math";
import { evaluateSafety } from "@/lib/pose/safety";
import { createSessionAnalysisBuffer, finalizeSessionAnalysis, recordCue, recordFrame, recordTelemetry } from "@/lib/pose/session-buffer";
import { createPoseTrackingEngine } from "@/lib/pose/tracking-engine";
import type { ConfidenceStatus, ExerciseId, FrameAnalysis, Landmark, SessionAnalysisBuffer, SessionTelemetryEvent, TrackingFrame } from "@/lib/pose/types";

type Props = { mode?: "workout" | "dance" };

type FeedbackEvent = {
  timestamp: number;
  type: string;
  message: string;
  severity: "critical" | "warning" | "info";
  source: "rule_engine" | "llm_coach" | "system";
};

type TechniqueScorecard = {
  elbowPath: number;
  rangeOfMotion: number;
  tempoControl: number;
  torsoStability: number;
};

type TopMistake = {
  mistake: string;
  whyItHurtsPerformance: string;
  exactFix: string;
};

type CorrectiveBlock = {
  minuteRange: string;
  drill: string;
  focusCue: string;
};

async function parseApiResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    const text = await response.text();
    return { error: text || `HTTP ${response.status}` };
  } catch {
    return { error: `HTTP ${response.status}` };
  }
}

const IDS = {
  workout: ["squat", "pushup", "lunge", "bicep_curl", "jumping_jack", "plank", "warrior"] as ExerciseId[],
  dance: ["dance_basic", "jumping_jack"] as ExerciseId[],
};

const EMPTY_CONFIDENCE = (exerciseId: ExerciseId): ConfidenceStatus => ({
  ready: false,
  avgVisibility: 0,
  fullBodyVisible: false,
  centered: false,
  tooFar: false,
  tooClose: false,
  message: "Enable the camera to calibrate.",
  frameQuality: "camera_lost",
  view: "unknown",
  allowedViews: EXERCISE_CONTRACTS[exerciseId].viewPolicy.allowedViews,
  brightness: 0,
  motion: 0,
  pauseTracking: true,
  reasons: [],
});

const EMPTY: FrameAnalysis = {
  form: 0,
  rom: 0,
  tempo: 0,
  stability: 0,
  symmetry: 0,
  consistency: 0,
  endurance: 0,
  safety: 0,
  overall: 0,
  phase: "idle",
  metrics: [],
  issues: [],
  positives: [],
  corrections: [],
  injuryRisks: [],
};

const bar = (score: number) => (score >= 88 ? "from-emerald-500 to-green-400" : score >= 72 ? "from-amber-500 to-yellow-400" : score >= 55 ? "from-orange-500 to-amber-400" : "from-rose-500 to-red-500");
const text = (score: number) => (score >= 88 ? "text-emerald-400" : score >= 72 ? "text-amber-400" : score >= 55 ? "text-orange-400" : "text-rose-400");

function trackedSideLabel(side?: FrameAnalysis["trackedSide"]) {
  if (side === "left") return "Left side";
  if (side === "right") return "Right side";
  if (side === "both") return "Both sides";
  return "Body";
}

function normalizeDanceRoutine(raw: any): DanceRoutinePack | null {
  if (!raw?.id || !raw?.name) return null;
  const checkpoints = Array.isArray(raw.checkpoints)
    ? raw.checkpoints
    : typeof raw.checkpoints === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(raw.checkpoints);
            return Array.isArray(parsed?.steps) ? parsed.steps : [];
          } catch {
            return [];
          }
        })()
      : [];

  return {
    id: String(raw.id),
    name: String(raw.name),
    description: typeof raw.description === "string" ? raw.description : "Dance routine pack",
    difficulty: typeof raw.difficulty === "string" ? raw.difficulty : "beginner",
    durationMs: Number(raw.durationMs ?? 0),
    bpm: Number(raw.bpm ?? 96),
    audioUrl: typeof raw.audioUrl === "string" ? raw.audioUrl : typeof raw.musicUrl === "string" ? raw.musicUrl : "",
    thumbnailUrl: typeof raw.thumbnailUrl === "string" ? raw.thumbnailUrl : "",
    checkpoints: checkpoints.filter((item: any) => item && typeof item.timeMs === "number" && typeof item.cue === "string").sort((a: any, b: any) => a.timeMs - b.timeMs),
    segments: Array.isArray(raw.segments) ? raw.segments : [],
  };
}

function getActiveDanceCheckpoint(routine: DanceRoutinePack | null, elapsedMs: number) {
  const steps = routine?.checkpoints ?? [];
  if (!steps.length) return null;
  const loopMs = routine?.durationMs && routine.durationMs > 0 ? elapsedMs % routine.durationMs : elapsedMs;
  let active = steps[0];
  let index = 0;
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    if (loopMs >= steps[stepIndex].timeMs) {
      active = steps[stepIndex];
      index = stepIndex;
    } else {
      break;
    }
  }
  return { step: active, index };
}

function scorecardLabels(exerciseId: ExerciseId) {
  if (exerciseId === "dance_basic") {
    return [
      { label: "Frame width", valueKey: "elbowPath" as const },
      { label: "Arm lines", valueKey: "rangeOfMotion" as const },
      { label: "Beat timing", valueKey: "tempoControl" as const },
      { label: "Torso control", valueKey: "torsoStability" as const },
    ];
  }
  return [
    { label: "Elbow path", valueKey: "elbowPath" as const },
    { label: "Range of motion", valueKey: "rangeOfMotion" as const },
    { label: "Tempo control", valueKey: "tempoControl" as const },
    { label: "Torso stability", valueKey: "torsoStability" as const },
  ];
}

function selectLiveCue(exerciseId: ExerciseId, frame: FrameAnalysis, safety: ReturnType<typeof evaluateSafety>) {
  const cue = (message: string, severity: FeedbackCue["severity"], source: FeedbackCue["source"], side?: string, secondaryNote?: string): FeedbackCue => ({
    message,
    severity,
    source,
    secondaryNote,
    signature: buildIssueSignature({ severity, message, side, channel: exerciseId }),
  });

  if (safety.blocked || safety.severity === "critical") return cue(safety.messages[0], "critical", "rule_engine", "body", frame.secondaryNote);
  if (frame.injuryRisks.length) return cue(frame.injuryRisks[0], "warning", "rule_engine", frame.trackedSide, frame.secondaryNote);
  if (safety.severity === "warning" && safety.messages.length) return cue(safety.messages[0], "warning", "rule_engine", frame.trackedSide, frame.secondaryNote);
  if (frame.corrections.length) return cue(frame.corrections[0], "warning", "rule_engine", frame.trackedSide, frame.secondaryNote);
  if (frame.positives.length) return cue(frame.positives[0], "info", "system", frame.trackedSide, frame.secondaryNote);
  return cue(frame.primaryFocus || frame.targetCue || "Strong rep. Keep the rhythm.", "info", "system", frame.trackedSide, frame.secondaryNote);
}

function draw(canvas: HTMLCanvasElement | null, video: HTMLVideoElement | null, landmarks: Landmark[] | null, score: number, mirror: boolean) {
  if (!canvas || !video) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks?.length) return;
  const stroke = score >= 88 ? "#10b981" : score >= 72 ? "#f59e0b" : score >= 55 ? "#f97316" : "#f43f5e";
  ctx.save();
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.lineWidth = 3;
  for (const [a, b] of POSE_CONNECTIONS) {
    const start = landmarks[a];
    const end = landmarks[b];
    if (!start || !end || (start.visibility ?? 0) < 0.4 || (end.visibility ?? 0) < 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
    ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
    ctx.stroke();
  }
  for (const point of landmarks) {
    if (!point || (point.visibility ?? 0) < 0.35) continue;
    ctx.beginPath();
    ctx.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export default function PoseAnalyzer({ mode = "workout" }: Props) {
  const { profile } = useUserProfile();
  const exercises = useMemo(() => POSE_EXERCISES.filter((item) => IDS[mode].includes(item.id)), [mode]);
  const [exerciseId, setExerciseId] = useState<ExerciseId>(mode === "dance" ? "dance_basic" : "squat");
  const exercise = useMemo(() => exercises.find((item) => item.id === exerciseId) ?? exercises[0], [exerciseId, exercises]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const cameraControllerRef = useRef<ReturnType<typeof createCameraController> | null>(null);
  const trackingEngineRef = useRef<ReturnType<typeof createPoseTrackingEngine> | null>(null);
  const trackingFrameRef = useRef<TrackingFrame | null>(null);
  const runningRef = useRef(false);
  const mirrorRef = useRef(true);
  const exerciseIdRef = useRef<ExerciseId>(exerciseId);
  const exerciseRef = useRef(exercise);
  const profileRef = useRef(profile);
  const confidenceRef = useRef<ConfidenceStatus>(EMPTY_CONFIDENCE(exerciseId));
  const phaseTrackerRef = useRef(createPhaseTrackerState());
  const feedbackStateRef = useRef(createFeedbackState());
  const lastRepAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const repsRef = useRef(0);
  const voiceRef = useRef(createVoiceFeedbackController());
  const repDataRef = useRef<any[]>([]);
  const eventsRef = useRef<FeedbackEvent[]>([]);
  const framesRef = useRef<FrameAnalysis[]>([]);
  const curveRef = useRef<number[]>([]);
  const sessionBufferRef = useRef<SessionAnalysisBuffer>(createSessionAnalysisBuffer());
  const danceSegmentRef = useRef<Record<string, { label: string; scores: number[]; timing: number[]; transition: number[] }>>({});
  const lastCoachRef = useRef(0);
  const lastCoachSignatureRef = useRef<string | null>(null);
  const lastOverallRef = useRef(0);
  const lastPauseReasonRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const pipDragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  const [cameraProfileLabel, setCameraProfileLabel] = useState(getCameraProfile("desktop_hq").label);
  const [cameraOn, setCameraOn] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [fps, setFps] = useState(0);
  const [confidence, setConfidence] = useState<ConfidenceStatus>(EMPTY_CONFIDENCE(exerciseId));
  const [analysis, setAnalysis] = useState<FrameAnalysis>(EMPTY);
  const [feedback, setFeedback] = useState("Enable the camera to calibrate.");
  const [secondaryFeedback, setSecondaryFeedback] = useState("");
  const [coachLine, setCoachLine] = useState("");
  const [coachSource, setCoachSource] = useState<"llm" | "fallback" | "">("");
  const [summary, setSummary] = useState("");
  const [summaryInsights, setSummaryInsights] = useState<string[]>([]);
  const [summaryPractice, setSummaryPractice] = useState<string[]>([]);
  const [techniqueScorecard, setTechniqueScorecard] = useState<TechniqueScorecard | null>(null);
  const [danceRoutine, setDanceRoutine] = useState<DanceRoutinePack | null>(null);
  const [danceComparison, setDanceComparison] = useState<DanceComparison | null>(null);
  const [danceSegmentBreakdown, setDanceSegmentBreakdown] = useState<Array<{ id: string; label: string; overall: number; timing: number; transition: number }>>([]);
  const [topMistakes, setTopMistakes] = useState<TopMistake[]>([]);
  const [correctivePlan, setCorrectivePlan] = useState<CorrectiveBlock[]>([]);
  const [trackingPausedReason, setTrackingPausedReason] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [cameraLayout, setCameraLayout] = useState<"landscape" | "portrait">("landscape");
  const [cameraViewMode, setCameraViewMode] = useState<"full" | "pip" | "minimized">("full");
  const [pipPos, setPipPos] = useState({ x: 20, y: 80 });
  const [seconds, setSeconds] = useState(0);
  const [calories, setCalories] = useState(0);
  const danceRoutineRef = useRef<DanceRoutinePack | null>(danceRoutine);
  const analysisRef = useRef<FrameAnalysis>(analysis);
  const feedbackRef = useRef(feedback);
  const coachLineRef = useRef(coachLine);
  const secondsRef = useRef(seconds);
  const caloriesRef = useRef(calories);

  const pushTelemetry = (event: SessionTelemetryEvent) => {
    recordTelemetry(sessionBufferRef.current, event);
  };

  const applyCue = (cue: FeedbackCue, options: { eventType?: FeedbackEvent["type"]; logEvent?: boolean; speak?: boolean } = {}) => {
    setFeedback(cue.message);
    setSecondaryFeedback(cue.secondaryNote ?? "");
    if (options.logEvent) {
      const timestamp = Math.max(0, Date.now() - startedAtRef.current);
      eventsRef.current.push({
        timestamp,
        type: options.eventType ?? (cue.severity === "critical" ? "stop" : "cue"),
        message: cue.message,
        severity: cue.severity,
        source: cue.source,
      });
      recordCue(sessionBufferRef.current, cue, timestamp);
    }
    if (options.speak) {
      voiceRef.current.speak(cue.message, cue.severity === "critical" ? "critical" : cue.severity === "warning" ? "warning" : "info", cue.signature);
    }
  };

  const showStatus = (message: string, severity: FeedbackEvent["severity"] = "info", source: FeedbackEvent["source"] = "system", secondaryNote = "") => {
    applyCue(
      {
        message,
        severity,
        source,
        secondaryNote,
        signature: buildIssueSignature({ severity, message, channel: source, side: "body" }),
      },
      { logEvent: false, speak: false },
    );
  };

  const emitCue = (cue: FeedbackCue, eventType: FeedbackEvent["type"] = "cue") => {
    applyCue(cue, { eventType, logEvent: true, speak: true });
  };

  const reset = () => {
    phaseTrackerRef.current = createPhaseTrackerState();
    feedbackStateRef.current = createFeedbackState();
    lastRepAtRef.current = 0;
    repsRef.current = 0;
    repDataRef.current = [];
    eventsRef.current = [];
    framesRef.current = [];
    curveRef.current = [];
    sessionBufferRef.current = createSessionAnalysisBuffer();
    danceSegmentRef.current = {};
    lastCoachRef.current = 0;
    lastCoachSignatureRef.current = null;
    lastOverallRef.current = 0;
    lastPauseReasonRef.current = null;
    savingRef.current = false;
    setAnalysis(EMPTY);
    setFeedback("Enable the camera to calibrate.");
    setSecondaryFeedback("");
    setCoachLine("");
    setCoachSource("");
    setSummary("");
    setSummaryInsights([]);
    setSummaryPractice([]);
    setTechniqueScorecard(null);
    setDanceComparison(null);
    setDanceSegmentBreakdown([]);
    setTopMistakes([]);
    setCorrectivePlan([]);
    setTrackingPausedReason(null);
    setSeconds(0);
    setCalories(0);
  };

  const onPipPointerDown = (event: React.PointerEvent) => {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pipDragRef.current = { sx: event.clientX, sy: event.clientY, px: pipPos.x, py: pipPos.y };
  };

  const onPipPointerMove = (event: React.PointerEvent) => {
    const drag = pipDragRef.current;
    if (!drag) return;
    setPipPos({ x: Math.max(0, drag.px + (event.clientX - drag.sx)), y: Math.max(0, drag.py + (event.clientY - drag.sy)) });
  };

  const onPipPointerUp = () => {
    pipDragRef.current = null;
  };

  const maybeRep = (phaseUpdate: ReturnType<typeof advancePhaseTracker>, previousPhaseState: ReturnType<typeof createPhaseTrackerState>, frame: FrameAnalysis, now: number) => {
    if (!phaseUpdate.repCompleted || now - lastRepAtRef.current < 450) return;
    lastRepAtRef.current = now;
    repsRef.current += 1;
    repDataRef.current.push({
      exerciseId: exerciseIdRef.current,
      repNumber: repsRef.current,
      phase: phaseUpdate.phase,
      formScore: frame.form,
      romScore: frame.rom,
      tempoScore: frame.tempo,
      safetyScore: frame.safety,
      corrections: frame.corrections.slice(0, 4),
      durationMs: Math.max(0, now - previousPhaseState.cycleStartedAt),
      timestamps: {
        startMs: Math.max(0, previousPhaseState.cycleStartedAt - startedAtRef.current),
        endMs: Math.max(0, now - startedAtRef.current),
      },
    });
    pushTelemetry({
      timestampMs: Math.max(0, now - startedAtRef.current),
      type: "rep_counted",
      message: `Rep ${repsRef.current} counted.`,
      meta: { phase: phaseUpdate.phase, overall: frame.overall },
    });
    emitCue(
      {
        message: `Rep ${repsRef.current} counted. ${frame.corrections[0] ?? frame.positives[0] ?? "Keep moving with control."}`,
        severity: "info",
        source: "system",
        secondaryNote: frame.secondaryNote,
        signature: buildIssueSignature({ severity: "info", message: `rep_${repsRef.current}_${exerciseIdRef.current}`, side: exerciseIdRef.current, channel: "rep" }),
      },
      "cue",
    );
  };

  const maybeCoach = async (frame: FrameAnalysis, cue: FeedbackCue, triggerReason: "issue_changed" | "score_drop" | "phase_milestone" | null) => {
    if (!runningRef.current || !triggerReason) return;
    const now = Date.now();
    const interval = exerciseIdRef.current === "bicep_curl" ? 8_000 : exerciseIdRef.current === "squat" ? 8_500 : exerciseIdRef.current === "dance_basic" ? 7_500 : 12_000;
    if (now - lastCoachRef.current < interval) return;
    if (triggerReason === "issue_changed" && lastCoachSignatureRef.current === cue.signature && now - lastCoachRef.current < 15_000) return;
    lastCoachRef.current = now;
    lastCoachSignatureRef.current = cue.signature;
    try {
      const response = await fetch("/api/coach/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseType: exerciseIdRef.current,
          repsSoFar: repsRef.current,
          phase: frame.phase,
          confidence: confidenceRef.current.avgVisibility,
          issueSignature: cue.signature,
          triggerReason,
          currentIssues: [...frame.injuryRisks, ...frame.corrections, ...frame.issues].slice(0, 6),
          currentMetrics: frame.metrics.slice(0, 8).map((metric) => ({ name: metric.name, score: metric.score, detail: metric.detail, value: metric.value, target: metric.target })),
          recentScores: repDataRef.current.slice(-5).map((rep: any) => ({ form: rep.formScore, rom: rep.romScore, tempo: rep.tempoScore, safety: rep.safetyScore })),
        }),
      });
      const data = await parseApiResponse(response);
      if (response.ok && data?.feedback) {
        setCoachLine(data.feedback);
        setCoachSource(data.provider === "groq" || data.provider === "openai" ? "llm" : "fallback");
      } else if (!response.ok && (frame.corrections.length || frame.injuryRisks.length || frame.issues.length)) {
        setCoachLine(frame.injuryRisks[0] ?? frame.corrections[0] ?? frame.issues[0]);
        setCoachSource("fallback");
      }
    } catch {}
  };

  const handleTrackingFrame = (trackingFrame: TrackingFrame | null) => {
    const currentId = exerciseIdRef.current;
    const currentExercise = exerciseRef.current;
    draw(overlayRef.current, videoRef.current, trackingFrame?.smoothedLandmarks ?? null, analysisRef.current.overall, mirrorRef.current);

    if (!trackingFrame?.smoothedLandmarks?.length) {
      const lost = { ...EMPTY_CONFIDENCE(currentId), message: "Camera lost. Step back into frame.", reasons: ["Camera lost. Step back into frame."] };
      setConfidence(lost);
      confidenceRef.current = lost;
      feedbackStateRef.current = createFeedbackState();
      setTrackingPausedReason(runningRef.current ? "Camera lost. Scoring is paused until you are fully back in frame." : null);
      if (runningRef.current && lastPauseReasonRef.current !== lost.message) {
        pushTelemetry({ timestampMs: Math.max(0, Date.now() - startedAtRef.current), type: "camera_disconnected", message: lost.message });
        emitCue(
          {
            message: lost.message,
            severity: "warning",
            source: "system",
            secondaryNote: "Scoring is paused until your body is fully visible again.",
            signature: buildIssueSignature({ severity: "warning", message: lost.message, channel: "system", side: "body" }),
          },
          "cue",
        );
        lastPauseReasonRef.current = lost.message;
      } else if (!runningRef.current) {
        showStatus(lost.message);
      }
      return;
    }

    trackingFrameRef.current = trackingFrame;
    setFps(Math.round(trackingFrame.fps));
    const gate = evaluateConfidence(trackingFrame, currentId);
    setConfidence(gate);
    confidenceRef.current = gate;

    if (!runningRef.current) {
      showStatus(gate.message);
      setTrackingPausedReason(null);
      draw(overlayRef.current, videoRef.current, trackingFrame.smoothedLandmarks, 80, mirrorRef.current);
      return;
    }

    const shouldPauseScoring = gate.pauseTracking || !gate.ready || gate.avgVisibility < 0.55;
    const pauseReason = shouldPauseScoring ? `${gate.message} Rep counting is paused until tracking recovers.` : null;
    setTrackingPausedReason(pauseReason);
    if (shouldPauseScoring) {
      if (lastPauseReasonRef.current !== pauseReason) {
        pushTelemetry({
          timestampMs: Math.max(0, Date.now() - startedAtRef.current),
          type: "low_confidence_pause",
          message: pauseReason ?? gate.message,
          meta: { frameQuality: trackingFrame.frameQuality, view: trackingFrame.view, fps: trackingFrame.fps, brightness: trackingFrame.brightness },
        });
        emitCue(
          {
            message: gate.message,
            severity: "warning",
            source: "system",
            secondaryNote: "Tracking has to recover before rep counting resumes.",
            signature: buildIssueSignature({ severity: "warning", message: gate.message, channel: "system", side: "body" }),
          },
          "cue",
        );
        lastPauseReasonRef.current = pauseReason;
      }
      feedbackStateRef.current = createFeedbackState();
      if (gate.avgVisibility < 0.35) return;
    } else {
      lastPauseReasonRef.current = null;
    }

    const now = Date.now();
    const elapsedMs = Math.max(0, now - startedAtRef.current);
    const activeDanceCheckpoint = currentId === "dance_basic" ? getActiveDanceCheckpoint(danceRoutineRef.current, elapsedMs) : null;
    const previousPhaseState = phaseTrackerRef.current;
    const phaseUpdate = shouldPauseScoring
      ? { state: previousPhaseState, phase: previousPhaseState.phase, rawPhase: previousPhaseState.rawPhase, phaseChanged: false, repCompleted: false, milestone: null }
      : advancePhaseTracker(currentId, trackingFrame, previousPhaseState, now);
    phaseTrackerRef.current = phaseUpdate.state;

    const frame = analyzeExercise(currentId, trackingFrame, activeDanceCheckpoint?.index ?? Math.floor(elapsedMs / 4000), activeDanceCheckpoint?.step.cue, phaseUpdate.phase !== "idle" ? phaseUpdate.phase : undefined);
    const safety = evaluateSafety(currentId, trackingFrame.smoothedLandmarks, [...(profileRef.current?.injuries ?? []), ...(profileRef.current?.painPoints ?? [])]);
    const resolved: FrameAnalysis = {
      ...frame,
      safety: Math.max(0, frame.safety - (safety.severity === "critical" ? 35 : safety.severity === "warning" ? 12 : 0)),
      overall: Math.max(0, frame.overall - (safety.severity === "critical" ? 25 : safety.severity === "warning" ? 10 : 0)),
      frameQuality: trackingFrame.frameQuality,
      view: trackingFrame.view,
    };

    framesRef.current.push(resolved);
    if (framesRef.current.length % 15 === 0) curveRef.current.push(resolved.overall);
    recordFrame(sessionBufferRef.current, trackingFrame, resolved);
    if (!shouldPauseScoring) maybeRep(phaseUpdate, previousPhaseState, resolved, now);
    setAnalysis(resolved);
    analysisRef.current = resolved;

    if (currentId === "dance_basic" && danceRoutineRef.current?.segments?.length) {
      const comparison = compareDanceFrame({ landmarks: trackingFrame.smoothedLandmarks, routine: danceRoutineRef.current, elapsedMs, analysis: resolved });
      setDanceComparison(comparison);
      if (comparison) {
        const bucket = danceSegmentRef.current[comparison.segment.id] ?? { label: comparison.segment.label, scores: [], timing: [], transition: [] };
        bucket.scores.push(comparison.overall);
        bucket.timing.push(comparison.timingScore);
        bucket.transition.push(comparison.transitionQuality);
        danceSegmentRef.current[comparison.segment.id] = bucket;
      }
    } else {
      setDanceComparison(null);
    }

    const elapsedSeconds = Math.max(1, Math.floor((now - startedAtRef.current) / 1000));
    setSeconds(elapsedSeconds);
    secondsRef.current = elapsedSeconds;
    const estimatedCalories = Math.round((elapsedSeconds / 60) * (currentExercise.category === "dance" || currentExercise.id === "jumping_jack" ? 8.5 : 6.5));
    setCalories(estimatedCalories);
    caloriesRef.current = estimatedCalories;
    draw(overlayRef.current, videoRef.current, trackingFrame.smoothedLandmarks, resolved.overall, mirrorRef.current);

    const liveCue = selectLiveCue(currentId, resolved, safety);
    const cueDecision = advanceFeedbackState(feedbackStateRef.current, shouldPauseScoring ? null : liveCue, { now, confidence: trackingFrame.trackingConfidence });
    feedbackStateRef.current = cueDecision.nextState;
    if (cueDecision.shouldEmit) emitCue(liveCue);

    const majorScoreDrop = lastOverallRef.current - resolved.overall >= 12;
    const llmTrigger =
      cueDecision.shouldEmit && cueDecision.reason === "changed_stable" && liveCue.severity !== "info"
        ? "issue_changed"
        : majorScoreDrop && gate.avgVisibility >= 0.72
          ? "score_drop"
          : phaseUpdate.milestone === "complete" && repsRef.current > 0 && repsRef.current % 3 === 0
            ? "phase_milestone"
            : null;
    if (!shouldPauseScoring) void maybeCoach(resolved, liveCue, llmTrigger);
    lastOverallRef.current = resolved.overall;
  };

  const startCamera = async () => {
    if (cameraOn) return;
    setLoading(true);
    try {
      const video = videoRef.current;
      if (!video) return;
      if (!cameraControllerRef.current) {
        cameraControllerRef.current = createCameraController({
          video,
          preset: "desktop_hq",
          onFrame: async (frame) => {
            try {
              const tracked = await trackingEngineRef.current?.processFrame(frame, exerciseIdRef.current);
              setFps(Math.round(frame.fps));
              handleTrackingFrame(tracked ?? null);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Pose engine failed to start.";
              pushTelemetry({ timestampMs: 0, type: "camera_start_failure", message });
              showStatus(message, "warning", "system", "Camera may still be available, but pose analysis cannot start until the model loads.");
              toast.error(message);
              cameraControllerRef.current?.stop();
              setCameraOn(false);
            }
          },
          onDisconnect: () => {
            setCameraOn(false);
            handleTrackingFrame(null);
          },
        });
      }
      if (!trackingEngineRef.current) trackingEngineRef.current = createPoseTrackingEngine({ onTelemetry: pushTelemetry });
      const cameraInfo = await cameraControllerRef.current.start("desktop_hq");
      setCameraProfileLabel(cameraInfo.profile.label);
      setCameraOn(true);
      showStatus(`${cameraInfo.profile.label} active. Finish calibration before starting the session.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to access camera";
      pushTelemetry({ timestampMs: 0, type: "camera_start_failure", message });
      showStatus(message, "warning", "system", "If you already allowed access, another app may still be using the camera.");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    try {
      cameraControllerRef.current?.stop();
      void trackingEngineRef.current?.stop();
    } catch {}
    trackingFrameRef.current = null;
    runningRef.current = false;
    setCameraOn(false);
    setRunning(false);
    setCameraViewMode("full");
    const idleConfidence = EMPTY_CONFIDENCE(exerciseIdRef.current);
    setConfidence(idleConfidence);
    confidenceRef.current = idleConfidence;
    feedbackStateRef.current = createFeedbackState();
    setAnalysis(EMPTY);
    analysisRef.current = EMPTY;
    voiceRef.current.stop();
    draw(overlayRef.current, videoRef.current, null, 0, mirrorRef.current);
  };

  const startSession = () => {
    if (!cameraOn) return;
    if (!confidence.ready) {
      pushTelemetry({ timestampMs: 0, type: "calibration_blocked", message: confidence.message, meta: { frameQuality: confidence.frameQuality, view: confidence.view } });
      toast.error(confidence.message);
      return;
    }
    reset();
    const now = Date.now();
    startedAtRef.current = now;
    phaseTrackerRef.current = trackingFrameRef.current?.smoothedLandmarks?.length
      ? advancePhaseTracker(exerciseIdRef.current, trackingFrameRef.current, createPhaseTrackerState(now), now).state
      : createPhaseTrackerState(now);
    runningRef.current = true;
    setRunning(true);
    setTrackingPausedReason(null);
    emitCue({
      message: "Session live. Keep your full body in frame and follow the cue.",
      severity: "info",
      source: "system",
      secondaryNote: "The coach will only interrupt when the issue is stable and important.",
      signature: buildIssueSignature({ severity: "info", message: "session live keep your full body in frame and follow the cue", channel: "system", side: "body" }),
    });
  };

  const stopSession = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    runningRef.current = false;
    setRunning(false);
    try {
      const pick = (selector: (frame: FrameAnalysis) => number) => Math.round(average(framesRef.current.map(selector)));
      const scoring = { form: pick((frame) => frame.form), rom: pick((frame) => frame.rom), tempo: pick((frame) => frame.tempo), stability: pick((frame) => frame.stability), symmetry: pick((frame) => frame.symmetry), consistency: pick((frame) => frame.consistency), endurance: pick((frame) => frame.endurance), safety: pick((frame) => frame.safety) };
      const sessionAnalysis = finalizeSessionAnalysis(sessionBufferRef.current);
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mode === "dance" ? "dance" : exerciseRef.current.category === "cardio" ? "cardio" : "strength",
          exerciseType: exerciseIdRef.current,
          duration: Math.max(1, Math.round(secondsRef.current / 60)),
          caloriesBurned: caloriesRef.current,
          totalReps: repsRef.current,
          compositeScore: analysisRef.current.overall,
          scoringBreakdown: scoring,
          fatigueCurve: curveRef.current,
          summary: coachLineRef.current || feedbackRef.current,
          exercises: [{ exerciseId: exerciseIdRef.current, sets: exerciseRef.current.repBased ? 1 : 0, reps: repsRef.current, duration: secondsRef.current, formScore: scoring.form, romScore: scoring.rom, tempoScore: scoring.tempo, safetyScore: scoring.safety, corrections: Array.from(new Set(eventsRef.current.map((event) => event.message))).slice(0, 8) }],
          repData: repDataRef.current,
          feedbackEvents: eventsRef.current,
          sessionAnalysis,
        }),
      });
      const data = await parseApiResponse(response);
      if (!response.ok) throw new Error(data?.error || "Failed to save session");

      const topIssues = Array.from(new Set(eventsRef.current.filter((event) => event.severity !== "info").map((event) => event.message))).slice(0, 6);
      const topStrengths = framesRef.current.length ? [scoring.form >= 80 ? "Form quality stayed strong for most reps." : "", scoring.rom >= 80 ? "Range of motion was consistent." : "", scoring.safety >= 85 ? "Movement stayed safe and controlled." : ""].filter(Boolean) : [];
      const summaryRes = await fetch("/api/coach/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: data.sessionId,
          exerciseType: exerciseIdRef.current,
          durationMinutes: Math.max(1, Math.round(secondsRef.current / 60)),
          totalReps: repsRef.current,
          scoringBreakdown: scoring,
          topIssues,
          topStrengths,
          sessionSummary: `Exercise ${exerciseIdRef.current}, ${repsRef.current} reps, overall ${analysisRef.current.overall}, issues: ${topIssues.join("; ") || "none"}, post-set: ${JSON.stringify(sessionAnalysis.postSet)}`,
        }),
      });
      const summaryData = await parseApiResponse(summaryRes);
      if (summaryRes.ok) {
        setSummary(summaryData.summary || "");
        setSummaryInsights(Array.isArray(summaryData.keyInsights) ? summaryData.keyInsights : []);
        setSummaryPractice(Array.isArray(summaryData.nextSessionFocus) ? summaryData.nextSessionFocus : []);
        if (summaryData.techniqueScorecard && typeof summaryData.techniqueScorecard === "object") {
          setTechniqueScorecard({
            elbowPath: Number(summaryData.techniqueScorecard.elbowPath ?? 0),
            rangeOfMotion: Number(summaryData.techniqueScorecard.rangeOfMotion ?? 0),
            tempoControl: Number(summaryData.techniqueScorecard.tempoControl ?? 0),
            torsoStability: Number(summaryData.techniqueScorecard.torsoStability ?? 0),
          });
        }
        setTopMistakes(Array.isArray(summaryData.topMistakes) ? summaryData.topMistakes : []);
        setCorrectivePlan(Array.isArray(summaryData.correctivePlan5Min) ? summaryData.correctivePlan5Min : []);
      }
      if (mode === "dance") {
        setDanceSegmentBreakdown(Object.entries(danceSegmentRef.current).map(([id, value]) => ({ id, label: value.label, overall: Math.round(average(value.scores)), timing: Math.round(average(value.timing)), transition: Math.round(average(value.transition)) })));
      }
      showStatus("Session saved. Review the summary before restarting.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save session");
    } finally {
      stopCamera();
    }
  };

  useEffect(() => {
    exerciseIdRef.current = exerciseId;
    exerciseRef.current = exercise;
    setConfidence(EMPTY_CONFIDENCE(exerciseId));
    confidenceRef.current = EMPTY_CONFIDENCE(exerciseId);
  }, [exercise, exerciseId]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    mirrorRef.current = mirror;
  }, [mirror]);

  useEffect(() => {
    danceRoutineRef.current = danceRoutine;
  }, [danceRoutine]);

  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

  useEffect(() => {
    coachLineRef.current = coachLine;
  }, [coachLine]);

  useEffect(() => {
    analysisRef.current = analysis;
  }, [analysis]);

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    caloriesRef.current = calories;
  }, [calories]);

  useEffect(() => {
    voiceRef.current.setEnabled(voiceEnabled);
  }, [voiceEnabled]);

  useEffect(() => {
    if (mode !== "dance") {
      setDanceRoutine(null);
      setDanceComparison(null);
      return;
    }

    let cancelled = false;
    const loadRoutine = async () => {
      try {
        const response = await fetch("/api/dance/routine");
        const data = await parseApiResponse(response);
        if (cancelled) return;
        if (response.ok) {
          setDanceRoutine(normalizeDanceRoutine(data?.routine ?? data));
          return;
        }
        setDanceRoutine(null);
      } catch {
        if (!cancelled) {
          setDanceRoutine(null);
        }
      }
    };

    void loadRoutine();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    return () => {
      stopCamera();
      voiceRef.current.stop();
    };
  }, []);

  const qualityPercent = useMemo(() => Math.round(confidence.avgVisibility * 100), [confidence.avgVisibility]);
  const activeDanceCheckpoint = useMemo(() => getActiveDanceCheckpoint(danceRoutine, seconds * 1000), [danceRoutine, seconds]);
  const exerciseDescription = useMemo(() => exercise.tips.join(" • "), [exercise]);
  const scorecard = useMemo(() => {
    const fallback: TechniqueScorecard = {
      elbowPath: analysis.form,
      rangeOfMotion: analysis.rom,
      tempoControl: analysis.tempo,
      torsoStability: analysis.stability,
    };
    return techniqueScorecard ?? fallback;
  }, [analysis.form, analysis.rom, analysis.stability, analysis.tempo, techniqueScorecard]);
  const scorecardRows = useMemo(
    () =>
      scorecardLabels(exerciseId).map((item) => ({
        label: item.label,
        score: scorecard[item.valueKey],
      })),
    [exerciseId, scorecard],
  );
  const primaryMetrics = useMemo(() => analysis.metrics.slice(0, 6), [analysis.metrics]);
  const liveIssues = useMemo(() => [...analysis.injuryRisks, ...analysis.corrections, ...analysis.issues].slice(0, 5), [analysis]);

  const cameraViewport = (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-zinc-800 bg-black shadow-[0_30px_100px_rgba(0,0,0,0.45)]",
        cameraLayout === "portrait" ? "aspect-[3/4]" : "aspect-video",
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={cn("h-full w-full object-cover", mirror && "scale-x-[-1]")}
      />
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
        <Badge className="bg-zinc-950/80 text-zinc-100">{exercise.label}</Badge>
        <Badge className={cn("border-none text-white", confidence.ready ? "bg-emerald-500/90" : "bg-amber-500/90")}>
          {confidence.frameQuality === "ready" ? "Ready" : confidence.frameQuality.replaceAll("_", " ")}
        </Badge>
        <Badge className="bg-zinc-950/80 text-zinc-100">{confidence.view}</Badge>
        <Badge className="bg-zinc-950/80 text-zinc-100">{fps} FPS</Badge>
        <Badge className={cn("border-none text-white", text(analysis.overall).replace("text-", "bg-").replace("400", "500/90"))}>
          Score {analysis.overall}
        </Badge>
      </div>

      {trackingPausedReason ? (
        <div className="pointer-events-none absolute inset-x-4 top-16 rounded-2xl border border-amber-500/40 bg-zinc-950/85 p-3 text-sm text-amber-100">
          {trackingPausedReason}
        </div>
      ) : null}

      {!running ? (
        <div className="absolute inset-x-4 bottom-4">
          <SessionSetupCard
            cameraOn={cameraOn}
            loading={loading}
            ready={cameraOn && confidence.ready}
            title={`${exercise.label} setup`}
            description={exerciseDescription}
            calibration={exercise.calibration}
            confidenceMessage={confidence.message}
            onEnableCamera={startCamera}
            onStartSession={startSession}
          />
        </div>
      ) : null}

      {running ? (
        <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 py-3 text-sm text-zinc-200 backdrop-blur">
          <div className="flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5">
            <Timer className="h-4 w-4 text-cyan-300" />
            <span>{seconds}s</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5">
            <Zap className="h-4 w-4 text-orange-300" />
            <span>{repsRef.current} reps</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5">
            <Waves className="h-4 w-4 text-fuchsia-300" />
            <span>{calories} kcal</span>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100" onClick={() => setMirror((value) => !value)}>
              {mirror ? <Monitor className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
              Mirror
            </Button>
            <Button size="sm" variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100" onClick={() => setVoiceEnabled((value) => !value)}>
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              Voice
            </Button>
            <Button size="sm" variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100" onClick={() => setCameraLayout((value) => (value === "landscape" ? "portrait" : "landscape"))}>
              {cameraLayout === "landscape" ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
              Layout
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-700 bg-zinc-900 text-zinc-100"
              onClick={() => setCameraViewMode((value) => (value === "pip" ? "full" : "pip"))}
            >
              {cameraViewMode === "pip" ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              PiP
            </Button>
            <Button size="sm" className="bg-rose-500 text-white hover:bg-rose-600" onClick={() => void stopSession()}>
              Stop session
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.12),_transparent_26%),linear-gradient(180deg,_#09090b,_#111827_45%,_#09090b)] text-zinc-100">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 xl:px-8">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)]">
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-950/70 text-zinc-100">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <Badge className="mb-3 bg-orange-500/15 text-orange-300">{mode === "dance" ? "Dance coach" : "Workout coach"}</Badge>
                    <CardTitle className="text-3xl">{exercise.label}</CardTitle>
                    <CardDescription className="mt-2 max-w-3xl text-zinc-400">{exerciseDescription}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {exercises.map((item) => (
                      <Button
                        key={item.id}
                        size="sm"
                        variant={item.id === exerciseId ? "default" : "outline"}
                        className={cn(item.id === exerciseId ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white" : "border-zinc-700 bg-zinc-950 text-zinc-200")}
                        onClick={() => {
                          if (item.id === exerciseId) return;
                          stopCamera();
                          reset();
                          setExerciseId(item.id);
                        }}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {cameraViewMode === "full" ? cameraViewport : null}

            {cameraViewMode === "minimized" ? (
              <Card className="border-zinc-800 bg-zinc-950/70 text-zinc-100">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">Camera is minimized</p>
                    <p className="text-sm text-zinc-400">Tracking stays active while the viewport is hidden.</p>
                  </div>
                  <Button className="bg-zinc-100 text-zinc-950 hover:bg-white" onClick={() => setCameraViewMode("full")}>
                    Restore camera
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-950/70 text-zinc-100">
              <CardHeader>
                <CardTitle>Live feedback</CardTitle>
                <CardDescription className="text-zinc-400">Safety overrides everything else. The coach only speaks when the issue is stable enough to matter.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={cn("rounded-2xl border p-4", analysis.injuryRisks.length ? "border-rose-500/40 bg-rose-500/10" : analysis.corrections.length ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10")}>
                  <p className="text-lg font-semibold">{feedback}</p>
                  {secondaryFeedback ? <p className="mt-2 text-sm text-zinc-300">{secondaryFeedback}</p> : null}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">What is right</p>
                    <p className="mt-2 text-sm text-zinc-200">{analysis.positives[0] ?? "Hold the current shape and keep the rhythm stable."}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Fix now</p>
                    <p className="mt-2 text-sm text-zinc-200">{analysis.corrections[0] ?? analysis.targetCue ?? "No immediate correction. Stay consistent."}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-cyan-300" />
                    <p className="text-sm font-medium text-zinc-200">AI refinement {coachSource ? `(${coachSource})` : ""}</p>
                  </div>
                  <p className="mt-2 text-sm text-zinc-300">{coachLine || "The grounded rule engine is active. AI refinement appears on meaningful changes and post-set summaries."}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-950/70 text-zinc-100">
              <CardHeader>
                <CardTitle>Calibration and tracking</CardTitle>
                <CardDescription className="text-zinc-400">Rep counting and posture judgments only run when frame quality is ready.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Frame quality</p>
                    <p className="mt-2 text-lg font-semibold capitalize">{confidence.frameQuality.replaceAll("_", " ")}</p>
                    <p className="mt-2 text-sm text-zinc-400">{confidence.message}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Camera profile</p>
                    <p className="mt-2 text-lg font-semibold">{cameraProfileLabel}</p>
                    <p className="mt-2 text-sm text-zinc-400">Allowed views: {confidence.allowedViews.join(", ")}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Tracking confidence</span>
                      <span className="font-medium text-zinc-100">{qualityPercent}%</span>
                    </div>
                    <Progress value={qualityPercent} className="h-2 bg-zinc-800" />
                  </div>
                  <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-3">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">View: <span className="font-medium text-zinc-100">{confidence.view}</span></div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">Brightness: <span className="font-medium text-zinc-100">{Math.round(confidence.brightness)}</span></div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">Motion: <span className="font-medium text-zinc-100">{confidence.motion.toFixed(1)}</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-950/70 text-zinc-100">
              <CardHeader>
                <CardTitle>Score breakdown</CardTitle>
                <CardDescription className="text-zinc-400">The live score is composed from deterministic movement metrics, not LLM guesses.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {scorecardRows.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-zinc-400">{item.label}</p>
                        <span className={cn("text-sm font-semibold", text(item.score))}>{item.score}</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                        <div className={cn("h-full rounded-full bg-gradient-to-r", bar(item.score))} style={{ width: `${Math.max(4, item.score)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {primaryMetrics.map((metric) => (
                    <div key={`${metric.name}-${metric.detail}`} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-100">{metric.name}</p>
                          <p className="text-xs text-zinc-500">{metric.detail}</p>
                        </div>
                        <span className={cn("text-sm font-semibold", text(metric.score))}>{metric.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {liveIssues.length ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Active issue history</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {liveIssues.map((issue) => (
                        <Badge key={issue} variant="outline" className="border-zinc-700 text-zinc-200">
                          {issue}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {mode === "dance" ? (
              <Card className="border-zinc-800 bg-zinc-950/70 text-zinc-100">
                <CardHeader>
                  <CardTitle>Routine sync</CardTitle>
                  <CardDescription className="text-zinc-400">Packaged routine assets drive the active phrase, timing score, and post-run breakdown.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-sm font-medium text-zinc-100">{danceRoutine?.name ?? "Loading routine"}</p>
                    <p className="mt-1 text-sm text-zinc-400">{activeDanceCheckpoint?.step.cue ?? "Waiting for the first phrase."}</p>
                  </div>
                  {danceComparison ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Pose</p><p className="mt-2 text-2xl font-semibold">{danceComparison.poseSimilarity}</p></div>
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Timing</p><p className="mt-2 text-2xl font-semibold">{danceComparison.timingScore}</p></div>
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Transition</p><p className="mt-2 text-2xl font-semibold">{danceComparison.transitionQuality}</p></div>
                    </div>
                  ) : null}
                  {danceSegmentBreakdown.length ? (
                    <div className="space-y-2">
                      {danceSegmentBreakdown.map((segment) => (
                        <div key={segment.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-zinc-100">{segment.label}</p>
                            <Badge className="bg-zinc-100 text-zinc-950">Overall {segment.overall}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-zinc-400">Timing {segment.timing} • Transition {segment.transition}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {(summary || summaryInsights.length || summaryPractice.length || topMistakes.length || correctivePlan.length) ? (
              <Card className="border-zinc-800 bg-zinc-950/70 text-zinc-100">
                <CardHeader>
                  <CardTitle>Post-session review</CardTitle>
                  <CardDescription className="text-zinc-400">Grounded in saved issue history, frame-quality stats, and post-set aggregates.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {summary ? <p className="text-sm leading-6 text-zinc-200">{summary}</p> : null}
                  {summaryInsights.length ? (
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.24em] text-zinc-500">Key insights</p>
                      <div className="space-y-2">
                        {summaryInsights.map((item) => (
                          <div key={item} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200">{item}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {topMistakes.length ? (
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.24em] text-zinc-500">Top mistakes</p>
                      <div className="space-y-2">
                        {topMistakes.map((item) => (
                          <div key={item.mistake} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                            <p className="font-medium text-zinc-100">{item.mistake}</p>
                            <p className="mt-1 text-sm text-zinc-400">{item.whyItHurtsPerformance}</p>
                            <p className="mt-2 text-sm text-zinc-200">{item.exactFix}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {correctivePlan.length ? (
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.24em] text-zinc-500">5 minute corrective block</p>
                      <div className="space-y-2">
                        {correctivePlan.map((item) => (
                          <div key={`${item.minuteRange}-${item.drill}`} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                            <p className="font-medium text-zinc-100">{item.minuteRange} • {item.drill}</p>
                            <p className="mt-1 text-sm text-zinc-300">{item.focusCue}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {summaryPractice.length ? (
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.24em] text-zinc-500">Next session focus</p>
                      <div className="space-y-2">
                        {summaryPractice.map((item) => (
                          <div key={item} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200">{item}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>

      {cameraViewMode === "pip" ? (
        <div
          className="fixed z-50 w-[340px] max-w-[calc(100vw-32px)]"
          style={{ right: `${pipPos.x}px`, bottom: `${pipPos.y}px` }}
          onPointerMove={onPipPointerMove}
          onPointerUp={onPipPointerUp}
        >
          <div className="overflow-hidden rounded-[28px] border border-zinc-700 bg-zinc-950/95 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 text-sm text-zinc-200">
              <button type="button" className="flex items-center gap-2" onPointerDown={onPipPointerDown}>
                <GripVertical className="h-4 w-4 text-zinc-500" />
                Camera monitor
              </button>
              <div className="flex gap-2">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-300 hover:bg-zinc-800" onClick={() => setCameraViewMode("minimized")}>
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-300 hover:bg-zinc-800" onClick={() => setCameraViewMode("full")}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {cameraViewport}
          </div>
        </div>
      ) : null}
    </div>
  );
}
