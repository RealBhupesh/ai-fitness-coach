"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { Brain, CheckCircle2, Clipboard, GripVertical, Maximize2, Mic, Minimize2, Monitor, RotateCcw, Smartphone, Target, Timer, Volume2, VolumeX, Waves, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { SessionSetupCard } from "@/components/coach/SessionSetupCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createCameraController, getCameraProfile } from "@/lib/camera/controller";
import { buildUnreliableCameraGuidance } from "@/lib/camera/guidance";
import { compareDanceFrame } from "@/lib/dance/comparator";
import type { DanceComparison, DanceRoutinePack } from "@/lib/dance/types";
import { selectFeedbackCue } from "@/lib/feedback/cues";
import { advanceFeedbackState, buildIssueSignature, createFeedbackState, type CoachLevel, type FeedbackCue } from "@/lib/feedback/state";
import { createVoiceFeedbackController } from "@/lib/feedback/voice";
import { useUserProfile } from "@/hooks/useUserProfile";
import { cn } from "@/lib/utils";
import { evaluateConfidence } from "@/lib/pose/confidence";
import {
  buildCurlBaseline,
  buildCurlDemoSessionEvidence,
  buildCurlRepScorecard,
  getCurlMetricLabel,
  summarizeCurlCoachMemory,
  summarizeCurlEvidence,
  type CurlBaseline,
  type CurlCoachMemory,
  type CurlMetricKey,
  type CurlRepScorecard,
  type CurlSessionEvidence,
} from "@/lib/pose/curl-scorecard";
import { advancePhaseTracker, analyzeExercise, createPhaseTrackerState, EXERCISE_CONTRACTS, POSE_CONNECTIONS, POSE_EXERCISES } from "@/lib/pose/exercises";
import { average, angle, distance } from "@/lib/pose/math";
import { evaluateSafety } from "@/lib/pose/safety";
import { createSessionAnalysisBuffer, finalizeSessionAnalysis, recordCue, recordFrame, recordTelemetry } from "@/lib/pose/session-buffer";
import {
  buildSquatRepScorecard,
  getSquatMetricLabel,
  summarizeSquatEvidence,
  type SquatMetricKey,
  type SquatRepScorecard,
} from "@/lib/pose/squat-scorecard";
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

