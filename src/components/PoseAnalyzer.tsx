"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, CameraOff, Mic, RotateCcw, Timer, Volume2, VolumeX, Waves, Zap } from "lucide-react";
import { toast } from "sonner";
import { SessionSetupCard } from "@/components/coach/SessionSetupCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { compareDanceFrame } from "@/lib/dance/comparator";
import type { DanceComparison, DanceRoutinePack } from "@/lib/dance/types";
import { createVoiceFeedbackController } from "@/lib/feedback/voice";
import { useUserProfile } from "@/hooks/useUserProfile";
import { evaluateConfidence, smoothLandmarks } from "@/lib/pose/confidence";
import { analyzeExercise, getPhaseForExercise, POSE_CONNECTIONS, POSE_EXERCISES } from "@/lib/pose/exercises";
import { average } from "@/lib/pose/math";
import { evaluateSafety } from "@/lib/pose/safety";
import type { ExerciseId, FrameAnalysis, Landmark } from "@/lib/pose/types";

type Props = { mode?: "workout" | "dance" };
type FeedbackEvent = { timestamp: number; type: string; message: string; severity: "critical" | "warning" | "info"; source: "rule_engine" | "llm_coach" | "system" };
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
  if (side === "left") return "Left arm";
  if (side === "right") return "Right arm";
  if (side === "both") return "Both arms";
  return "Body";
}

function normalizeDanceRoutine(raw: any): DanceRoutinePack | null {
  if (!raw?.id || !raw?.name) {
    return null;
  }

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
    checkpoints: checkpoints
      .filter((item: any) => item && typeof item.timeMs === "number" && typeof item.cue === "string")
      .sort((a: any, b: any) => a.timeMs - b.timeMs),
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
  if (safety.blocked || safety.severity === "critical") {
    return { message: safety.messages[0], severity: "critical" as const, source: "rule_engine" as const };
  }

  if (exerciseId === "bicep_curl") {
    const prefix = `${trackedSideLabel(frame.trackedSide)}: `;
    if (frame.injuryRisks.length) {
      return { message: `${prefix}${frame.injuryRisks[0]}`, severity: "warning" as const, source: "rule_engine" as const };
    }
    if (safety.severity === "warning" && safety.messages.length) {
      return { message: `${prefix}${safety.messages[0]}`, severity: "warning" as const, source: "rule_engine" as const };
    }
    if (frame.corrections.length) {
      return { message: `${prefix}${frame.corrections[0]}`, severity: "warning" as const, source: "rule_engine" as const };
    }
    if (frame.positives.length) {
      return { message: `${prefix}${frame.positives[0]}`, severity: "info" as const, source: "system" as const };
    }
  }

  if (exerciseId === "dance_basic") {
    const prefix = "Dance frame: ";
    if (frame.injuryRisks.length) {
      return { message: `${prefix}${frame.injuryRisks[0]}`, severity: "warning" as const, source: "rule_engine" as const };
    }
    if (safety.severity === "warning" && safety.messages.length) {
      return { message: `${prefix}${safety.messages[0]}`, severity: "warning" as const, source: "rule_engine" as const };
    }
    if (frame.corrections.length) {
      return { message: `${prefix}${frame.corrections[0]}`, severity: "warning" as const, source: "rule_engine" as const };
    }
    if (frame.positives.length) {
      return { message: `${prefix}${frame.positives[0]}`, severity: "info" as const, source: "system" as const };
    }
  }

  if (safety.severity === "warning" && safety.messages.length) {
    return { message: safety.messages[0], severity: "warning" as const, source: "rule_engine" as const };
  }
  if (frame.corrections.length) {
    return { message: frame.corrections[0], severity: "warning" as const, source: "rule_engine" as const };
  }
  if (frame.primaryFocus) {
    return { message: frame.primaryFocus, severity: "info" as const, source: "system" as const };
  }
  return { message: frame.targetCue || "Strong rep. Keep the rhythm.", severity: "info" as const, source: "system" as const };
}