type CoachAgentReport = {
  primarySessionRecommendation?: {
    type: "workout" | "dance" | "recovery";
    label: string;
    href: string;
    reason: string;
  };
  focusMetric?: {
    label: string;
    target: string;
    measuredValue: string;
    cue: string;
  };
  preSessionBrief?: {
    priority: string;
    reason: string;
    evidence: string[];
    nextAction: string;
    planAdjustment?: string;
  };
  postSessionNextAction?: {
    priority: string;
    reason: string;
    evidence: string[];
    nextAction: string;
    planAdjustment?: string;
    achievementRecommendation?: string;
  };
  closestAchievement?: {
    name: string;
    description: string;
    icon: string | null;
    progress: number;
    threshold: number;
    remaining: number;
    percent: number;
    nextAction: string;
  } | null;
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

const COACH_LEVELS: Array<{ id: CoachLevel; label: string; detail: string }> = [
  { id: "easy", label: "Easy", detail: "Fewer interruptions, only bigger curl issues." },
  { id: "normal", label: "Normal", detail: "Balanced curl checks and feedback." },
  { id: "hard", label: "Hard", detail: "Strict curl judging across every parameter." },
];

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
    style: raw.style === "hip_hop" ? "hip_hop" : "general",
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
      { label: "Hip-hop shape", valueKey: "elbowPath" as const },
      { label: "Groove bounce", valueKey: "rangeOfMotion" as const },
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

const CURL_MEMORY_KEY = "fitness-coach:last-curl-memory";

function statusTone(status: CurlRepScorecard["status"] | "ready" | "blocked") {
  if (status === "pass" || status === "ready") return "bg-emerald-500/15 text-emerald-300";
  if (status === "warning") return "bg-amber-500/15 text-amber-300";
  if (status === "fail" || status === "blocked") return "bg-rose-500/15 text-rose-300";
  return "bg-zinc-700 text-zinc-200";
}

function metricTone(status: string) {
  if (status === "pass") return "border-emerald-500/30 bg-emerald-500/10";
  if (status === "warning") return "border-amber-500/30 bg-amber-500/10";
  if (status === "fail") return "border-rose-500/30 bg-rose-500/10";
  return "border-zinc-800 bg-zinc-900/70";
}

function labelToMetricKey(label?: string): CurlMetricKey | null {
  if (!label) return null;
  const keys: CurlMetricKey[] = ["elbowPath", "shoulderStability", "torsoStability", "wristStack", "topFinish", "bottomExtension", "tempo", "symmetry"];
  return keys.find((key) => getCurlMetricLabel(key) === label) ?? null;
}

function buildCurlFocus(scorecards: CurlRepScorecard[], memory: CurlCoachMemory | null) {
  const recent = scorecards.slice(-3);
  const counts = new Map<string, number>();
  recent.forEach((rep) => {
    Object.values(rep.metrics)
      .filter((metric) => metric.reliable && (metric.status === "fail" || metric.status === "warning"))
      .forEach((metric) => counts.set(metric.label, (counts.get(metric.label) ?? 0) + 1));
  });
  const repeated = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const label = repeated?.[0] ?? memory?.primaryMetric;
  const key = labelToMetricKey(label);
  if (!label || !key) return null;
  const lastMetric = scorecards.at(-1)?.metrics[key];
  const improved = Boolean(lastMetric && lastMetric.status === "pass" && scorecards.length >= 2);
  return {
    key,
    label,
    progress: repeated?.[1] ?? 0,
    improved,
    cue:
      key === "elbowPath"
        ? "For the next 2 reps, pin your elbow beside your ribs before curling."
        : key === "shoulderStability"
          ? "For the next 2 reps, keep your shoulder relaxed and away from your ear."
          : key === "torsoStability"
            ? "For the next 2 reps, brace your ribs and avoid leaning back."
            : key === "wristStack"
              ? "For the next 2 reps, keep knuckles stacked over the wrist."
              : key === "bottomExtension"
                ? "For the next 2 reps, reach a controlled bottom without swinging."
                : key === "topFinish"
                  ? "For the next 2 reps, finish the curl with a short squeeze at the top."
                  : "For the next 2 reps, move slower and keep the path consistent.",
  };
}

function buildTeacherReport(evidence: CurlSessionEvidence | null, memory: CurlCoachMemory | null) {
  if (!evidence?.totalReps) return "";
  const recurring = evidence.recurringFailedMetrics.join(", ") || "none";
  return [
    `Bicep Curl Report`,
    `Reps: ${evidence.totalReps}`,
    `Average score: ${evidence.averageScore}`,
    `Best rep: ${evidence.bestRep ?? "n/a"}`,
    `Worst rep: ${evidence.worstRep ?? "n/a"}`,
    `Trend: ${evidence.improvementTrend >= 0 ? "+" : ""}${evidence.improvementTrend}`,
    `Recurring mistakes: ${recurring}`,
    `Reliability: ${evidence.reliabilityAverage}%`,
    memory?.primaryMetric ? `Next-session memory: watch ${memory.primaryMetric}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

interface ThreeHUDState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  jointMeshes: Map<number, THREE.Mesh>;
  lineSegments: THREE.LineSegments;
  gridHelper: THREE.GridHelper;
  cage?: THREE.LineSegments;
  sparkGroups?: Map<number, THREE.Group>;
  initialized: boolean;
}

function initThreeHUD(canvas: HTMLCanvasElement): ThreeHUDState {
  const width = canvas.clientWidth || 640;
  const height = canvas.clientHeight || 360;
  const aspect = width / height;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
  camera.position.set(0, 0.2, 7.8);
  camera.lookAt(0, 0.2, -0.5);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const gridHelper = new THREE.GridHelper(14, 28, 0x06b6d4, 0x1e293b);
  gridHelper.position.y = -2.4;
  gridHelper.position.z = -1;
  gridHelper.rotation.x = Math.PI / 18;
  scene.add(gridHelper);

  // Futuristic Bounding cage wireframe cuboid enclosing the skeleton in 3D
  const cageGeo = new THREE.BoxGeometry(4.8, 5.8, 3.8);
  const cageEdges = new THREE.EdgesGeometry(cageGeo);
  const cageMat = new THREE.LineBasicMaterial({
    color: 0x0891b2,
    transparent: true,
    opacity: 0.35,
  });
  const cage = new THREE.LineSegments(cageEdges, cageMat);
  cage.position.set(0, 0.2, -0.5);
  scene.add(cage);

  const ambient = new THREE.AmbientLight(0xffffff, 0.95);
  scene.add(ambient);

  const jointMeshes = new Map<number, THREE.Mesh>();
  const jointsToRender = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  
  const sphereGeo = new THREE.SphereGeometry(0.12, 16, 16);

  jointsToRender.forEach((idx) => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    jointMeshes.set(idx, mesh);
  });

  // Small orbiting electron-like glowing sparkles surrounding active limbs
  const sparkGroups = new Map<number, THREE.Group>();
  const sparkJoints = [13, 14, 15, 16, 25, 26]; // elbows, wrists, knees
  const sparkGeo = new THREE.SphereGeometry(0.035, 8, 8);
  
  sparkJoints.forEach((jointIdx) => {
    const group = new THREE.Group();
    scene.add(group);
    sparkGroups.set(jointIdx, group);
    
    for (let i = 0; i < 4; i++) {
      const sparkMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.85,
      });
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      
      const angle = (i / 4) * Math.PI * 2;
      const radius = 0.22 + Math.random() * 0.08;
      spark.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, (Math.random() - 0.5) * 0.1);
      group.add(spark);
    }
  });

  const boneMaterial = new THREE.LineBasicMaterial({
    color: 0x0891b2,
    transparent: true,
    opacity: 0.8,
  });

  const lineGeo = new THREE.BufferGeometry();
  const linePositions = new Float32Array(POSE_CONNECTIONS.length * 6);
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  
  const lineSegments = new THREE.LineSegments(lineGeo, boneMaterial);
  scene.add(lineSegments);

  return {
    scene,
    camera,
    renderer,
    jointMeshes,
    lineSegments,
    gridHelper,
    cage,
    sparkGroups,
    initialized: true,
  };
}

function updateThreeHUD(
  threeState: ThreeHUDState | null,
  landmarks: Landmark[] | null,
  score: number,
  streakCount: number,
  mirror: boolean,
  exerciseId: ExerciseId,
  analysis?: FrameAnalysis
) {
  if (!threeState?.initialized || !landmarks?.length) return;

  const { scene, camera, renderer, jointMeshes, lineSegments, gridHelper, cage, sparkGroups } = threeState;

  const perfColor = score >= 88 ? 0x10b981 : score >= 72 ? 0xf59e0b : score >= 55 ? 0xf97316 : 0xf43f5e;
  const activeColor = streakCount >= 5 ? 0xd946ef : streakCount >= 3 ? 0x06b6d4 : perfColor;

  if (gridHelper && gridHelper.material) {
    (gridHelper.material as THREE.LineBasicMaterial).color.setHex(activeColor);
  }

  if (cage && cage.material) {
    (cage.material as THREE.LineBasicMaterial).color.setHex(activeColor);
  }

  const scaleX = 7.2;
  const scaleY = 7.2;
  const scaleZ = 5.0;

  jointMeshes.forEach((mesh, idx) => {
    const pt = landmarks[idx];
    if (pt && (pt.visibility ?? 0) > 0.4) {
      mesh.visible = true;
      const adjustedX = mirror ? (1.5 - pt.x - 1.0) : (pt.x - 0.5);
      mesh.position.x = adjustedX * scaleX;
      mesh.position.y = (0.5 - pt.y) * scaleY;
      mesh.position.z = -(pt.z ?? 0) * scaleZ;

      (mesh.material as THREE.MeshBasicMaterial).color.setHex(activeColor);
    } else {
      mesh.visible = false;
    }
  });

  if (sparkGroups) {
    sparkGroups.forEach((group, jointIdx) => {
      const parentMesh = jointMeshes.get(jointIdx);
      if (parentMesh && parentMesh.visible) {
        group.visible = true;
        group.position.copy(parentMesh.position);
        
        group.rotation.x += 0.025;
        group.rotation.y += 0.035;

        group.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            (child.material as THREE.MeshBasicMaterial).color.setHex(activeColor);
          }
        });
      } else {
        group.visible = false;
      }
    });
  }

  const posArr = lineSegments.geometry.attributes.position.array as Float32Array;
  let arrIdx = 0;

  for (const [a, b] of POSE_CONNECTIONS) {
    const startMesh = jointMeshes.get(a);
    const endMesh = jointMeshes.get(b);

    if (startMesh?.visible && endMesh?.visible) {
      posArr[arrIdx++] = startMesh.position.x;
      posArr[arrIdx++] = startMesh.position.y;
      posArr[arrIdx++] = startMesh.position.z;

      posArr[arrIdx++] = endMesh.position.x;
      posArr[arrIdx++] = endMesh.position.y;
      posArr[arrIdx++] = endMesh.position.z;
    } else {
      posArr[arrIdx++] = 0; posArr[arrIdx++] = 0; posArr[arrIdx++] = 0;
      posArr[arrIdx++] = 0; posArr[arrIdx++] = 0; posArr[arrIdx++] = 0;
    }
  }

  lineSegments.geometry.attributes.position.needsUpdate = true;
  (lineSegments.material as THREE.LineBasicMaterial).color.setHex(activeColor);

  // Dynamic Camera Orbit Sway: Orbit left and right by +/- 25 degrees, and sway pitch!
  // This produces a fully visible, beautiful 3D depth parallax where the floor grid, 
  // coordinates cage, and skeleton rotate clearly inside the camera box.
  const time = Date.now() * 0.0006;
  const radius = 7.8;
  const angleRad = Math.sin(time * 0.8) * 0.45; // Orbit left and right
  camera.position.x = Math.sin(angleRad) * radius;
  camera.position.z = Math.cos(angleRad) * radius;
  camera.position.y = Math.cos(time * 0.4) * 0.35 + 0.2; // Pitch sway
  camera.lookAt(0, 0.2, -0.5);

  renderer.render(scene, camera);
}

function draw(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement | null,
  landmarks: Landmark[] | null,
  score: number,
  mirror: boolean,
  exerciseId?: ExerciseId,
  analysis?: FrameAnalysis,
  skipSkeleton2D = false
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (video) {
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
  } else {
    canvas.width = canvas.width || 640;
    canvas.height = canvas.height || 360;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks?.length) return;

  const defaultColor = score >= 88 ? "#10b981" : score >= 72 ? "#f59e0b" : score >= 55 ? "#f97316" : "#f43f5e";

  ctx.save();
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  // Draw target guideline HUD overlays
  if (exerciseId === "squat" && analysis) {
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    if (leftKnee && rightKnee && (leftKnee.visibility ?? 0) > 0.5 && (rightKnee.visibility ?? 0) > 0.5) {
      const avgKneeY = ((leftKnee.y + rightKnee.y) / 2) * canvas.height;
      ctx.strokeStyle = "rgba(16, 185, 129, 0.25)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, avgKneeY);
      ctx.lineTo(canvas.width, avgKneeY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = "rgba(16, 185, 129, 0.45)";
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("TARGET DEPTH", 15, avgKneeY - 4);
    }
  }

  if (!skipSkeleton2D) {
    // Draw HUD lines (bones) with localized color highlights based on joint metrics!
    ctx.lineWidth = 4.5;
  for (const [a, b] of POSE_CONNECTIONS) {
    const start = landmarks[a];
    const end = landmarks[b];
    if (!start || !end || (start.visibility ?? 0) < 0.4 || (end.visibility ?? 0) < 0.4) continue;

    let stroke = defaultColor;
    if (analysis && analysis.metrics.length) {
      if (exerciseId === "bicep_curl") {
        const isArm = (a === 11 && b === 13) || (a === 13 && b === 15) || (a === 12 && b === 14) || (a === 14 && b === 16);
        if (isArm) {
          const elbowPath = analysis.metrics.find((m) => m.name.includes("Elbow"))?.score ?? 100;
          const wristStack = analysis.metrics.find((m) => m.name.includes("Wrist"))?.score ?? 100;
          const minArmScore = Math.min(elbowPath, wristStack);
          stroke = minArmScore >= 85 ? "#10b981" : minArmScore >= 70 ? "#f59e0b" : "#f43f5e";
        }
        const isTorso = (a === 11 && b === 23) || (a === 12 && b === 24) || (a === 11 && b === 12);
        if (isTorso) {
          const torsoStab = analysis.metrics.find((m) => m.name.includes("Torso"))?.score ?? 100;
          stroke = torsoStab >= 85 ? "#10b981" : torsoStab >= 70 ? "#f59e0b" : "#f43f5e";
        }
      } else if (exerciseId === "squat") {
        const isLeg = (a === 23 && b === 25) || (a === 25 && b === 27) || (a === 24 && b === 26) || (a === 26 && b === 28);
        if (isLeg) {
          const depth = analysis.metrics.find((m) => m.name.includes("Depth"))?.score ?? 100;
          const kneeTrack = analysis.metrics.find((m) => m.name.includes("Knee"))?.score ?? 100;
          const minLegScore = Math.min(depth, kneeTrack);
          stroke = minLegScore >= 85 ? "#10b981" : minLegScore >= 70 ? "#f59e0b" : "#f43f5e";
        }
        const isTorso = (a === 11 && b === 23) || (a === 12 && b === 24) || (a === 11 && b === 12) || (a === 23 && b === 24);
        if (isTorso) {
          const torsoStack = analysis.metrics.find((m) => m.name.includes("Torso"))?.score ?? 100;
          stroke = torsoStack >= 85 ? "#10b981" : torsoStack >= 70 ? "#f59e0b" : "#f43f5e";
        }
      } else if (exerciseId === "pushup" || exerciseId === "plank") {
        const isBody = (a === 11 && b === 23) || (a === 23 && b === 25) || (a === 25 && b === 27) || (a === 12 && b === 24) || (a === 24 && b === 26) || (a === 26 && b === 28);
        if (isBody) {
          const bodyLine = analysis.metrics.find((m) => m.name.includes("Body"))?.score ?? 100;
          stroke = bodyLine >= 85 ? "#10b981" : bodyLine >= 70 ? "#f59e0b" : "#f43f5e";
        }
        const isArm = (a === 11 && b === 13) || (a === 13 && b === 15) || (a === 12 && b === 14) || (a === 14 && b === 16);
        if (isArm) {
          const depth = analysis.metrics.find((m) => m.name.includes("Depth"))?.score ?? 100;
          stroke = depth >= 85 ? "#10b981" : depth >= 70 ? "#f59e0b" : "#f43f5e";
        }
      } else if (exerciseId === "lunge") {
        const isLeg = (a === 23 && b === 25) || (a === 25 && b === 27) || (a === 24 && b === 26) || (a === 26 && b === 28);
        if (isLeg) {
          const frontKnee = analysis.metrics.find((m) => m.name.includes("Front"))?.score ?? 100;
          stroke = frontKnee >= 85 ? "#10b981" : frontKnee >= 70 ? "#f59e0b" : "#f43f5e";
        }
        const isTorso = (a === 11 && b === 23) || (a === 12 && b === 24) || (a === 11 && b === 12);
        if (isTorso) {
          const torso = analysis.metrics.find((m) => m.name.includes("Torso"))?.score ?? 100;
          stroke = torso >= 85 ? "#10b981" : torso >= 70 ? "#f59e0b" : "#f43f5e";
        }
      }
    }

    ctx.strokeStyle = stroke;
    ctx.beginPath();
    ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
    ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
    ctx.stroke();
  }

  // Draw joints (dots) with halo glow if warning/critical
  for (const [idx, point] of landmarks.entries()) {
    if (!point || (point.visibility ?? 0) < 0.35) continue;
    ctx.beginPath();
    ctx.arc(point.x * canvas.width, point.y * canvas.height, 6, 0, Math.PI * 2);
    ctx.fillStyle = defaultColor;
    ctx.fill();

    if (analysis && (idx === 13 || idx === 14 || idx === 25 || idx === 26)) {
      const isElbow = idx === 13 || idx === 14;
      const isKnee = idx === 25 || idx === 26;

      if (isElbow && exerciseId === "bicep_curl") {
        const elbowPath = analysis.metrics.find((m) => m.name.includes("Elbow"))?.score ?? 100;
        if (elbowPath < 70) {
          ctx.strokeStyle = "rgba(244, 63, 94, 0.45)";
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      if (isKnee && exerciseId === "squat") {
        const kneeTrack = analysis.metrics.find((m) => m.name.includes("Knee"))?.score ?? 100;
        if (kneeTrack < 70) {
          ctx.strokeStyle = "rgba(244, 63, 94, 0.5)";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 16, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }
  }

  // Helper to draw clean angle readouts on canvas
  function drawAngleHUD(aIdx: number, bIdx: number, cIdx: number, label: string) {
    if (!landmarks) return;
    const a = landmarks[aIdx];
    const b = landmarks[bIdx];
    const c = landmarks[cIdx];
    if (a && b && c && (a.visibility ?? 0) > 0.45 && (b.visibility ?? 0) > 0.5 && (c.visibility ?? 0) > 0.45) {
      const ang = angle(a, b, c);
      const bx = b.x * (canvas?.width ?? 1280);
      const by = b.y * (canvas?.height ?? 720);

      if (ctx) {
        ctx.fillStyle = "rgba(9, 9, 11, 0.72)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1;
        
        const boxW = 54;
        const boxH = 30;
        ctx.beginPath();
        ctx.roundRect(bx - boxW / 2, by - 38, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${Math.round(ang)}°`, bx, by - 24);

        ctx.fillStyle = "#a1a1aa";
        ctx.font = "bold 7px Inter, sans-serif";
        ctx.fillText(label, bx, by - 12);
      }
    }
  }

  if (exerciseId === "bicep_curl") {
    drawAngleHUD(11, 13, 15, "L ELBOW");
    drawAngleHUD(12, 14, 16, "R ELBOW");
  } else if (exerciseId === "squat") {
    drawAngleHUD(23, 25, 27, "L KNEE");
    drawAngleHUD(24, 26, 28, "R KNEE");
  } else if (exerciseId === "pushup" || exerciseId === "plank") {
    drawAngleHUD(11, 13, 15, "L ELBOW");
    drawAngleHUD(12, 14, 16, "R ELBOW");
  } else if (exerciseId === "lunge") {
    drawAngleHUD(23, 25, 27, "L KNEE");
    drawAngleHUD(24, 26, 28, "R KNEE");
  }

  ctx.restore();

  if (analysis && (analysis.injuryRisks.length || analysis.corrections.length)) {
    const textStr = (analysis.injuryRisks[0] || analysis.corrections[0]).toUpperCase();
    const isCritical = analysis.injuryRisks.length > 0;

    ctx.save();
    ctx.font = "bold 13px Inter, sans-serif";
    ctx.textAlign = "center";
    
    const bannerH = 34;
    const textWidth = ctx.measureText(textStr).width;
    const bannerW = Math.max(260, textWidth + 36);
    const bannerX = canvas.width / 2;
    const bannerY = canvas.height - 45;

    ctx.fillStyle = isCritical ? "rgba(244, 63, 94, 0.92)" : "rgba(245, 158, 11, 0.92)";
    ctx.shadowColor = isCritical ? "rgba(244, 63, 94, 0.45)" : "rgba(245, 158, 11, 0.45)";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.roundRect(bannerX - bannerW / 2, bannerY - bannerH / 2, bannerW, bannerH, 8);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(textStr, bannerX, bannerY + 4);
    ctx.restore();
  } else if (analysis && score >= 88) {
    ctx.save();
    ctx.font = "bold 11px Inter, sans-serif";
    ctx.textAlign = "center";
    const bannerX = canvas.width / 2;
    const bannerY = canvas.height - 40;
    
    ctx.fillStyle = "rgba(16, 185, 129, 0.85)";
    ctx.beginPath();
    ctx.roundRect(bannerX - 70, bannerY - 14, 140, 24, 6);
    ctx.fill();
    
    ctx.fillStyle = "#ffffff";
    ctx.fillText("FORM EXCELLENT", bannerX, bannerY + 2);
    ctx.restore();
  }
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
  const curlCalibrationFramesRef = useRef<TrackingFrame[]>([]);
  const curlFrameHistoryRef = useRef<Array<{ timestampMs: number; analysis: FrameAnalysis }>>([]);
  const curlRepScorecardsRef = useRef<CurlRepScorecard[]>([]);
  const squatFrameHistoryRef = useRef<Array<{ timestampMs: number; analysis: FrameAnalysis }>>([]);
  const squatRepScorecardsRef = useRef<SquatRepScorecard[]>([]);
  const eventsRef = useRef<FeedbackEvent[]>([]);
  const framesRef = useRef<FrameAnalysis[]>([]);
  const curveRef = useRef<number[]>([]);
  const sessionBufferRef = useRef<SessionAnalysisBuffer>(createSessionAnalysisBuffer());
  const danceSegmentRef = useRef<Record<string, { label: string; scores: number[]; timing: number[]; transition: number[] }>>({});
  const lastCoachRef = useRef(0);
  const lastCoachSignatureRef = useRef<string | null>(null);
  const lastOverallRef = useRef(0);
  const lastPauseReasonRef = useRef<string | null>(null);
  const calibrationHoldFramesRef = useRef(0);
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
  const [agentReport, setAgentReport] = useState<CoachAgentReport | null>(null);
  const [postSessionAgent, setPostSessionAgent] = useState<CoachAgentReport | null>(null);
  const [danceRoutine, setDanceRoutine] = useState<DanceRoutinePack | null>(null);
  const [danceComparison, setDanceComparison] = useState<DanceComparison | null>(null);
  const [danceSegmentBreakdown, setDanceSegmentBreakdown] = useState<Array<{ id: string; label: string; overall: number; timing: number; transition: number }>>([]);
  const [topMistakes, setTopMistakes] = useState<TopMistake[]>([]);
  const [correctivePlan, setCorrectivePlan] = useState<CorrectiveBlock[]>([]);
  const [curlBaseline, setCurlBaseline] = useState<CurlBaseline | null>(null);
  const [curlRepScorecards, setCurlRepScorecards] = useState<CurlRepScorecard[]>([]);
  const [squatRepScorecards, setSquatRepScorecards] = useState<SquatRepScorecard[]>([]);
  const [curlCoachMemory, setCurlCoachMemory] = useState<CurlCoachMemory | null>(null);
  const [curlDemoActive, setCurlDemoActive] = useState(false);
  const [curlReferenceOverlay, setCurlReferenceOverlay] = useState(true);
  const [reportCopied, setReportCopied] = useState(false);
  const [trackingPausedReason, setTrackingPausedReason] = useState<string | null>(null);
  const [calibrationHoldProgress, setCalibrationHoldProgress] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [coachLevel, setCoachLevel] = useState<CoachLevel>("normal");
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
  const coachLevelRef = useRef<CoachLevel>(coachLevel);
  const curlBaselineRef = useRef<CurlBaseline | null>(curlBaseline);
  const [streakCount, setStreakCount] = useState(0);
  const [replayFrameIndex, setReplayFrameIndex] = useState(0);
  const replayOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const landmarksHistoryRef = useRef<Array<{ landmarks: Landmark[], analysis: FrameAnalysis }>>([]);

  const [hudMode, setHudMode] = useState<"2d" | "3d">("2d");
  const threeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const threeStateRef = useRef<ThreeHUDState | null>(null);
  const replayThreeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const replayThreeStateRef = useRef<ThreeHUDState | null>(null);

  const [particlesInit, setParticlesInit] = useState(false);
  const [sparkPosition, setSparkPosition] = useState<{ x: number; y: number } | null>(null);
  const [showSparks, setShowSparks] = useState(false);

  const particlesConfig = useMemo(() => {
    if (!sparkPosition) return {};
    return {
      fullScreen: { enable: false },
      fpsLimit: 60,
      particles: {
        number: { value: 0 },
        color: { value: "#10b981" },
        shape: { type: "circle" },
        opacity: {
          value: { min: 0.3, max: 0.8 },
          animation: { enable: true, speed: 1.5, minimumValue: 0, sync: false }
        },
        size: {
          value: { min: 3, max: 6 },
          animation: { enable: true, speed: 4, minimumValue: 0.5, sync: false }
        },
        move: {
          enable: true,
          direction: "none",
          speed: { min: 3, max: 9 },
          random: true,
          straight: false,
          outModes: { default: "destroy" },
          gravity: { enable: true, acceleration: 6 }
        }
      },
      emitters: [
        {
          direction: "top",
          rate: { quantity: 18, delay: 0.04 },
          life: { duration: 0.45, count: 1 },
          position: { x: sparkPosition.x, y: sparkPosition.y },
          size: { width: 5, height: 5 }
        }
      ]
    };
  }, [sparkPosition]);

  useEffect(() => {
    let active = true;
    const loadAgent = async () => {
      try {
        const response = await fetch("/api/coach/agent", { credentials: "include" });
        if (!response.ok) return;
        const data = await response.json();
        if (active) setAgentReport(data);
      } catch {
        if (active) setAgentReport(null);
      }
    };
    void loadAgent();
    return () => {
      active = false;
    };
  }, []);

  const runDrawLoop = (landmarks: Landmark[] | null, score: number, exerciseId: ExerciseId, analysis?: FrameAnalysis) => {
    if (hudMode === "3d") {
      if (threeCanvasRef.current) {
        if (overlayRef.current) {
          threeCanvasRef.current.width = overlayRef.current.width;
          threeCanvasRef.current.height = overlayRef.current.height;
        }
        if (!threeStateRef.current) {
          threeStateRef.current = initThreeHUD(threeCanvasRef.current);
        }
        const targetW = overlayRef.current?.width || 640;
        const targetH = overlayRef.current?.height || 360;
        const state = threeStateRef.current;
        if (state.renderer.domElement.width !== targetW || state.renderer.domElement.height !== targetH) {
          state.camera.aspect = targetW / targetH;
          state.camera.updateProjectionMatrix();
          state.renderer.setSize(targetW, targetH, false);
        }
        updateThreeHUD(state, landmarks, score, streakCount, mirrorRef.current, exerciseId, analysis);
      }
      draw(overlayRef.current, videoRef.current, landmarks, score, mirrorRef.current, exerciseId, analysis, true);
    } else {
      draw(overlayRef.current, videoRef.current, landmarks, score, mirrorRef.current, exerciseId, analysis, false);
    }
  };

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
    curlCalibrationFramesRef.current = [];
    curlFrameHistoryRef.current = [];
    curlRepScorecardsRef.current = [];
    squatFrameHistoryRef.current = [];
    squatRepScorecardsRef.current = [];
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
    setCurlBaseline(null);
    setCurlRepScorecards([]);
    setSquatRepScorecards([]);
    setCurlDemoActive(false);
    setReportCopied(false);
    curlBaselineRef.current = null;
    setTrackingPausedReason(null);
    setCalibrationHoldProgress(0);
    calibrationHoldFramesRef.current = 0;
    setSeconds(0);
    setCalories(0);
    setStreakCount(0);
    setReplayFrameIndex(0);
    landmarksHistoryRef.current = [];
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
    const durationMs = Math.max(0, now - previousPhaseState.cycleStartedAt);
    const curlRepFrames =
      exerciseIdRef.current === "bicep_curl"
        ? curlFrameHistoryRef.current.filter((point) => point.timestampMs >= previousPhaseState.cycleStartedAt && point.timestampMs <= now)
        : [];
    const curlScorecard =
      exerciseIdRef.current === "bicep_curl"
        ? buildCurlRepScorecard({
            repNumber: repsRef.current,
            frames: curlRepFrames.length ? curlRepFrames : [{ timestampMs: now, analysis: frame }],
            durationMs,
            coachingLevel: coachLevelRef.current,
            baseline: curlBaselineRef.current,
          })
        : null;
    const squatScorecard =
      exerciseIdRef.current === "squat"
        ? buildSquatRepScorecard({
            repNumber: repsRef.current,
            frames: squatFrameHistoryRef.current.filter((point) => point.timestampMs >= previousPhaseState.cycleStartedAt && point.timestampMs <= now),
            durationMs,
          })
        : null;
    if (curlScorecard) {
      curlRepScorecardsRef.current = [...curlRepScorecardsRef.current, curlScorecard];
      setCurlRepScorecards(curlRepScorecardsRef.current);
    }
    if (squatScorecard) {
      squatRepScorecardsRef.current = [...squatRepScorecardsRef.current, squatScorecard];
      setSquatRepScorecards(squatRepScorecardsRef.current);
    }
    repDataRef.current.push({
      exerciseId: exerciseIdRef.current,
      repNumber: repsRef.current,
      phase: phaseUpdate.phase,
      formScore: frame.form,
      romScore: frame.rom,
      tempoScore: frame.tempo,
      safetyScore: frame.safety,
      corrections: frame.corrections.slice(0, 4),
      durationMs,
      timestamps: {
        startMs: Math.max(0, previousPhaseState.cycleStartedAt - startedAtRef.current),
        endMs: Math.max(0, now - startedAtRef.current),
      },
      curlScorecard,
      squatScorecard,
    });

    // Streak Counter Logic
    if (frame.overall >= 85) {
      setStreakCount((prev) => {
        const next = prev + 1;
        if (next >= 3) {
          voiceRef.current.speak(`Streak ${next}! Excellent consistency!`, "info", `streak_${next}`);
          toast.success(`Form Streak: ${next} reps in a row!`, { icon: "🔥" });
        }
        return next;
      });
    } else if (frame.overall < 75) {
      setStreakCount(0);
    }

    // Joint Spark Particles on Excellent Reps!
    if (frame.overall >= 88 && trackingFrameRef.current?.smoothedLandmarks) {
      const landmarks = trackingFrameRef.current.smoothedLandmarks;
      const activeExercise = exerciseIdRef.current;
      let jointIdx = 11; // default left shoulder
      
      if (activeExercise === "squat" || activeExercise === "lunge" || activeExercise === "warrior") {
        jointIdx = 25; // left knee
      } else if (activeExercise === "bicep_curl" || activeExercise === "pushup" || activeExercise === "plank") {
        jointIdx = 13; // left elbow
      } else if (activeExercise === "jumping_jack") {
        jointIdx = 15; // left wrist
      }
      
      const pt = landmarks[jointIdx];
      if (pt) {
        const adjustedX = mirrorRef.current ? (1 - pt.x) : pt.x;
        setSparkPosition({ x: adjustedX * 100, y: pt.y * 100 });
        setShowSparks(true);
        setTimeout(() => {
          setShowSparks(false);
        }, 1200);
      }
    }

    // Muscle Fatigue Compensation Analysis
    if (repsRef.current >= 4) {
      const recentReps = repDataRef.current.slice(-3);
      const avgForm = average(recentReps.map((r) => r.formScore));
      const firstRepForm = repDataRef.current[0]?.formScore ?? 85;

      if (avgForm < firstRepForm - 10) {
        const alertMsg = "Fatigue detected. Focus on your core stability and keep your movements controlled.";
        voiceRef.current.speak(alertMsg, "warning", "fatigue_compensation");
        toast.warning("Compensation Warning: Form is slipping due to fatigue!", { duration: 5000 });
      }
    }
    pushTelemetry({
      timestampMs: Math.max(0, now - startedAtRef.current),
      type: "rep_counted",
      message: `Rep ${repsRef.current} counted.`,
      meta: { phase: phaseUpdate.phase, overall: frame.overall },
    });
    const repCue: FeedbackCue = {
      message: curlScorecard
        ? `Rep ${repsRef.current}: ${curlScorecard.overall}. ${
            curlScorecard.status === "pass"
              ? "Clean curl."
              : curlScorecard.worstMetric
                ? `Watch ${curlScorecard.metrics[curlScorecard.worstMetric].label.toLowerCase()}.`
                : "Review the scorecard."
          }`
        : squatScorecard
          ? `Rep ${repsRef.current}: ${squatScorecard.overall}. ${
              squatScorecard.status === "pass"
                ? "Clean squat."
                : squatScorecard.worstMetric
                  ? `Watch ${squatScorecard.metrics[squatScorecard.worstMetric].label.toLowerCase()}.`
                  : "Review the squat scorecard."
            }`
        : `Rep ${repsRef.current} counted. ${frame.corrections[0] ?? frame.positives[0] ?? "Keep moving with control."}`,
      severity: "info",
      source: "system",
      secondaryNote: frame.secondaryNote,
      signature: buildIssueSignature({ severity: "info", message: `rep_${repsRef.current}_${exerciseIdRef.current}`, side: exerciseIdRef.current, channel: "rep" }),
    };
    applyCue(repCue, {
      eventType: "cue",
      logEvent: true,
      speak:
        exerciseIdRef.current !== "bicep_curl" ||
        coachLevelRef.current === "hard" ||
        Boolean(curlScorecard && (curlScorecard.status === "pass" || repsRef.current % 2 === 0)),
    });
  };

  const maybeCoach = async (frame: FrameAnalysis, cue: FeedbackCue, triggerReason: "issue_changed" | "score_drop" | "phase_milestone" | null) => {
    if (!runningRef.current || !triggerReason) return;
    const now = Date.now();
    const curlInterval = coachLevelRef.current === "easy" ? 14_000 : coachLevelRef.current === "hard" ? 6_000 : 8_000;
    const interval = exerciseIdRef.current === "bicep_curl" ? curlInterval : exerciseIdRef.current === "squat" ? 8_500 : exerciseIdRef.current === "dance_basic" ? 7_500 : 12_000;
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
          coachingLevel: coachLevelRef.current,
          issueSignature: cue.signature,
          triggerReason,
          currentIssues: [...frame.injuryRisks, ...frame.corrections, ...frame.issues].slice(0, 6),
          currentMetrics: frame.metrics.slice(0, 8).map((metric) => ({ name: metric.name, score: metric.score, detail: metric.detail, value: metric.value, target: metric.target })),
          recentScores: repDataRef.current.slice(-5).map((rep: any) => ({ form: rep.formScore, rom: rep.romScore, tempo: rep.tempoScore, safety: rep.safetyScore })),
          cueEvidence: {
            metricName: cue.metricName,
            side: cue.side,
            phase: cue.phase,
            score: cue.score,
            value: cue.value,
            target: cue.target,
            confidence: cue.confidence,
          },
          recentCueHistory: eventsRef.current
            .slice(-6)
            .map((event) => ({ message: event.message, severity: event.severity, source: event.source, timestamp: event.timestamp })),
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
    runDrawLoop(trackingFrame?.smoothedLandmarks ?? null, analysisRef.current.overall, currentId, analysisRef.current);

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
      const nextHoldProgress = gate.ready ? Math.min(calibrationHoldFramesRef.current + 1, 18) : 0;
      calibrationHoldFramesRef.current = nextHoldProgress;
      setCalibrationHoldProgress(nextHoldProgress);
      if (currentId === "bicep_curl" && gate.ready) {
        curlCalibrationFramesRef.current = [...curlCalibrationFramesRef.current.slice(-30), trackingFrame];
        const nextBaseline = buildCurlBaseline(curlCalibrationFramesRef.current);
        curlBaselineRef.current = nextBaseline;
        setCurlBaseline(nextBaseline);
      } else if (currentId !== "bicep_curl") {
        curlCalibrationFramesRef.current = [];
        curlBaselineRef.current = null;
        setCurlBaseline(null);
      }
      if (currentId !== "squat") {
        squatFrameHistoryRef.current = [];
        squatRepScorecardsRef.current = [];
        setSquatRepScorecards([]);
      }
      showStatus(gate.message);
      setTrackingPausedReason(null);
      runDrawLoop(trackingFrame.smoothedLandmarks, 80, currentId);
      return;
    }

    const shouldPauseScoring = gate.pauseTracking || !gate.ready || gate.avgVisibility < 0.55;
    const shouldPauseRepTracking = gate.frameQuality === "camera_lost" || gate.avgVisibility < 0.4;
    const pauseReason = shouldPauseScoring ? `${gate.message} Rep counting is paused until tracking recovers.` : null;
    setTrackingPausedReason(pauseReason);
    if (shouldPauseScoring) {
      setCalibrationHoldProgress(0);
      calibrationHoldFramesRef.current = 0;
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
    const phaseUpdate = shouldPauseRepTracking
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
    landmarksHistoryRef.current.push({
      landmarks: trackingFrame.smoothedLandmarks,
      analysis: resolved
    });
    if (currentId === "bicep_curl") {
      curlFrameHistoryRef.current = [...curlFrameHistoryRef.current.slice(-180), { timestampMs: now, analysis: resolved }];
    }
    if (currentId === "squat") {
      squatFrameHistoryRef.current = [...squatFrameHistoryRef.current.slice(-180), { timestampMs: now, analysis: resolved }];
    }
    if (framesRef.current.length % 15 === 0) curveRef.current.push(resolved.overall);
    recordFrame(sessionBufferRef.current, trackingFrame, resolved);
    if (!shouldPauseRepTracking) maybeRep(phaseUpdate, previousPhaseState, resolved, now);
    setAnalysis(resolved);
    analysisRef.current = resolved;

    if (currentId === "dance_basic" && danceRoutineRef.current?.segments?.length) {
      const comparison = compareDanceFrame({ landmarks: trackingFrame.smoothedLandmarks, routine: danceRoutineRef.current, elapsedMs, analysis: resolved });
      setDanceComparison(comparison);
      if (comparison) {
        setTechniqueScorecard({
          elbowPath: comparison.metrics.poseShape.score,
          rangeOfMotion: comparison.metrics.grooveBounce.score,
          tempoControl: comparison.metrics.timing.score,
          torsoStability: comparison.metrics.torsoControl.score,
        });
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
    runDrawLoop(trackingFrame.smoothedLandmarks, resolved.overall, currentId, resolved);

    const liveCue = selectFeedbackCue(currentId, resolved, safety, trackingFrame.trackingConfidence, { coachLevel: coachLevelRef.current });
    const cueDecision = advanceFeedbackState(feedbackStateRef.current, shouldPauseScoring ? null : liveCue, {
      now,
      confidence: trackingFrame.trackingConfidence,
      confidenceGate: currentId === "bicep_curl" && coachLevelRef.current === "easy" ? 0.74 : 0.66,
    });
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

  const stopCamera = (options: { preserveResults?: boolean } = {}) => {
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
    if (!options.preserveResults) {
      setCurlBaseline(null);
      setCurlRepScorecards([]);
      setSquatRepScorecards([]);
      curlBaselineRef.current = null;
      curlRepScorecardsRef.current = [];
      squatRepScorecardsRef.current = [];
    }
    curlCalibrationFramesRef.current = [];
    curlFrameHistoryRef.current = [];
    squatFrameHistoryRef.current = [];
    setCalibrationHoldProgress(0);
    calibrationHoldFramesRef.current = 0;
    voiceRef.current.stop();
    runDrawLoop(null, 0, exerciseIdRef.current);
  };

  const startSession = () => {
    if (!cameraOn) return;
    if (!confidence.ready || calibrationHoldFramesRef.current < 18) {
      const message = confidence.ready ? "Hold steady in the ready position for one more moment before starting." : confidence.message;
      pushTelemetry({ timestampMs: 0, type: "calibration_blocked", message, meta: { frameQuality: confidence.frameQuality, view: confidence.view } });
      toast.error(message);
      return;
    }
    if (exerciseIdRef.current === "bicep_curl" && coachLevelRef.current === "hard" && !curlBaselineRef.current?.ready) {
      const message = curlBaselineRef.current?.message ?? "Hold a stable curl setup for a moment so hard mode can calibrate.";
      pushTelemetry({ timestampMs: 0, type: "calibration_blocked", message, meta: { exerciseId: "bicep_curl", coachingLevel: "hard" } });
      toast.error(message);
      return;
    }
    const sessionCurlBaseline = curlBaselineRef.current;
    reset();
    if (exerciseIdRef.current === "bicep_curl") {
      curlBaselineRef.current = sessionCurlBaseline;
      setCurlBaseline(sessionCurlBaseline);
    }
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
      if (data?.coachAgent) {
        setPostSessionAgent(data.coachAgent);
        setAgentReport(data.coachAgent);
      }

      const topIssues = Array.from(new Set(eventsRef.current.filter((event) => event.severity !== "info").map((event) => event.message))).slice(0, 6);
      const topStrengths = framesRef.current.length ? [scoring.form >= 80 ? "Form quality stayed strong for most reps." : "", scoring.rom >= 80 ? "Range of motion was consistent." : "", scoring.safety >= 85 ? "Movement stayed safe and controlled." : ""].filter(Boolean) : [];
      const curlEvidence = exerciseIdRef.current === "bicep_curl" ? summarizeCurlEvidence(curlRepScorecardsRef.current) : undefined;
      let nextCurlMemory = curlCoachMemory;
      if (curlEvidence?.totalReps) {
        nextCurlMemory = summarizeCurlCoachMemory(curlEvidence);
        setCurlCoachMemory(nextCurlMemory);
        try {
          window.localStorage.setItem(CURL_MEMORY_KEY, JSON.stringify(nextCurlMemory));
        } catch {}
      }
      const summaryRes = await fetch("/api/coach/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: data.sessionId,
          exerciseType: exerciseIdRef.current,
          coachingLevel: coachLevelRef.current,
          durationMinutes: Math.max(1, Math.round(secondsRef.current / 60)),
          totalReps: repsRef.current,
          scoringBreakdown: scoring,
          topIssues,
          topStrengths,
          curlEvidence,
          curlCoachMemory: nextCurlMemory ?? undefined,
          sessionSummary: `Exercise ${exerciseIdRef.current}, ${repsRef.current} reps, overall ${analysisRef.current.overall}, issues: ${topIssues.join("; ") || "none"}, post-set: ${JSON.stringify(sessionAnalysis.postSet)}${
            curlEvidence ? `, curl-evidence: ${JSON.stringify(curlEvidence)}` : ""
          }`,
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
      stopCamera({ preserveResults: true });
    }
  };

  const loadCurlTeacherDemo = () => {
    stopCamera();
    reset();
    setExerciseId("bicep_curl");
    exerciseIdRef.current = "bicep_curl";
    const evidence = buildCurlDemoSessionEvidence(coachLevelRef.current);
    const nextMemory = summarizeCurlCoachMemory(evidence);
    const baseline: CurlBaseline = {
      ready: true,
      confidence: 0.94,
      shoulderSpan: 0.28,
      torsoLength: 0.38,
      armVisibility: 0.95,
      view: "front",
      message: "Teacher demo baseline loaded with clear shoulders, elbows, wrists, and hips.",
    };
    curlBaselineRef.current = baseline;
    curlRepScorecardsRef.current = evidence.repScorecards;
    setCurlBaseline(baseline);
    setCurlRepScorecards(evidence.repScorecards);
    setCurlCoachMemory(nextMemory);
    setCurlDemoActive(true);
    setFeedback("Teacher demo loaded: five curl reps with realistic mistakes and improvement.");
    setSecondaryFeedback("Use this when classroom camera conditions are unreliable. It uses the same scorecard and summary evidence path as live reps.");
    setCoachLine(`Demo summary: best rep ${evidence.bestRep}, worst rep ${evidence.worstRep}, recurring issue ${evidence.recurringFailedMetrics[0] ?? "none"}.`);
    setCoachSource("fallback");
    setSummary(
      `Demo bicep-curl set completed with ${evidence.totalReps} reps, an average score of ${evidence.averageScore}, and a ${evidence.improvementTrend >= 0 ? "positive" : "negative"} quality trend.`,
    );
    setSummaryInsights([
      `Best rep: ${evidence.bestRep}; worst rep: ${evidence.worstRep}.`,
      evidence.recurringFailedMetrics.length ? `Most repeated mistake: ${evidence.recurringFailedMetrics[0]}.` : "No repeated failed metric.",
      `Average tracking reliability: ${evidence.reliabilityAverage}%.`,
    ]);
    setSummaryPractice([
      evidence.recurringFailedMetrics[0] ? `Practice 2 slow reps focused only on ${evidence.recurringFailedMetrics[0].toLowerCase()}.` : "Keep the same controlled curl path next time.",
      "Record one clean side/front angle before judging hard mode.",
    ]);
    setTopMistakes(
      evidence.recurringFailedMetrics.slice(0, 3).map((metric) => ({
        mistake: metric,
        whyItHurtsPerformance: `${metric} reduced the score on repeated reps, so the curl was not consistently strict.`,
        exactFix: metric === "Elbow path" ? "Keep the elbow pinned beside the ribs and move only the forearm." : "Use slower reps and keep the joint stacked through the full range.",
      })),
    );
    setCorrectivePlan([
      { minuteRange: "0:00-1:30", drill: "Wall curl reps", focusCue: "Back and elbow stay quiet while the forearm moves." },
      { minuteRange: "1:30-3:30", drill: "Slow 3-count curls", focusCue: "Lift with control, pause briefly, lower without swinging." },
      { minuteRange: "3:30-5:00", drill: "Clean rep test", focusCue: "Repeat the best-rep shape from the scorecard." },
    ]);
    setTechniqueScorecard({
      elbowPath: Math.round(average(evidence.repScorecards.map((rep) => rep.metrics.elbowPath.score))),
      rangeOfMotion: Math.round(average(evidence.repScorecards.map((rep) => average([rep.metrics.topFinish.score, rep.metrics.bottomExtension.score])))),
      tempoControl: Math.round(average(evidence.repScorecards.map((rep) => rep.metrics.tempo.score))),
      torsoStability: Math.round(average(evidence.repScorecards.map((rep) => rep.metrics.torsoStability.score))),
    });
    try {
      window.localStorage.setItem(CURL_MEMORY_KEY, JSON.stringify(nextMemory));
    } catch {}
    toast.success("Teacher demo loaded");
  };

  const activateDemoFallback = () => {
    if (mode === "workout") {
      loadCurlTeacherDemo();
      setPostSessionAgent(agentReport);
      toast.success("Demo fallback loaded");
      return;
    }
    stopCamera();
    reset();
    setExerciseId("dance_basic");
    exerciseIdRef.current = "dance_basic";
    const demoSegment = danceRoutine?.segments[0] ?? {
      id: "demo-phrase",
      label: "Starter phrase",
      startMs: 0,
      endMs: 8000,
      cue: "Starter groove",
      focus: "timing",
      targetMetrics: { frameWidth: [0.35, 0.75] as [number, number], armLift: [0.2, 0.8] as [number, number], torsoLeanMax: 18, kneeAngle: [115, 165] as [number, number], symmetryMax: 0.22 },
      targetLandmarks: {},
    };
    setDanceComparison({
      segment: demoSegment,
      poseSimilarity: 78,
      timingScore: 72,
      segmentCompletion: 84,
      transitionQuality: 75,
      reliability: 88,
      overall: 75,
      failedMetrics: ["Beat timing"],
      primaryIssue: "Late shoulder hit",
      notes: ["Land the shoulder hit slightly earlier on count two."],
      metrics: {
        poseShape: { key: "poseShape", label: "Hip-hop shape", score: 78, status: "warning", reliable: true, detail: "Arms match the phrase shape with small timing drift.", target: "Clear hit on counts 2 and 4" },
        grooveBounce: { key: "grooveBounce", label: "Groove bounce", score: 74, status: "warning", reliable: true, detail: "Bounce is present but uneven between counts.", target: "Even down-up pulse" },
        armHits: { key: "armHits", label: "Arm hits", score: 76, status: "warning", reliable: true, detail: "Hits are readable but need sharper stops.", target: "Stop cleanly on accented counts" },
        torsoControl: { key: "torsoControl", label: "Torso control", score: 82, status: "pass", reliable: true, detail: "Torso stays stable through the groove.", target: "Stable chest line" },
        timing: { key: "timing", label: "Beat timing", score: 72, status: "warning", reliable: true, detail: "You are slightly late on the transition.", target: "Arrive inside phrase window" },
        transition: { key: "transition", label: "Transition quality", score: 75, status: "warning", reliable: true, detail: "Step change is readable but could be cleaner.", target: "Clean weight shift before next hit" },
      },
    });
    setDanceSegmentBreakdown([{ id: "demo-phrase", label: "Starter phrase", overall: 75, timing: 72, transition: 75 }]);
    setSummary("Demo hip-hop fallback loaded with realistic phrase timing, groove bounce, and transition evidence.");
    setSummaryInsights(["Shape was readable, but timing drifted late on the main shoulder hit.", "Reliability was high enough for review, but this was demo evidence."]);
    setSummaryPractice(["Repeat the starter groove and count out loud through the first phrase."]);
    setTopMistakes([{ mistake: "Late shoulder hit", whyItHurtsPerformance: "The phrase looks behind the beat when the hit lands after count two.", exactFix: "Count one-and-two, then hit the shoulder exactly on two before changing weight." }]);
    setCorrectivePlan([{ minuteRange: "0:00-2:00", drill: "Counted shoulder hits", focusCue: "Say the count and hit on two." }, { minuteRange: "2:00-5:00", drill: "Starter groove loop", focusCue: "Keep bounce even while changing weight." }]);
    setPostSessionAgent(agentReport);
    toast.success("Dance demo fallback loaded");
  };

  useEffect(() => {
    exerciseIdRef.current = exerciseId;
    exerciseRef.current = exercise;
    if (exerciseId === "bicep_curl" && curlDemoActive) return;
    setConfidence(EMPTY_CONFIDENCE(exerciseId));
    confidenceRef.current = EMPTY_CONFIDENCE(exerciseId);
    setCurlBaseline(null);
    setCurlRepScorecards([]);
    curlBaselineRef.current = null;
    curlCalibrationFramesRef.current = [];
    curlFrameHistoryRef.current = [];
    curlRepScorecardsRef.current = [];
    setCalibrationHoldProgress(0);
    calibrationHoldFramesRef.current = 0;
  }, [curlDemoActive, exercise, exerciseId]);

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
    coachLevelRef.current = coachLevel;
    voiceRef.current.setStyle(coachLevel === "easy" ? "calm" : coachLevel === "hard" ? "strict" : "balanced");
  }, [coachLevel]);

  useEffect(() => {
    curlBaselineRef.current = curlBaseline;
  }, [curlBaseline]);

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
      if (threeStateRef.current) {
        try {
          threeStateRef.current.renderer.dispose();
          threeStateRef.current.jointMeshes.forEach((mesh: any) => {
            mesh.geometry.dispose();
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach((m: any) => m.dispose());
              } else {
                mesh.material.dispose();
              }
            }
          });
          threeStateRef.current.lineSegments.geometry.dispose();
          if (threeStateRef.current.lineSegments.material) {
            const mat = threeStateRef.current.lineSegments.material;
            if (Array.isArray(mat)) {
              mat.forEach((m: any) => m.dispose());
            } else {
              mat.dispose();
            }
          }
          threeStateRef.current.gridHelper.geometry.dispose();
          if (threeStateRef.current.gridHelper.material) {
            const mat = threeStateRef.current.gridHelper.material;
            if (Array.isArray(mat)) {
              mat.forEach((m: any) => m.dispose());
            } else {
              mat.dispose();
            }
          }
        } catch {}
        threeStateRef.current = null;
      }
      if (replayThreeStateRef.current) {
        try {
          replayThreeStateRef.current.renderer.dispose();
          replayThreeStateRef.current.jointMeshes.forEach((mesh: any) => {
            mesh.geometry.dispose();
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach((m: any) => m.dispose());
              } else {
                mesh.material.dispose();
              }
            }
          });
          replayThreeStateRef.current.lineSegments.geometry.dispose();
          if (replayThreeStateRef.current.lineSegments.material) {
            const mat = replayThreeStateRef.current.lineSegments.material;
            if (Array.isArray(mat)) {
              mat.forEach((m: any) => m.dispose());
            } else {
              mat.dispose();
            }
          }
          replayThreeStateRef.current.gridHelper.geometry.dispose();
          if (replayThreeStateRef.current.gridHelper.material) {
            const mat = replayThreeStateRef.current.gridHelper.material;
            if (Array.isArray(mat)) {
              mat.forEach((m: any) => m.dispose());
            } else {
              mat.dispose();
            }
          }
        } catch {}
        replayThreeStateRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CURL_MEMORY_KEY);
      if (stored) setCurlCoachMemory(JSON.parse(stored) as CurlCoachMemory);
    } catch {}
  }, []);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setParticlesInit(true);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let recognition: any = null;
    if (cameraOn) {
      try {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";
        
        recognition.onresult = (event: any) => {
          const last = event.results.length - 1;
          const text = event.results[last][0].transcript.toLowerCase().trim();
          
          if (text.includes("start session") || text.includes("start workout") || text.includes("begin session")) {
            toast.success("Voice command: Starting session");
            startSession();
          } else if (text.includes("stop session") || text.includes("stop workout") || text.includes("finish session")) {
            toast.success("Voice command: Stopping session");
            void stopSession();
          } else if (text.includes("mute coach") || text.includes("disable voice")) {
            toast.success("Voice command: Mute coach");
            setVoiceEnabled(false);
          } else if (text.includes("unmute coach") || text.includes("enable voice")) {
            toast.success("Voice command: Unmute coach");
            setVoiceEnabled(true);
          }
        };

        recognition.onerror = () => {};
        recognition.onend = () => {
          if (cameraOn && runningRef.current) {
            try { recognition.start(); } catch {}
          }
        };

        recognition.start();
      } catch {}
    }

    return () => {
      if (recognition) {
        try { recognition.stop(); } catch {}
      }
    };
  }, [cameraOn]);

  useEffect(() => {
    if (running || !landmarksHistoryRef.current.length) return;
    const point = landmarksHistoryRef.current[replayFrameIndex];
    if (point) {
      if (hudMode === "3d" && replayThreeCanvasRef.current && replayOverlayRef.current) {
        replayThreeCanvasRef.current.width = replayOverlayRef.current.width || 640;
        replayThreeCanvasRef.current.height = replayOverlayRef.current.height || 360;

        if (!replayThreeStateRef.current) {
          replayThreeStateRef.current = initThreeHUD(replayThreeCanvasRef.current);
        }

        const targetW = replayOverlayRef.current.width || 640;
        const targetH = replayOverlayRef.current.height || 360;
        const state = replayThreeStateRef.current;
        if (state.renderer.domElement.width !== targetW || state.renderer.domElement.height !== targetH) {
          state.camera.aspect = targetW / targetH;
          state.camera.updateProjectionMatrix();
          state.renderer.setSize(targetW, targetH, false);
        }

        updateThreeHUD(
          state,
          point.landmarks,
          point.analysis.overall,
          0,
          false,
          exerciseIdRef.current,
          point.analysis
        );

        draw(replayOverlayRef.current, null, point.landmarks, point.analysis.overall, false, exerciseIdRef.current, point.analysis, true);
      } else if (replayOverlayRef.current) {
        draw(replayOverlayRef.current, null, point.landmarks, point.analysis.overall, false, exerciseIdRef.current, point.analysis, false);
      }
    }
  }, [replayFrameIndex, running, hudMode]);

  const qualityPercent = useMemo(() => Math.round(confidence.avgVisibility * 100), [confidence.avgVisibility]);
  const calibrationReady = cameraOn && confidence.ready && calibrationHoldProgress >= 18;
  const calibrationMessage = confidence.ready && calibrationHoldProgress < 18 ? "Hold steady so the coach can lock onto your setup." : confidence.message;
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
  const coachLevelDetail = useMemo(() => COACH_LEVELS.find((item) => item.id === coachLevel)?.detail ?? COACH_LEVELS[1].detail, [coachLevel]);
  const curlEvidence = useMemo(() => (exerciseId === "bicep_curl" ? summarizeCurlEvidence(curlRepScorecards) : null), [curlRepScorecards, exerciseId]);
  const squatEvidence = useMemo(() => (exerciseId === "squat" ? summarizeSquatEvidence(squatRepScorecards) : null), [squatRepScorecards, exerciseId]);
  const curlFocus = useMemo(() => buildCurlFocus(curlRepScorecards, curlCoachMemory), [curlCoachMemory, curlRepScorecards]);
  const teacherReport = useMemo(() => buildTeacherReport(curlEvidence, curlCoachMemory), [curlCoachMemory, curlEvidence]);
  const unreliableCameraGuidance = useMemo(() => buildUnreliableCameraGuidance(confidence), [confidence]);
  const sessionFocusMetric = useMemo(() => {
    if (mode === "dance") {
      return {
        label: "Hip-hop phrase timing",
        target: "Hit the count inside the phrase window",
        measuredValue: "Beat timing and transition score",
        cue: "Count the starter groove out loud and land the arm hit on the beat.",
      };
    }
    return agentReport?.focusMetric;
  }, [agentReport?.focusMetric, mode]);
  const livePrimaryMetric = useMemo(() => {
    const metric = analysis.metrics[0];
    if (metric) {
      return {
        label: metric.name,
        measured: metric.value != null ? `${Math.round(metric.value)}` : `${metric.score}/100`,
        target: metric.target ?? "Stay in the safe target range",
      };
    }
    if (danceComparison) {
      return {
        label: "Beat timing",
        measured: `${danceComparison.timingScore}/100`,
        target: "Arrive inside the phrase window",
      };
    }
    return {
      label: sessionFocusMetric?.label ?? "Setup quality",
      measured: `${qualityPercent}% tracking`,
      target: sessionFocusMetric?.target ?? "Reliable tracking before scoring",
    };
  }, [analysis.metrics, danceComparison, qualityPercent, sessionFocusMetric?.label, sessionFocusMetric?.target]);
  const preSessionWhy = useMemo(() => {
    const recommendedType = agentReport?.primarySessionRecommendation?.type;
    if (recommendedType && recommendedType !== "recovery" && recommendedType !== mode) {
      return mode === "dance"
        ? "You selected dance. The coach will still use your strongest available memory, then save hip-hop timing evidence after this session."
        : "You selected workout. The coach will still use your strongest available memory, then save scorecard evidence after this session.";
    }
    return agentReport?.primarySessionRecommendation?.reason ?? agentReport?.preSessionBrief?.reason;
  }, [agentReport, mode]);
  const setupSteps = useMemo(
    () => [
      { label: "Camera active", ready: cameraOn, detail: cameraOn ? cameraProfileLabel : "Enable laptop webcam" },
      { label: "Body centered", ready: confidence.centered, detail: confidence.centered ? "Centered" : "Move into the middle of the frame" },
      { label: "Distance", ready: !confidence.tooClose && !confidence.tooFar && confidence.avgVisibility > 0, detail: confidence.tooClose ? "Step back" : confidence.tooFar ? "Step closer" : "Distance looks usable" },
      { label: "Light", ready: confidence.brightness >= 35, detail: confidence.brightness >= 35 ? "Bright enough" : "Add light in front of you" },
      { label: "Curl baseline", ready: Boolean(curlBaseline?.ready), detail: curlBaseline?.message ?? "Hold shoulders, elbows, wrists, and hips visible" },
    ],
    [cameraOn, cameraProfileLabel, confidence.avgVisibility, confidence.brightness, confidence.centered, confidence.tooClose, confidence.tooFar, curlBaseline],
  );

  const cameraViewport = (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border bg-black shadow-[0_30px_100px_rgba(0,0,0,0.45)] transition-all duration-500",
        streakCount >= 5
          ? "border-fuchsia-500 shadow-[0_0_35px_rgba(217,70,239,0.5)] scale-[1.01]"
          : streakCount >= 3
            ? "border-cyan-500 shadow-[0_0_25px_rgba(6,182,212,0.4)]"
            : "border-zinc-800",
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
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full z-20" />
      {hudMode === "3d" && (
        <canvas ref={threeCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full z-10" />
      )}
      {showSparks && particlesInit && sparkPosition && (
        <Particles
          id="joint-sparks"
          className="absolute inset-0 h-full w-full pointer-events-none z-30"
          options={particlesConfig as any}
        />
      )}
      {exerciseId === "bicep_curl" && curlReferenceOverlay ? (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[18%] top-[28%] h-[42%] w-[22%] rounded-full border border-cyan-300/25" />
          <div className="absolute right-[18%] top-[28%] h-[42%] w-[22%] rounded-full border border-cyan-300/25" />
          <div className="absolute left-1/2 top-[30%] h-[42%] w-px -translate-x-1/2 bg-cyan-300/20" />
          <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 rounded-full border border-cyan-300/30 bg-zinc-950/55 px-3 py-1 text-xs text-cyan-100">
            Keep elbows close; forearms travel inside the guide.
          </div>
        </div>
      ) : null}

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

      <div className="absolute right-4 top-4 z-30 flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/80 p-0.5 backdrop-blur">
        <button
          onClick={() => setHudMode("2d")}
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer",
            hudMode === "2d"
              ? "bg-zinc-100 text-zinc-900 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          2D HUD
        </button>
        <button
          onClick={() => setHudMode("3d")}
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer",
            hudMode === "3d"
              ? "bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          3D HUD
        </button>
      </div>

      {trackingPausedReason ? (
        <div className="pointer-events-none absolute inset-x-4 top-16 rounded-2xl border border-amber-500/40 bg-zinc-950/85 p-3 text-sm text-amber-100">
          <p className="font-medium">{unreliableCameraGuidance?.title ?? "Tracking paused"}</p>
          <p className="mt-1">{unreliableCameraGuidance?.message ?? trackingPausedReason}</p>
        </div>
      ) : null}

      {!running ? (
        <div className="absolute inset-x-4 bottom-4">
          <SessionSetupCard
            cameraOn={cameraOn}
            loading={loading}
            ready={calibrationReady}
            title={`${exercise.label} setup`}
            description={exerciseDescription}
            calibration={exercise.calibration}
            confidenceMessage={calibrationMessage}
            whyThisSession={preSessionWhy}
            focusMetric={sessionFocusMetric}
            cameraState={{
              quality: confidence.frameQuality,
              readiness: qualityPercent,
              canUseDemoFallback: cameraOn && !calibrationReady && qualityPercent < 55,
            }}
            onEnableCamera={startCamera}
            onStartSession={startSession}
            onDemoFallback={activateDemoFallback}
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
          <div className="flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5">
            <Target className="h-4 w-4 text-emerald-300" />
            <span>Score {analysis.overall}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5">
            <CheckCircle2 className="h-4 w-4 text-cyan-300" />
            <span>{qualityPercent}% reliable</span>
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
                {mode === "workout" ? (
                  <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">Coach level</p>
                        <p className="mt-1 text-xs text-zinc-400">{exerciseId === "bicep_curl" ? coachLevelDetail : "Level controls are tuned for bicep curls first."}</p>
                      </div>
                      <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                        <div className="grid grid-cols-3 gap-2">
                          {COACH_LEVELS.map((item) => (
                            <Button
                              key={item.id}
                              size="sm"
                              variant={coachLevel === item.id ? "default" : "outline"}
                              className={cn(
                                "min-w-20",
                                coachLevel === item.id ? "bg-zinc-100 text-zinc-950 hover:bg-white" : "border-zinc-700 bg-zinc-950 text-zinc-200",
                              )}
                              onClick={() => setCoachLevel(item.id)}
                            >
                              {item.label}
                            </Button>
                          ))}
                        </div>
                        <Button size="sm" variant="outline" className="border-cyan-700/60 bg-cyan-500/10 text-cyan-100" onClick={loadCurlTeacherDemo}>
                          <Clipboard className="h-4 w-4" />
                          Teacher demo
                        </Button>
                        {exerciseId === "bicep_curl" ? (
                          <Button size="sm" variant="outline" className="border-zinc-700 bg-zinc-950 text-zinc-200" onClick={() => setCurlReferenceOverlay((value) => !value)}>
                            <Target className="h-4 w-4" />
                            Guide
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
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
                <CardDescription className="text-zinc-400">
                  {exerciseId === "bicep_curl"
                    ? `${coachLevel[0].toUpperCase()}${coachLevel.slice(1)} curl coaching: ${coachLevelDetail}`
                    : "Safety overrides everything else. The coach only speaks when the issue is stable enough to matter."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={cn("rounded-2xl border p-4", analysis.injuryRisks.length ? "border-rose-500/40 bg-rose-500/10" : analysis.corrections.length ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10")}>
                  <p className="text-lg font-semibold">{unreliableCameraGuidance ? unreliableCameraGuidance.title : feedback}</p>
                  <p className="mt-2 text-sm text-zinc-300">{unreliableCameraGuidance ? unreliableCameraGuidance.message : secondaryFeedback}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Primary correction</p>
                    <p className="mt-2 text-sm text-zinc-200">
                      {unreliableCameraGuidance ? "Fix camera reliability first." : analysis.corrections[0] ?? danceComparison?.primaryIssue ?? sessionFocusMetric?.cue ?? "Hold steady and keep the rhythm controlled."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Measured value</p>
                    <p className="mt-2 text-sm font-medium text-zinc-100">{livePrimaryMetric.label}</p>
                    <p className="mt-1 text-sm text-zinc-300">{livePrimaryMetric.measured}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Target range</p>
                    <p className="mt-2 text-sm text-zinc-200">{livePrimaryMetric.target}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">What is right</p>
                    <p className="mt-2 text-sm text-zinc-200">{analysis.positives[0] ?? "Hold the current shape and keep the rhythm stable."}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Fix now</p>
                    <p className="mt-2 text-sm text-zinc-200">{unreliableCameraGuidance ? unreliableCameraGuidance.reason : analysis.corrections[0] ?? analysis.targetCue ?? "No immediate correction. Stay consistent."}</p>
                  </div>
                </div>
                {exerciseId === "bicep_curl" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-cyan-200" />
                        <p className="text-sm font-medium text-cyan-100">One issue focus</p>
                      </div>
                      <p className="mt-2 text-sm text-zinc-200">
                        {curlFocus ? (curlFocus.improved ? `${curlFocus.label} improved. Keep the same shape for 2 more reps.` : curlFocus.cue) : "After the first scored rep, the coach will choose one correction instead of stacking many cues."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-fuchsia-300" />
                        <p className="text-sm font-medium text-zinc-200">Coach memory</p>
                      </div>
                      <p className="mt-2 text-sm text-zinc-300">
                        {curlCoachMemory?.primaryMetric
                          ? `Last curl session: watch ${curlCoachMemory.primaryMetric.toLowerCase()} first. Average ${curlCoachMemory.lastAverageScore}, reliability ${curlCoachMemory.reliabilityAverage}%.`
                          : "No curl memory yet. Complete or load a curl set to save the main next-session focus."}
                      </p>
                    </div>
                  </div>
                ) : null}
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
                {exerciseId === "bicep_curl" ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Curl setup wizard</p>
                    <div className="mt-3 grid gap-2">
                      {setupSteps.map((step) => (
                        <div key={step.label} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            {step.ready ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" /> : <XCircle className="h-4 w-4 shrink-0 text-amber-300" />}
                            <span className="text-sm font-medium text-zinc-100">{step.label}</span>
                          </div>
                          <span className="text-right text-xs text-zinc-400">{step.detail}</span>
                        </div>
                      ))}
                    </div>
                    {coachLevel === "hard" && !curlBaseline?.ready ? (
                      <p className="mt-3 text-xs text-amber-200">Hard mode stays locked until the curl baseline is reliable enough to judge small errors.</p>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Muscle Engagement Heatmap HUD Card */}
            {running && (
              <Card className="border-zinc-800 bg-zinc-950/70 text-zinc-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold tracking-wider text-zinc-300">MUSCLE ENGAGEMENT HUD</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Active Movers</span>
                    <span>Intensity: {Math.min(100, repsRef.current * 10)}%</span>
                  </div>
                  <div className="flex items-center justify-center gap-6 rounded-2xl border border-zinc-900 bg-zinc-900/40 p-4">
                    <svg viewBox="0 0 100 160" className="h-28 w-20 drop-shadow-[0_0_10px_rgba(0,0,0,0.55)]">
                      <circle cx="50" cy="18" r="10" className="fill-zinc-800/60 stroke-zinc-700/50" />
                      <rect
                        x="38"
                        y="38"
                        width="24"
                        height="42"
                        rx="4"
                        className={cn(
                          "transition-all duration-500",
                          exerciseId === "plank" || exerciseId === "pushup" || exerciseId === "squat" || exerciseId === "lunge"
                            ? Math.min(100, repsRef.current * 10) >= 80
                              ? "fill-rose-500/80 stroke-rose-400 animate-pulse"
                              : Math.min(100, repsRef.current * 10) >= 50
                                ? "fill-orange-500/70 stroke-orange-400"
                                : Math.min(100, repsRef.current * 10) >= 20
                                  ? "fill-amber-500/60 stroke-amber-400"
                                  : "fill-yellow-500/45 stroke-yellow-400/60"
                            : "fill-zinc-800/40 stroke-zinc-700/50"
                        )}
                      />
                      <path
                        d="M34,42 L24,65 L18,85 M66,42 L76,65 L82,85"
                        fill="none"
                        strokeWidth="6"
                        strokeLinecap="round"
                        className={cn(
                          "transition-all duration-500",
                          exerciseId === "bicep_curl" || exerciseId === "pushup" || exerciseId === "plank"
                            ? Math.min(100, repsRef.current * 10) >= 80
                              ? "stroke-rose-500/80 animate-pulse"
                              : Math.min(100, repsRef.current * 10) >= 50
                                ? "stroke-orange-500/70"
                                : Math.min(100, repsRef.current * 10) >= 20
                                  ? "stroke-amber-500/60"
                                  : "stroke-yellow-500/45"
                            : "stroke-zinc-800/40"
                        )}
                      />
                      <path
                        d="M42,80 L38,115 L36,150 M58,80 L62,115 L64,150"
                        fill="none"
                        strokeWidth="7"
                        strokeLinecap="round"
                        className={cn(
                          "transition-all duration-500",
                          exerciseId === "squat" || exerciseId === "lunge" || exerciseId === "jumping_jack" || exerciseId === "warrior"
                            ? Math.min(100, repsRef.current * 10) >= 80
                              ? "stroke-rose-500/80 animate-pulse"
                              : Math.min(100, repsRef.current * 10) >= 50
                                ? "stroke-orange-500/70"
                                : Math.min(100, repsRef.current * 10) >= 20
                                  ? "stroke-amber-500/60"
                                  : "stroke-yellow-500/45"
                            : "stroke-zinc-800/40"
                        )}
                      />
                    </svg>
                    <div className="flex flex-col gap-1.5 text-[11px] text-zinc-300">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", exerciseId === "bicep_curl" || exerciseId === "pushup" ? "bg-rose-400 animate-pulse" : "bg-zinc-700")} />
                        <span>Arms / Chest</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", exerciseId === "plank" || exerciseId === "pushup" ? "bg-amber-400" : "bg-zinc-700")} />
                        <span>Core Stabilizers</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2.5 w-2.5 rounded-full", exerciseId === "squat" || exerciseId === "lunge" ? "bg-cyan-400" : "bg-zinc-700")} />
                        <span>Legs (Quads/Glutes)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                {exerciseId === "bicep_curl" ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Curl accuracy</p>
                        <p className="mt-2 text-sm text-zinc-300">
                          {curlBaseline?.ready
                            ? `Baseline locked at ${Math.round(curlBaseline.confidence * 100)}% confidence.`
                            : curlBaseline?.message ?? "Enable camera and hold a stable curl setup to lock the baseline."}
                        </p>
                      </div>
                      <Badge className={cn("w-fit", curlBaseline?.ready ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300")}>
                        {curlBaseline?.ready ? "Baseline ready" : "Calibrating"}
                      </Badge>
                    </div>
                    {curlDemoActive ? <Badge className="mt-3 bg-cyan-500/15 text-cyan-200">Teacher demo evidence loaded</Badge> : null}
                    {curlEvidence?.totalReps ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <p className="text-xs text-zinc-500">Average</p>
                          <p className={cn("mt-1 text-xl font-semibold", text(curlEvidence.averageScore))}>{curlEvidence.averageScore}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <p className="text-xs text-zinc-500">Best</p>
                          <p className="mt-1 text-xl font-semibold text-emerald-300">Rep {curlEvidence.bestRep}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <p className="text-xs text-zinc-500">Worst</p>
                          <p className="mt-1 text-xl font-semibold text-rose-300">Rep {curlEvidence.worstRep}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <p className="text-xs text-zinc-500">Trend</p>
                          <p className={cn("mt-1 text-xl font-semibold", curlEvidence.improvementTrend >= 0 ? "text-emerald-300" : "text-rose-300")}>
                            {curlEvidence.improvementTrend >= 0 ? "+" : ""}
                            {curlEvidence.improvementTrend}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {curlRepScorecards.length ? (
                      <div className="mt-4 space-y-2">
                        {curlRepScorecards.slice(-5).map((rep) => (
                          <div key={rep.repNumber} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-zinc-100">Rep {rep.repNumber}</p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {rep.status === "pass"
                                    ? "Clean rep"
                                    : rep.worstMetric
                                      ? `Lowest: ${rep.metrics[rep.worstMetric].label}`
                                      : "Needs review"}
                                </p>
                              </div>
                              <Badge
                                className={cn(statusTone(rep.status))}
                              >
                                {rep.overall}
                              </Badge>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {Object.values(rep.metrics)
                                .filter((metric) => metric.status === "fail" || metric.status === "warning")
                                .slice(0, 4)
                                .map((metric) => (
                                  <div key={`${rep.repNumber}-${metric.key}`} className={cn("rounded-lg border px-2 py-2 text-xs text-zinc-300", metricTone(metric.status))}>
                                    <span className="font-medium text-zinc-100">{metric.label}</span>: {metric.reliable ? metric.score : "not reliable"}
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-zinc-500">Rep timeline heatmap</p>
                          <div className="grid min-w-[640px] gap-2" style={{ gridTemplateColumns: "80px repeat(8, minmax(64px, 1fr))" }}>
                            <div className="text-xs text-zinc-500">Rep</div>
                            {(["elbowPath", "shoulderStability", "torsoStability", "wristStack", "topFinish", "bottomExtension", "tempo", "symmetry"] as CurlMetricKey[]).map((key) => (
                              <div key={key} className="truncate text-xs text-zinc-500">{getCurlMetricLabel(key)}</div>
                            ))}
                            {curlRepScorecards.map((rep) => (
                              <div key={`rep-row-${rep.repNumber}`} className="contents">
                                <div className="text-sm font-medium text-zinc-100">Rep {rep.repNumber}</div>
                                {(["elbowPath", "shoulderStability", "torsoStability", "wristStack", "topFinish", "bottomExtension", "tempo", "symmetry"] as CurlMetricKey[]).map((key) => {
                                  const metric = rep.metrics[key];
                                  return (
                                    <div key={`${rep.repNumber}-${key}`} className={cn("rounded-md border px-2 py-1 text-xs text-zinc-100", metricTone(metric.status))}>
                                      {metric.reliable ? metric.score : "n/a"}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-zinc-400">Rep scorecards will appear here after each completed curl.</p>
                    )}
                  </div>
                ) : null}
                {exerciseId === "squat" ? (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Squat accuracy</p>
                        <p className="mt-2 text-sm text-zinc-300">Rep scorecards track depth, knee tracking, torso stack, hip centering, symmetry, shoulder stability, and tempo.</p>
                      </div>
                      {squatEvidence?.totalReps ? <Badge className="w-fit bg-emerald-500/15 text-emerald-300">{squatEvidence.totalReps} scored reps</Badge> : null}
                    </div>
                    {squatEvidence?.totalReps ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <p className="text-xs text-zinc-500">Average</p>
                          <p className={cn("mt-1 text-xl font-semibold", text(squatEvidence.averageScore))}>{squatEvidence.averageScore}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <p className="text-xs text-zinc-500">Best</p>
                          <p className="mt-1 text-xl font-semibold text-emerald-300">Rep {squatEvidence.bestRep}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <p className="text-xs text-zinc-500">Worst</p>
                          <p className="mt-1 text-xl font-semibold text-rose-300">Rep {squatEvidence.worstRep}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <p className="text-xs text-zinc-500">Reliability</p>
                          <p className="mt-1 text-xl font-semibold text-cyan-300">{squatEvidence.reliabilityAverage}%</p>
                        </div>
                      </div>
                    ) : null}
                    {squatRepScorecards.length ? (
                      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                        <p className="mb-3 text-xs uppercase tracking-[0.24em] text-zinc-500">Squat rep heatmap</p>
                        <div className="grid min-w-[620px] gap-2" style={{ gridTemplateColumns: "80px repeat(7, minmax(70px, 1fr))" }}>
                          <div className="text-xs text-zinc-500">Rep</div>
                          {(["depth", "kneeTracking", "torsoStack", "hipCentering", "symmetry", "shoulderStability", "tempo"] as SquatMetricKey[]).map((key) => (
                            <div key={key} className="truncate text-xs text-zinc-500">{getSquatMetricLabel(key)}</div>
                          ))}
                          {squatRepScorecards.map((rep) => (
                            <div key={`squat-rep-row-${rep.repNumber}`} className="contents">
                              <div className="text-sm font-medium text-zinc-100">Rep {rep.repNumber}</div>
                              {(["depth", "kneeTracking", "torsoStack", "hipCentering", "symmetry", "shoulderStability", "tempo"] as SquatMetricKey[]).map((key) => {
                                const metric = rep.metrics[key];
                                return (
                                  <div key={`${rep.repNumber}-${key}`} className={cn("rounded-md border px-2 py-1 text-xs text-zinc-100", metricTone(metric.status))}>
                                    {metric.reliable ? metric.score : "n/a"}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-zinc-400">Squat scorecards will appear here after each completed rep.</p>
                    )}
                  </div>
                ) : null}
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
                  <CardTitle>Hip-hop routine sync</CardTitle>
                  <CardDescription className="text-zinc-400">Packaged phrase checkpoints drive pose shape, groove bounce, timing, and transition scoring.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-zinc-100">{danceRoutine?.name ?? "Loading routine"}</p>
                      <Badge className="w-fit bg-fuchsia-500/15 text-fuchsia-200">{danceRoutine?.style === "hip_hop" ? "Hip-hop" : "Dance"}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">{activeDanceCheckpoint?.step.cue ?? "Waiting for the first phrase."}</p>
                  </div>
                  {danceComparison ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Shape</p><p className="mt-2 text-2xl font-semibold">{danceComparison.poseSimilarity}</p></div>
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Timing</p><p className="mt-2 text-2xl font-semibold">{danceComparison.timingScore}</p></div>
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Transition</p><p className="mt-2 text-2xl font-semibold">{danceComparison.transitionQuality}</p></div>
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Reliability</p><p className="mt-2 text-2xl font-semibold">{danceComparison.reliability}%</p></div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {Object.values(danceComparison.metrics).map((metric) => (
                          <div key={metric.key} className={cn("rounded-xl border px-3 py-3", metricTone(metric.status))}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-zinc-100">{metric.label}</p>
                                <p className="mt-1 text-xs text-zinc-400">{metric.detail}</p>
                                {metric.target ? <p className="mt-1 text-[11px] text-zinc-500">Target: {metric.target}</p> : null}
                              </div>
                              <span className={cn("text-sm font-semibold", text(metric.score))}>{metric.reliable ? metric.score : "n/a"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {danceComparison.notes.length ? (
                        <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/10 p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-200/70">Primary hip-hop correction</p>
                          <p className="mt-2 text-sm text-zinc-200">{danceComparison.notes[0]}</p>
                        </div>
                      ) : null}
                    </>
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
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">What improved</p>
                      <p className="mt-2 text-sm text-zinc-200">
                        {summaryInsights[0] ?? (analysis.positives[0] || "The session is saved, so the coach has stronger evidence for the next recommendation.")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-rose-200/70">What failed most</p>
                      <p className="mt-2 text-sm text-zinc-200">
                        {topMistakes[0]?.mistake ?? summaryPractice[0] ?? sessionFocusMetric?.label ?? "No repeated failed metric was detected."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Next action</p>
                      <p className="mt-2 text-sm text-zinc-200">
                        {postSessionAgent?.postSessionNextAction?.nextAction ?? agentReport?.postSessionNextAction?.nextAction ?? summaryPractice[0] ?? "Repeat this module once more with one correction focus."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-amber-200/70">Achievement progress</p>
                      <p className="mt-2 text-sm text-zinc-200">
                        {(postSessionAgent?.closestAchievement ?? agentReport?.closestAchievement)
                          ? `${(postSessionAgent?.closestAchievement ?? agentReport?.closestAchievement)?.name}: ${(postSessionAgent?.closestAchievement ?? agentReport?.closestAchievement)?.progress}/${(postSessionAgent?.closestAchievement ?? agentReport?.closestAchievement)?.threshold}. ${(postSessionAgent?.closestAchievement ?? agentReport?.closestAchievement)?.nextAction}`
                          : "Complete more sessions to open the next achievement chase."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100" onClick={() => {
                      reset();
                      setSummary("");
                      setSummaryInsights([]);
                      setSummaryPractice([]);
                      setTopMistakes([]);
                      setCorrectivePlan([]);
                    }}>
                      <RotateCcw className="h-4 w-4" />
                      Repeat session
                    </Button>
                    <Button size="sm" className="bg-cyan-500 text-white hover:bg-cyan-600" onClick={() => {
                      window.location.href = (postSessionAgent?.primarySessionRecommendation ?? agentReport?.primarySessionRecommendation)?.href ?? (mode === "dance" ? "/coach/dance" : "/coach/workout");
                    }}>
                      <Target className="h-4 w-4" />
                      Recommended next
                    </Button>
                    <Button size="sm" variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100" onClick={() => {
                      window.location.href = "/coach/chat";
                    }}>
                      <Brain className="h-4 w-4" />
                      Ask coach
                    </Button>
                    <Button size="sm" variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100" onClick={async () => {
                      const achievement = postSessionAgent?.closestAchievement ?? agentReport?.closestAchievement;
                      const report = [
                        summary,
                        `Improved: ${summaryInsights[0] ?? analysis.positives[0] ?? "session evidence saved"}`,
                        `Failed most: ${topMistakes[0]?.mistake ?? sessionFocusMetric?.label ?? "none"}`,
                        `Next: ${postSessionAgent?.postSessionNextAction?.nextAction ?? agentReport?.postSessionNextAction?.nextAction ?? summaryPractice[0] ?? "repeat session"}`,
                        achievement ? `Achievement: ${achievement.name} ${achievement.progress}/${achievement.threshold}. ${achievement.nextAction}` : "",
                      ].filter(Boolean).join("\n");
                      try {
                        await navigator.clipboard.writeText(report);
                        toast.success("Report copied");
                      } catch {
                        toast.error("Could not copy report");
                      }
                    }}>
                      <Clipboard className="h-4 w-4" />
                      Copy report
                    </Button>
                  </div>
                  {exerciseId === "bicep_curl" && curlEvidence?.totalReps ? (
                    <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Teacher report card</p>
                          <p className="mt-2 text-sm text-zinc-200">
                            {curlEvidence.totalReps} reps, average {curlEvidence.averageScore}, best rep {curlEvidence.bestRep}, worst rep {curlEvidence.worstRep}.{" "}
                            {curlEvidence.recurringFailedMetrics.length ? `Practice ${curlEvidence.recurringFailedMetrics[0].toLowerCase()} next.` : "No repeated failed metric."}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-cyan-700/60 bg-zinc-950/70 text-cyan-100"
                          onClick={async () => {
                            if (!teacherReport) return;
                            try {
                              await navigator.clipboard.writeText(teacherReport);
                              setReportCopied(true);
                              toast.success("Report copied");
                            } catch {
                              toast.error("Could not copy report");
                            }
                          }}
                        >
                          <Clipboard className="h-4 w-4" />
                          {reportCopied ? "Copied" : "Copy report"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
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

            {/* Visual Set Replay HUD */}
            {!running && landmarksHistoryRef.current.length > 0 && (
              <Card className="border-zinc-800 bg-zinc-950/70 text-zinc-100 mt-4">
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div className="mr-4">
                    <CardTitle className="text-sm font-semibold tracking-wider text-zinc-300">VISUAL SET REPLAY HUD</CardTitle>
                    <CardDescription className="text-zinc-400">Scrub the timeline to analyze your skeleton coordinates and joint metrics frame-by-frame.</CardDescription>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/80 p-0.5 backdrop-blur shrink-0 mt-0.5">
                    <button
                      onClick={() => setHudMode("2d")}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer",
                        hudMode === "2d"
                          ? "bg-zinc-100 text-zinc-900 shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      2D HUD
                    </button>
                    <button
                      onClick={() => setHudMode("3d")}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer",
                        hudMode === "3d"
                          ? "bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                          : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      3D HUD
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative aspect-video w-full overflow-hidden rounded-[20px] border border-zinc-800 bg-black shadow-inner">
                    <canvas ref={replayOverlayRef} className="absolute inset-0 h-full w-full z-20 pointer-events-none" />
                    {hudMode === "3d" && (
                      <canvas ref={replayThreeCanvasRef} className="absolute inset-0 h-full w-full z-10 pointer-events-none" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-300">
                      <span>Frame {replayFrameIndex + 1} of {landmarksHistoryRef.current.length}</span>
                      <span>Rep Phase: <span className="font-semibold text-cyan-300 uppercase">{landmarksHistoryRef.current[replayFrameIndex]?.analysis.phase ?? "N/A"}</span></span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={landmarksHistoryRef.current.length - 1}
                      value={replayFrameIndex}
                      onChange={(e) => setReplayFrameIndex(Number(e.target.value))}
                      className="w-full accent-cyan-500 bg-zinc-800 h-2 rounded-lg cursor-pointer transition-all"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
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