declare global {
  interface Window {
    Pose?: any;
    Camera?: any;
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Document is not available"));
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureMediapipeLoaded() {
  await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
  await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js");
  if (typeof window === "undefined" || !window.Pose || !window.Camera) {
    throw new Error("MediaPipe scripts did not initialize correctly.");
  }
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
  const poseRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const smoothedRef = useRef<Landmark[] | null>(null);
  const runningRef = useRef(false);
  const mirrorRef = useRef(true);
  const exerciseIdRef = useRef<ExerciseId>(exerciseId);
  const exerciseRef = useRef(exercise);
  const profileRef = useRef(profile);
  const phaseRef = useRef("idle");
  const phaseAtRef = useRef(0);
  const sawBottomRef = useRef(false);
  const lastRepAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const repsRef = useRef(0);
  const voiceRef = useRef(createVoiceFeedbackController());
  const repDataRef = useRef<any[]>([]);
  const eventsRef = useRef<FeedbackEvent[]>([]);
  const framesRef = useRef<FrameAnalysis[]>([]);
  const curveRef = useRef<number[]>([]);
  const danceSegmentRef = useRef<Record<string, { label: string; scores: number[]; timing: number[]; transition: number[] }>>({});
  const lastCoachRef = useRef(0);
  const savingRef = useRef(false);
  const lastFeedbackRef = useRef("");
  const [cameraOn, setCameraOn] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [fps, setFps] = useState(0);
  const [confidence, setConfidence] = useState({ ready: false, avgVisibility: 0, message: "Enable the camera to calibrate." });
  const [analysis, setAnalysis] = useState<FrameAnalysis>(EMPTY);
  const [feedback, setFeedback] = useState("Enable the camera to calibrate.");
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
  const [seconds, setSeconds] = useState(0);
  const [calories, setCalories] = useState(0);

  const pushFeedback = (message: string, severity: FeedbackEvent["severity"], source: FeedbackEvent["source"]) => {
    setFeedback(message);
    if (message !== lastFeedbackRef.current) {
      lastFeedbackRef.current = message;
      eventsRef.current.push({ timestamp: Math.max(0, Date.now() - startedAtRef.current), type: severity === "critical" ? "stop" : "cue", message, severity, source });
      voiceRef.current.speak(message, severity === "critical" ? "critical" : severity === "warning" ? "warning" : "info");
    }
  };

  const reset = () => {
    phaseRef.current = "idle";
    phaseAtRef.current = 0;
    sawBottomRef.current = false;
    lastRepAtRef.current = 0;
    repsRef.current = 0;
    repDataRef.current = [];
    eventsRef.current = [];
    framesRef.current = [];
    curveRef.current = [];
    danceSegmentRef.current = {};
    lastCoachRef.current = 0;
    savingRef.current = false;
    lastFeedbackRef.current = "";
    setAnalysis(EMPTY);
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

  const maybeRep = (phase: string, frame: FrameAnalysis) => {
    const currentId = exerciseIdRef.current;
    const previous = phaseRef.current;
    const now = Date.now();
    if (!phaseAtRef.current) phaseAtRef.current = now;
    if (phase === previous) return;
    if (["squat", "pushup", "lunge"].includes(currentId) && phase === "bottom") {
      sawBottomRef.current = true;
    }
    if (currentId === "bicep_curl" && phase === "top") {
      sawBottomRef.current = true;
    }
    if (currentId === "jumping_jack" && phase === "open") {
      sawBottomRef.current = true;
    }
    const done =
      (["squat", "pushup", "lunge"].includes(currentId) && sawBottomRef.current && phase === "top") ||
      (currentId === "bicep_curl" && sawBottomRef.current && phase === "bottom") ||
      (currentId === "jumping_jack" && sawBottomRef.current && phase === "closed");
    if (done) {
      // Debounce noisy landmark transitions to avoid false positives.
      if (now - lastRepAtRef.current < 450) {
        phaseRef.current = phase;
        phaseAtRef.current = now;
        return;
      }
      sawBottomRef.current = false;
      lastRepAtRef.current = now;
      repsRef.current += 1;
      repDataRef.current.push({
        exerciseId: currentId,
        repNumber: repsRef.current,
        phase,
        formScore: frame.form,
        romScore: frame.rom,
        tempoScore: frame.tempo,
        safetyScore: frame.safety,
        corrections: frame.issues.slice(0, 4),
        durationMs: now - phaseAtRef.current,
        timestamps: { startMs: Math.max(0, phaseAtRef.current - startedAtRef.current), endMs: Math.max(0, now - startedAtRef.current) },
      });
      setFeedback(`Rep ${repsRef.current} counted. ${frame.corrections[0] ?? frame.positives[0] ?? "Keep moving with control."}`);
    }
    phaseRef.current = phase;
    phaseAtRef.current = now;
  };

  const maybeCoach = async (frame: FrameAnalysis) => {
    const interval =
      exerciseIdRef.current === "bicep_curl"
        ? 5000
        : exerciseIdRef.current === "dance_basic"
          ? 6000
          : 12000;
    if (!runningRef.current || Date.now() - lastCoachRef.current < interval) return;
    lastCoachRef.current = Date.now();
    try {
      const response = await fetch("/api/coach/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseType: exerciseIdRef.current,
          repsSoFar: repsRef.current,
          phase: frame.phase,
          confidence: confidence.avgVisibility,
          currentIssues: [...frame.injuryRisks, ...frame.corrections, ...frame.issues].slice(0, 6),
          currentMetrics: frame.metrics.slice(0, 8).map((metric) => ({
            name: metric.name,
            score: metric.score,
            detail: metric.detail,
            value: metric.value,
            target: metric.target,
          })),
          recentScores: repDataRef.current.slice(-5).map((rep: any) => ({ form: rep.formScore, rom: rep.romScore, tempo: rep.tempoScore, safety: rep.safetyScore })),
        }),
      });
      const data = await parseApiResponse(response);
      if (response.ok && data.feedback) {
        setCoachLine(data.feedback);
        setCoachSource(data.provider === "groq" || data.provider === "openai" ? "llm" : "fallback");
        pushFeedback(data.feedback, "info", "llm_coach");
      } else if (!response.ok && (frame.corrections.length || frame.injuryRisks.length || frame.issues.length)) {
        // Demo/auth-not-configured fallback: still provide actionable advice.
        const fallback = frame.injuryRisks[0] ?? frame.corrections[0] ?? frame.issues[0];
        setCoachLine(fallback);
        setCoachSource("fallback");
        pushFeedback(fallback, "warning", "rule_engine");
      }
    } catch {}
  };

  const handleLandmarks = (landmarks: Landmark[] | null) => {
    const currentId = exerciseIdRef.current;
    const currentExercise = exerciseRef.current;
    draw(overlayRef.current, videoRef.current, landmarks, analysis.overall, mirrorRef.current);
    if (!landmarks?.length) {
      setConfidence({ ready: false, avgVisibility: 0, message: "Camera lost. Step back into frame." });
      setTrackingPausedReason(runningRef.current ? "Camera lost. Scoring is paused until you are fully back in frame." : null);
      if (runningRef.current) pushFeedback("Camera lost. Step back into frame.", "warning", "system");
      return;
    }
    const smoothed = smoothLandmarks(smoothedRef.current, landmarks);
    smoothedRef.current = smoothed;
    const gate = evaluateConfidence(smoothed, currentId);
    setConfidence(gate);
    if (!runningRef.current) {
      setFeedback(gate.message);
      setTrackingPausedReason(null);
      draw(overlayRef.current, videoRef.current, smoothed, 80, mirrorRef.current);
      return;
    }
    const shouldPauseScoring = !gate.ready || gate.avgVisibility < 0.55;
    setTrackingPausedReason(shouldPauseScoring ? `${gate.message}. Rep counting is paused until tracking recovers.` : null);
    if (!gate.ready) {
      pushFeedback(gate.message, "warning", "system");
      // Keep analysis active on imperfect framing unless confidence is extremely low.
      if (gate.avgVisibility < 0.35) return;
    }
    if (!smoothed.length) {
      return;
    }
    const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
    const activeDanceCheckpoint = currentId === "dance_basic" ? getActiveDanceCheckpoint(danceRoutine, elapsedMs) : null;
    const frame = analyzeExercise(
      currentId,
      smoothed,
      activeDanceCheckpoint?.index ?? Math.floor(elapsedMs / 4000),
      activeDanceCheckpoint?.step.cue,
    );
    const safety = evaluateSafety(currentId, smoothed, [...(profileRef.current?.injuries ?? []), ...(profileRef.current?.painPoints ?? [])]);
    const resolved = { ...frame, safety: Math.max(0, frame.safety - (safety.severity === "critical" ? 35 : safety.severity === "warning" ? 12 : 0)), overall: Math.max(0, frame.overall - (safety.severity === "critical" ? 25 : safety.severity === "warning" ? 10 : 0)) };
    framesRef.current.push(resolved);
    if (framesRef.current.length % 15 === 0) curveRef.current.push(resolved.overall);
    if (!shouldPauseScoring) {
      maybeRep(getPhaseForExercise(currentId, smoothed), resolved);
    }
    setAnalysis(resolved);
    if (currentId === "dance_basic" && danceRoutine?.segments?.length) {
      const comparison = compareDanceFrame({
        landmarks: smoothed,
        routine: danceRoutine,
        elapsedMs,
        analysis: resolved,
      });
      setDanceComparison(comparison);
      if (comparison) {
        const bucket = danceSegmentRef.current[comparison.segment.id] ?? {
          label: comparison.segment.label,
          scores: [],
          timing: [],
          transition: [],
        };
        bucket.scores.push(comparison.overall);
        bucket.timing.push(comparison.timingScore);
        bucket.transition.push(comparison.transitionQuality);
        danceSegmentRef.current[comparison.segment.id] = bucket;
      }
    } else {
      setDanceComparison(null);
    }
    setSeconds(Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    setCalories(Math.round((Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000)) / 60) * (currentExercise.category === "dance" || currentExercise.id === "jumping_jack" ? 8.5 : 6.5)));
    draw(overlayRef.current, videoRef.current, smoothed, resolved.overall, mirrorRef.current);
    const liveCue = selectLiveCue(currentId, resolved, safety);
    pushFeedback(liveCue.message, liveCue.severity, liveCue.source);
    if (!shouldPauseScoring) {
      void maybeCoach(resolved);
    }
  };

  const startCamera = async () => {
    if (cameraOn) return;
    setLoading(true);
    try {
      await ensureMediapipeLoaded();
      const video = videoRef.current;
      if (!video) return;
      const pose = new window.Pose({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
      // Keep pose coordinates in camera space and control mirroring in UI/canvas only.
      pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6, selfieMode: false });
      let last = performance.now();
      pose.onResults((results: any) => {
        const now = performance.now();
        setFps(Math.round(1000 / Math.max(now - last, 1)));
        last = now;
        handleLandmarks((results.poseLandmarks as Landmark[] | undefined) ?? null);
      });
      const camera = new window.Camera(video, { onFrame: async () => pose.send({ image: video }), width: 1280, height: 720 });
      await camera.start();
      poseRef.current = pose;
      cameraRef.current = camera;
      setCameraOn(true);
      setFeedback("Camera active. Finish calibration before starting the session.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to access camera");
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    try {
      cameraRef.current?.stop?.();
      poseRef.current?.close?.();
    } catch {}
    cameraRef.current = null;
    poseRef.current = null;
    smoothedRef.current = null;
    runningRef.current = false;
    setCameraOn(false);
    setRunning(false);
    setConfidence({ ready: false, avgVisibility: 0, message: "Enable the camera to calibrate." });
    setAnalysis(EMPTY);
    draw(overlayRef.current, videoRef.current, null, 0, mirror);
  };

  const startSession = () => {
    if (!cameraOn) return;
    if (!confidence.ready) {
      pushFeedback(`${confidence.message}. Starting anyway — improve framing for better accuracy.`, "warning", "system");
    }
    reset();
    startedAtRef.current = Date.now();
    phaseAtRef.current = Date.now();
    phaseRef.current = getPhaseForExercise(exerciseIdRef.current, smoothedRef.current ?? []);
    runningRef.current = true;
    setRunning(true);
    setTrackingPausedReason(confidence.ready ? null : `${confidence.message}. Rep counting will stay paused until calibration recovers.`);
    pushFeedback("Session live. Keep your full body in frame and follow the cue.", "info", "system");
  };

  const stopSession = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    runningRef.current = false;
    setRunning(false);
    try {
      const pick = (selector: (frame: FrameAnalysis) => number) => Math.round(average(framesRef.current.map(selector)));
      const scoring = { form: pick((f) => f.form), rom: pick((f) => f.rom), tempo: pick((f) => f.tempo), stability: pick((f) => f.stability), symmetry: pick((f) => f.symmetry), consistency: pick((f) => f.consistency), endurance: pick((f) => f.endurance), safety: pick((f) => f.safety) };
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mode === "dance" ? "dance" : exerciseRef.current.category === "cardio" ? "cardio" : "strength",
          exerciseType: exerciseIdRef.current,
          duration: Math.max(1, Math.round(seconds / 60)),
          caloriesBurned: calories,
          totalReps: repsRef.current,
          compositeScore: analysis.overall,
          scoringBreakdown: scoring,
          fatigueCurve: curveRef.current,
          summary: coachLine || feedback,
          exercises: [{ exerciseId: exerciseIdRef.current, sets: exerciseRef.current.repBased ? 1 : 0, reps: repsRef.current, duration: seconds, formScore: scoring.form, romScore: scoring.rom, tempoScore: scoring.tempo, safetyScore: scoring.safety, corrections: Array.from(new Set(eventsRef.current.map((event) => event.message))).slice(0, 8) }],
          repData: repDataRef.current,
          feedbackEvents: eventsRef.current,
        }),
      });
      const data = await parseApiResponse(response);
      if (!response.ok) throw new Error(data.error || "Failed to save session");
      const topIssues = Array.from(new Set(eventsRef.current.filter((event) => event.severity !== "info").map((event) => event.message))).slice(0, 6);
      const topStrengths = framesRef.current.length
        ? [
            scoring.form >= 80 ? "Form quality stayed strong for most reps." : "",
            scoring.rom >= 80 ? "Range of motion was consistent." : "",
            scoring.safety >= 85 ? "Movement stayed safe and controlled." : "",
          ].filter(Boolean)
        : [];
      const summaryRes = await fetch("/api/coach/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: data.sessionId,
          exerciseType: exerciseIdRef.current,
          durationMinutes: Math.max(1, Math.round(seconds / 60)),
          totalReps: repsRef.current,
          scoringBreakdown: scoring,
          topIssues,
          topStrengths,
          sessionSummary: `Exercise ${exerciseIdRef.current}, ${repsRef.current} reps, overall ${analysis.overall}, issues: ${topIssues.join("; ") || "none"}`,
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
      } else if (summaryData?.error) {
        toast.error(String(summaryData.error));
      }
      if (mode === "dance") {
        setDanceSegmentBreakdown(
          Object.entries(danceSegmentRef.current).map(([id, value]) => ({
            id,
            label: value.label,
            overall: Math.round(average(value.scores)),
            timing: Math.round(average(value.timing)),
            transition: Math.round(average(value.transition)),
          })),
        );
      }
      pushFeedback("Session saved. Review the summary before restarting.", "info", "system");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save session");
    } finally {
      stopCamera();
    }
  };

  useEffect(() => {
    reset();
    setFeedback("Exercise changed. Recalibrate before starting again.");
  }, [exerciseId]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    mirrorRef.current = mirror;
  }, [mirror]);

  useEffect(() => {
    exerciseIdRef.current = exerciseId;
    exerciseRef.current = exercise;
  }, [exercise, exerciseId]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    voiceRef.current.setEnabled(voiceEnabled);
  }, [voiceEnabled]);

  useEffect(() => {
    if (mode !== "dance") {
      setDanceRoutine(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/dance/routine", { cache: "no-store" });
        const data = await parseApiResponse(response);
        if (!response.ok || !data?.routine || cancelled) return;
        setDanceRoutine(normalizeDanceRoutine(data.routine));
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => () => {
    stopCamera();
    voiceRef.current.stop();
  }, []);

  const currentDanceCheckpoint = useMemo(
    () => (mode === "dance" ? getActiveDanceCheckpoint(danceRoutine, seconds * 1000) : null),
    [danceRoutine, mode, seconds],
  );
  const currentScorecardLabels = useMemo(() => scorecardLabels(exerciseId), [exerciseId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{mode === "dance" ? "Dance Coach" : "Workout Coach"}</h1>
            <p className="mt-1 text-sm text-zinc-400">Calibration, live scoring, safety rules, AI feedback, and saved session summaries.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {exercises.map((item) => (
              <Button key={item.id} variant={exerciseId === item.id ? "default" : "outline"} className={cn("rounded-full border-zinc-700 bg-zinc-900/70 text-zinc-100", exerciseId === item.id && "border-orange-500 bg-gradient-to-r from-orange-500 to-rose-500 text-white")} onClick={() => setExerciseId(item.id)}>
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
          <Card className="overflow-hidden border-zinc-800 bg-zinc-900/85">
            <CardContent className="p-0">
              <div className="relative aspect-video bg-black">
                <video ref={videoRef} className={cn("absolute inset-0 h-full w-full object-cover", mirror && "-scale-x-100")} playsInline muted />
                <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                {!running ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/55 p-4">
                    <SessionSetupCard
                      cameraOn={cameraOn}
                      loading={loading}
                      ready={confidence.ready}
                      title={exercise.label}
                      description={mode === "dance" ? danceRoutine?.description ?? "Lock in your frame before the phrase starts." : "Finish calibration before the session starts so rep counting stays reliable."}
                      calibration={exercise.calibration}
                      confidenceMessage={confidence.message}
                      onEnableCamera={startCamera}
                      onStartSession={startSession}
                    />
                  </div>
                ) : null}
                {!cameraOn ? <div className="absolute inset-0 flex items-center justify-center"><div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-8 text-center"><Badge className="bg-orange-500/15 text-orange-300">Calibration required</Badge><p className="text-lg font-semibold">{exercise.label}</p><p className="max-w-sm text-sm text-zinc-400">{exercise.calibration.join(" • ")}</p><Button className="w-full gap-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600" onClick={startCamera} disabled={loading}><Camera className="h-4 w-4" />{loading ? "Loading camera..." : "Enable camera"}</Button></div></div> : null}
                {cameraOn ? <div className="absolute left-4 top-4 flex gap-3"><div className="rounded-2xl border border-zinc-700 bg-zinc-950/85 px-4 py-3"><p className="text-xs text-zinc-400">Confidence</p><p className="text-xl font-semibold">{Math.round(confidence.avgVisibility * 100)}%</p></div><div className="rounded-2xl border border-zinc-700 bg-zinc-950/85 px-4 py-3"><p className="text-xs text-zinc-400">FPS</p><p className="text-xl font-semibold">{fps || "-"}</p></div><div className="rounded-2xl border border-zinc-700 bg-zinc-950/85 px-4 py-3"><p className="text-xs text-zinc-400">Score</p><p className={cn("text-xl font-semibold", text(analysis.overall))}>{analysis.overall}</p></div></div> : null}
                {cameraOn ? <div className="absolute bottom-4 left-4 right-4 rounded-3xl border border-zinc-700 bg-zinc-950/90 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-medium">{trackingPausedReason || feedback}</p><p className="mt-1 text-xs text-zinc-400">{trackingPausedReason || coachLine || summary || confidence.message}</p></div><div className="flex flex-wrap items-center gap-3 text-sm"><span className="inline-flex items-center gap-1"><Timer className="h-4 w-4" />{Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, "0")}</span><span className="inline-flex items-center gap-1"><Zap className="h-4 w-4 text-amber-400" />{repsRef.current} reps</span><span className="inline-flex items-center gap-1"><Waves className="h-4 w-4 text-cyan-400" />{calories} kcal</span><Button variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100" onClick={() => setMirror((value) => !value)}>Mirror {mirror ? "on" : "off"}</Button><Button variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100" onClick={() => setVoiceEnabled((value) => !value)}>{voiceEnabled ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}Voice {voiceEnabled ? "on" : "off"}</Button>{!running ? <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600" onClick={startSession}>Start session</Button> : <Button className="bg-gradient-to-r from-rose-500 to-red-500 text-white hover:from-rose-600 hover:to-red-600" onClick={() => void stopSession()}>Stop & save</Button>}<Button variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100" onClick={stopCamera}><CameraOff className="mr-2 h-4 w-4" />Close</Button></div></div></div> : null}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-900/85">
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-400" />Calibration</CardTitle><CardDescription>{exercise.label} readiness gate before analysis starts.</CardDescription></CardHeader>
              <CardContent className="space-y-3">{exercise.calibration.map((item) => <div key={item} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm"><span>{item}</span><Badge variant="outline" className={cn("border-zinc-700 text-zinc-300", confidence.ready && "border-emerald-500/40 text-emerald-300")}>{confidence.ready ? "ready" : "check"}</Badge></div>)}<div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-300">{confidence.message}</div></CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/85">
              <CardHeader><CardTitle>Posture guide</CardTitle><CardDescription>{exercise.label} setup cues to keep the rep strict and safe.</CardDescription></CardHeader>
              <CardContent className="space-y-2 text-sm text-zinc-300">
                {exercise.tips.map((item) => (
                  <div key={item} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>

            {mode === "dance" ? (
              <Card className="border-zinc-800 bg-zinc-900/85">
                <CardHeader>
                  <CardTitle>Routine cue</CardTitle>
                  <CardDescription>{danceRoutine?.name ?? "Seeded dance routine"} live phrase target.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-zinc-300">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                    {currentDanceCheckpoint?.step.cue ?? "Start the session to lock onto the current phrase."}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {currentDanceCheckpoint ? `Checkpoint ${currentDanceCheckpoint.index + 1}` : "No routine checkpoint loaded"}
                  </div>
                  {danceComparison ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
                        <p className="text-zinc-400">Segment</p>
                        <p className="mt-1 font-medium text-zinc-100">{danceComparison.segment.label}</p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
                        <p className="text-zinc-400">Pose similarity</p>
                        <p className="mt-1 font-medium text-zinc-100">{danceComparison.poseSimilarity}/100</p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
                        <p className="text-zinc-400">Timing</p>
                        <p className="mt-1 font-medium text-zinc-100">{danceComparison.timingScore}/100</p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
                        <p className="text-zinc-400">Transition</p>
                        <p className="mt-1 font-medium text-zinc-100">{danceComparison.transitionQuality}/100</p>
                      </div>
                    </div>
                  ) : null}
                  {danceComparison?.notes.length ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
                      {danceComparison.notes[0]}
                    </div>
                  ) : null}
                  {danceRoutine?.audioUrl ? <audio className="w-full" controls src={danceRoutine.audioUrl} preload="none" /> : null}
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-zinc-800 bg-zinc-900/85">
              <CardHeader><CardTitle>Live metrics</CardTitle><CardDescription>Form, ROM, tempo, stability, and safety from the modular pose engine.</CardDescription></CardHeader>
              <CardContent className="space-y-4">{analysis.metrics.length ? analysis.metrics.map((item) => <div key={item.name} className="space-y-2"><div className="flex items-center justify-between text-sm"><div><p className="font-medium text-zinc-100">{item.name}</p><p className="text-xs text-zinc-400">{item.detail}</p></div><span className={cn("font-semibold", text(item.score))}>{item.score}</span></div><div className="h-2 overflow-hidden rounded-full bg-zinc-800"><div className={cn("h-full rounded-full bg-gradient-to-r", bar(item.score))} style={{ width: `${item.score}%` }} /></div></div>) : <p className="text-sm text-zinc-400">Start the camera and complete calibration to begin scoring.</p>}</CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card className="border-zinc-800 bg-zinc-900/85"><CardContent className="pt-6"><p className="text-xs text-zinc-400">Composite</p><p className={cn("mt-2 text-3xl font-semibold", text(analysis.overall))}>{analysis.overall}</p><Progress className="mt-3 h-2 bg-zinc-800" value={analysis.overall} /></CardContent></Card>
              <Card className="border-zinc-800 bg-zinc-900/85"><CardContent className="pt-6"><p className="text-xs text-zinc-400">Phase</p><p className="mt-2 text-3xl font-semibold capitalize">{analysis.phase}</p><p className="mt-1 text-xs text-zinc-400">{exerciseId === "bicep_curl" || exerciseId === "dance_basic" ? trackedSideLabel(analysis.trackedSide) : "Whole-body tracking"}</p><Button variant="ghost" className="mt-3 h-auto p-0 text-xs text-zinc-400 hover:bg-transparent" onClick={reset}><RotateCcw className="mr-1 h-3 w-3" />Reset local metrics</Button></CardContent></Card>
            </div>

            <Card className="border-zinc-800 bg-zinc-900/85">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-cyan-400" />
                  Coach feedback
                </CardTitle>
                <CardDescription>Rules first, AI prompts with personalized cues and post-session fixes. Voice guidance is {voiceEnabled ? "enabled" : "muted"}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                  <p className="font-medium">Current cue</p>
                  <p className="mt-1 text-zinc-400">{trackingPausedReason || feedback}</p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                  <p className="font-medium">Coach line</p>
                  <p className="mt-1 text-zinc-400">{coachLine || "The coach will step in once there is enough live data."}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-wide text-zinc-500">
                    Source: {coachSource === "llm" ? "LLM coaching" : coachSource === "fallback" ? "Rule fallback" : "pending"}
                  </p>
                </div>

                {analysis.positives.length ? (
                  <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3">
                    <p className="font-medium text-emerald-300">What you are doing right</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-300">
                      {analysis.positives.slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {analysis.corrections.length ? (
                  <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-3">
                    <p className="font-medium text-amber-300">Fix now</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-300">
                      {analysis.corrections.slice(0, 4).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {analysis.injuryRisks.length ? (
                  <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3">
                    <p className="font-medium text-rose-300">Injury watch</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-300">
                      {analysis.injuryRisks.slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {summary ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                    <p className="font-medium">Session report</p>
                    <p className="mt-1 text-zinc-300">{summary}</p>

                    {techniqueScorecard ? (
                      <div className="mt-3">
                        <p className="font-medium text-zinc-200">Technique scorecard</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          {currentScorecardLabels.map((scoreItem) => (
                            <div key={scoreItem.label} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
                              <p className="text-zinc-400">{scoreItem.label}</p>
                              <p className="mt-1 font-semibold text-zinc-100">{Math.round(techniqueScorecard[scoreItem.valueKey])}/100</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {topMistakes.length ? (
                      <div className="mt-3">
                        <p className="font-medium text-zinc-200">Top 3 mistakes and exact fixes</p>
                        <div className="mt-2 space-y-2">
                          {topMistakes.slice(0, 3).map((mistakeItem, index) => (
                            <div key={`${mistakeItem.mistake}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
                              <p className="text-zinc-100">
                                {index + 1}. {mistakeItem.mistake}
                              </p>
                              <p className="mt-1 text-zinc-400">Why: {mistakeItem.whyItHurtsPerformance}</p>
                              <p className="mt-1 text-zinc-300">Fix: {mistakeItem.exactFix}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {correctivePlan.length ? (
                      <div className="mt-3">
                        <p className="font-medium text-zinc-200">5-minute corrective practice plan</p>
                        <div className="mt-2 space-y-2">
                          {correctivePlan.slice(0, 3).map((block, index) => (
                            <div key={`${block.minuteRange}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
                              <p className="text-zinc-100">
                                {block.minuteRange} — {block.drill}
                              </p>
                              <p className="mt-1 text-zinc-300">Focus cue: {block.focusCue}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {mode === "dance" && danceSegmentBreakdown.length ? (
                      <div className="mt-3">
                        <p className="font-medium text-zinc-200">Segment breakdown</p>
                        <div className="mt-2 space-y-2">
                          {danceSegmentBreakdown.map((segment) => (
                            <div key={segment.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
                              <p className="text-zinc-100">{segment.label}</p>
                              <p className="mt-1 text-zinc-400">Overall {segment.overall}/100, timing {segment.timing}/100, transition {segment.transition}/100</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {summaryInsights.length ? (
                      <div className="mt-3">
                        <p className="font-medium text-zinc-200">Highlights</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-zinc-400">
                          {summaryInsights.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {summaryPractice.length ? (
                      <div className="mt-3">
                        <p className="font-medium text-zinc-200">Practice next</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-zinc-400">
                          {summaryPractice.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
