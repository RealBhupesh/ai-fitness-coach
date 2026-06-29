"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, Award, Camera, CheckCircle2, Clock3, Gauge, History, Medal, Music2, Play, Radio, Repeat2, Sparkles, Target, Trophy, Video } from "lucide-react";
import PoseAnalyzer from "@/components/PoseAnalyzer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DanceRoutinePack, DanceTutorialStep } from "@/lib/dance/types";

type RoutineResponse = {
  routine?: DanceRoutinePack & { tutorial?: DanceTutorialStep[] };
  course?: DanceCourseState;
};

type DanceCourseState = {
  routineId: string;
  passScore: number;
  passReliability: number;
  completionPercent: number;
  completedLessons: number;
  totalLessons: number;
  nextLesson: DanceLessonProgress | null;
  lessons: DanceLessonProgress[];
  recentAttempts: Array<{
    id: string;
    segmentId: string;
    mode: string;
    score: number;
    reliability: number;
    timingScore: number;
    transitionScore: number;
    completed: boolean;
    createdAt: string;
  }>;
  leaderboard: Array<{
    id: string;
    name: string;
    role: string;
    level: string;
    score: number;
    streak: number;
    sessions: number;
    danceScore: number;
    topMove: string;
    trend: "up" | "steady";
  }>;
};

type DanceLessonProgress = {
  segmentId: string;
  title: string;
  count: string;
  status: "not_started" | "practicing" | "completed";
  bestScore: number;
  bestReliability: number;
  attempts: number;
  completedAt: string | null;
  lastAttemptAt: string | null;
};

const practiceTargets = [
  { label: "Timing", value: "Land counts 2 and 4", icon: Clock3 },
  { label: "Shape", value: "Wide arms, stacked torso", icon: Target },
  { label: "Groove", value: "Soft knees through the bounce", icon: Activity },
  { label: "Score", value: "Aim for 85+ reliability", icon: Gauge },
];

const sessionFlow = [
  "Learn the phrase counts",
  "Mirror the reference skeleton",
  "Run a 60 second scoring attempt",
  "Review weak metrics and repeat",
];

const routineLibrary = [
  { id: "starter-groove-pack", title: "Hip-Hop Starter Groove", difficulty: "Beginner", requirement: "Open now", locked: false },
  { id: "groove-builder-two", title: "Groove Builder II", difficulty: "Beginner+", requirement: "Finish 4 lessons", locked: true },
  { id: "zumba-cardio-baseline", title: "Zumba Cardio Baseline", difficulty: "Intermediate", requirement: "Score 80+ in starter", locked: true },
  { id: "bollywood-hit-combo", title: "Bollywood Hit Combo", difficulty: "Intermediate", requirement: "Complete starter course", locked: true },
];

export default function DanceStudio() {
  const [routine, setRoutine] = useState<RoutineResponse["routine"] | null>(null);
  const [course, setCourse] = useState<DanceCourseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [practiceMode, setPracticeMode] = useState<"guided_practice" | "full_routine">("guided_practice");
  const [setupReady, setSetupReady] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [countInEnabled, setCountInEnabled] = useState(true);
  const [loopSelectedStep, setLoopSelectedStep] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadCourse = async () => {
      try {
        const response = await fetch("/api/dance/course", { credentials: "include", cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as RoutineResponse;
        if (!cancelled) {
          setRoutine(data.routine ?? null);
          setCourse(data.course ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadCourse();
    return () => {
      cancelled = true;
    };
  }, []);

  const tutorial = useMemo(() => routine?.tutorial ?? [], [routine]);
  const currentStep = tutorial[activeStep] ?? tutorial[0];
  const currentSegment = currentStep ? routine?.segments.find((segment) => segment.id === currentStep.segmentId) : null;
  const progressBySegment = useMemo(() => new Map((course?.lessons ?? []).map((lesson) => [lesson.segmentId, lesson])), [course]);
  const currentProgress = currentStep ? progressBySegment.get(currentStep.segmentId) : null;
  const leaderboard = course?.leaderboard ?? [];
  const recentAttempts = course?.recentAttempts ?? [];
  const courseComplete = Boolean(course && course.totalLessons > 0 && course.completedLessons === course.totalLessons);

  const recordGuidedPractice = async () => {
    if (!routine || !currentStep) return;
    setSavingAttempt(true);
    try {
      const score = Math.max(72, Math.min(92, (currentProgress?.bestScore ?? 72) + 6));
      const reliability = Math.max(74, Math.min(90, (currentProgress?.bestReliability ?? 72) + 5));
      const response = await fetch("/api/dance/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          routineId: routine.id,
          segmentId: currentStep.segmentId,
          mode: practiceMode,
          score,
          reliability,
          timingScore: Math.max(0, score - 3),
          transitionScore: Math.max(0, score - 6),
          durationSeconds: practiceMode === "guided_practice" ? 60 : Math.round((routine.durationMs ?? 60000) / 1000),
          notes: currentStep.title,
        }),
      });
      const data = await response.json();
      if (response.ok && data.course) {
        setCourse(data.course);
      }
    } finally {
      setSavingAttempt(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_34rem),linear-gradient(180deg,color-mix(in_oklch,var(--background)_88%,black),var(--background)_46rem)]">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-lg border bg-card/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1">
                <Radio className="h-3.5 w-3.5" />
                Dance AI Studio
              </Badge>
              <Badge variant="secondary">{routine?.difficulty ?? "beginner"}</Badge>
              <Badge variant="outline">{routine?.bpm ?? 96} BPM</Badge>
              <Badge variant="outline">{course?.completionPercent ?? 0}% complete</Badge>
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-black uppercase leading-[0.92] md:text-6xl">
              {routine?.name ?? "Hip-Hop Starter Groove"}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
              {routine?.description ?? "Learn the routine in counted sections, then use the live AI coach to score timing, body shape, groove bounce, torso control, and transitions."}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {practiceTargets.map((target) => {
                const Icon = target.icon;
                return (
                  <div key={target.label} className="rounded-lg border bg-background/55 p-3">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="mt-2 text-sm font-semibold">{target.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{target.value}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 rounded-lg border bg-background/55 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Course progress</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {course ? `${course.completedLessons}/${course.totalLessons} lessons complete. Next: ${course.nextLesson?.title ?? "course review"}.` : "Loading course progress..."}
                  </p>
                </div>
                <Badge>{course?.passScore ?? 80}+ score / {course?.passReliability ?? 70}+ reliability</Badge>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${course?.completionPercent ?? 0}%` }} />
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button className="gap-2" onClick={() => document.getElementById("live-dance-coach")?.scrollIntoView({ behavior: "smooth" })}>
                <Play className="h-4 w-4" />
                Start live coach
              </Button>
              <Link href="/achievements">
                <Button variant="outline" className="w-full gap-2 sm:w-auto">
                  <Trophy className="h-4 w-4" />
                  View dance achievements
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <Card className="border-accent/20 bg-card/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Medal className="h-5 w-5 text-accent" />
                  Class Scores
                </CardTitle>
                <CardDescription>Use the leaderboard as a realistic benchmark for the viva/demo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {leaderboard.slice(0, 3).map((athlete, index) => (
                  <div key={athlete.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border bg-background/45 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/15 text-xs font-black text-accent">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{athlete.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{athlete.topMove} - {athlete.streak} day streak</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black">{athlete.danceScore}</p>
                      <p className="text-xs text-muted-foreground">dance</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-card/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Session Flow
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sessionFlow.map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-md border bg-background/45 p-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">{index + 1}. {item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-primary/20 bg-card/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Routine Library
              </CardTitle>
              <CardDescription>Difficulty unlock path for the dance course roadmap.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {routineLibrary.map((item) => {
                const unlocked = !item.locked || (item.id === "groove-builder-two" && (course?.completedLessons ?? 0) >= 4) || (courseComplete && item.id !== "starter-groove-pack");
                return (
                  <div key={item.id} className={`rounded-lg border p-4 ${unlocked ? "bg-background/45" : "bg-muted/20 opacity-80"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.difficulty}</p>
                      </div>
                      <Badge variant={unlocked ? "default" : "secondary"}>{unlocked ? "Open" : "Locked"}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">{unlocked ? "Ready for practice." : item.requirement}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-accent/20 bg-card/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-accent" />
                Audio Sync
              </CardTitle>
              <CardDescription>Count-in and loop controls for phrase practice.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button type="button" onClick={() => setCountInEnabled((value) => !value)} className="flex w-full items-center justify-between rounded-lg border bg-background/45 p-3 text-left">
                <div>
                  <p className="font-semibold">Four-count start</p>
                  <p className="text-xs text-muted-foreground">Count 5-6-7-8 before scoring begins.</p>
                </div>
                <Badge>{countInEnabled ? "On" : "Off"}</Badge>
              </button>
              <button type="button" onClick={() => setLoopSelectedStep((value) => !value)} className="flex w-full items-center justify-between rounded-lg border bg-background/45 p-3 text-left">
                <div>
                  <p className="font-semibold">Loop selected phrase</p>
                  <p className="text-xs text-muted-foreground">{currentStep ? `Practice ${currentStep.title} until it passes.` : "Choose a tutorial step."}</p>
                </div>
                <Badge>{loopSelectedStep ? "Loop" : "Full"}</Badge>
              </button>
              <div className="rounded-lg border bg-primary/10 p-3">
                <p className="text-sm font-semibold">{countInEnabled ? "5 - 6 - 7 - 8" : "Free start"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {loopSelectedStep && currentStep ? `${currentStep.count}: ${currentStep.practiceCue}` : "Run the full 60 second routine."}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {courseComplete ? (
          <Card className="overflow-hidden border-primary/30 bg-primary/10">
            <CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <Badge>Course Certificate</Badge>
                <h2 className="mt-3 text-3xl font-black uppercase leading-none">Starter Groove Completed</h2>
                <p className="mt-2 text-sm text-muted-foreground">All phrase lessons are passed. Repeat the full routine to raise your best score.</p>
              </div>
              <Button className="gap-2" onClick={() => document.getElementById("live-dance-coach")?.scrollIntoView({ behavior: "smooth" })}>
                <Play className="h-4 w-4" />
                Improve score
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
          <Card className="border-primary/20 bg-card/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music2 className="h-5 w-5 text-primary" />
                Tutorial Steps
              </CardTitle>
              <CardDescription>{loading ? "Loading routine..." : "Each step maps to a scored phrase segment."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                {tutorial.length ? tutorial.map((step, index) => {
                  const progress = progressBySegment.get(step.segmentId);
                  const completed = progress?.status === "completed";
                  const practicing = progress?.status === "practicing";
                  return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`w-full rounded-lg border p-3 text-left transition ${index === activeStep ? "border-primary bg-primary/10" : "bg-background/45 hover:border-primary/50"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{step.order}. {step.title}</p>
                    <div className="flex items-center gap-2">
                      {completed ? <Badge>Passed</Badge> : practicing ? <Badge variant="secondary">Practice</Badge> : null}
                      <Badge variant={index === activeStep ? "default" : "secondary"}>{step.count}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{step.practiceCue}</p>
                  {progress?.attempts ? (
                    <p className="mt-2 text-xs text-muted-foreground">Best {progress.bestScore}/100 - reliability {progress.bestReliability}% - {progress.attempts} attempts</p>
                  ) : null}
                </button>
                  );
                }) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Tutorial steps will appear when the routine pack is available.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-accent/20 bg-card/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                Active Step Coach
              </CardTitle>
              <CardDescription>Count, mistake, correction, and target metrics for the selected phrase.</CardDescription>
            </CardHeader>
            <CardContent>
              {currentStep ? (
                <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-lg border bg-background/45 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{currentStep.count}</Badge>
                      {currentProgress ? <Badge variant="secondary">Best {currentProgress.bestScore}</Badge> : null}
                      {currentProgress?.status === "completed" ? <Badge>Completed</Badge> : null}
                    </div>
                    <h2 className="mt-3 text-3xl font-black uppercase leading-none">{currentStep.title}</h2>
                    <p className="mt-3 text-sm text-muted-foreground">{currentStep.teachingCue}</p>
                    <div className="mt-4 rounded-md border bg-muted/25 p-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Common mistake</p>
                      <p className="mt-1 text-sm">{currentStep.commonMistake}</p>
                    </div>
                    <div className="mt-3 rounded-md border bg-primary/10 p-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Correction</p>
                      <p className="mt-1 text-sm">{currentStep.correction}</p>
                    </div>
                    <div className="mt-3 flex rounded-md border bg-background/55 p-1">
                      {(["guided_practice", "full_routine"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPracticeMode(mode)}
                          className={`flex-1 rounded px-3 py-2 text-xs font-semibold transition ${practiceMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                        >
                          {mode === "guided_practice" ? "Guided practice" : "Full routine"}
                        </button>
                      ))}
                    </div>
                    <Button className="mt-3 w-full gap-2" onClick={recordGuidedPractice} disabled={savingAttempt}>
                      <Repeat2 className="h-4 w-4" />
                      {savingAttempt ? "Saving attempt..." : "Record practice attempt"}
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="overflow-hidden rounded-lg border bg-background/45 sm:col-span-2">
                      {/* Existing routine thumbnail doubles as the first production reference asset. */}
                      <img src={routine?.thumbnailUrl ?? "/routines/starter-groove-thumbnail.svg"} alt={`${currentStep.title} reference pose`} className="h-40 w-full object-cover" />
                      <div className="flex items-center justify-between gap-3 p-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Video className="h-4 w-4 text-accent" />
                          Reference media
                        </div>
                        <Badge variant="outline">Skeleton preview</Badge>
                      </div>
                    </div>
                    {currentSegment ? (
                      [
                        { label: "Frame width", value: `${currentSegment.targetMetrics.frameWidth[0]}-${currentSegment.targetMetrics.frameWidth[1]}` },
                        { label: "Arm lift", value: `${currentSegment.targetMetrics.armLift[0]}-${currentSegment.targetMetrics.armLift[1]}` },
                        { label: "Torso lean max", value: `${currentSegment.targetMetrics.torsoLeanMax}` },
                        { label: "Knee angle", value: `${currentSegment.targetMetrics.kneeAngle[0]}-${currentSegment.targetMetrics.kneeAngle[1]}` },
                      ].map((metric) => (
                        <div key={metric.label} className="rounded-lg border bg-background/45 p-4">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">{metric.label}</p>
                          <p className="mt-2 text-2xl font-black">{metric.value}</p>
                        </div>
                      ))
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Select a tutorial step to view coach details.</div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="border-primary/20 bg-card/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                Camera Setup
              </CardTitle>
              <CardDescription>Frame the body before requesting live scoring.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {["Stand 6-8 feet from the camera", "Keep head, wrists, hips, knees, and ankles visible", "Use front lighting and avoid backlight", "Clear one arm-span of floor space"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-md border bg-background/45 p-3">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
              <Button variant={setupReady ? "secondary" : "default"} className="w-full gap-2" onClick={() => setSetupReady((value) => !value)}>
                <Camera className="h-4 w-4" />
                {setupReady ? "Setup confirmed" : "I am framed correctly"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-accent/20 bg-card/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-accent" />
                Attempt History
              </CardTitle>
              <CardDescription>Saved practice and full-routine attempts for this course.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentAttempts.length ? recentAttempts.slice(0, 5).map((attempt) => {
                const lesson = progressBySegment.get(attempt.segmentId);
                return (
                  <div key={attempt.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border bg-background/45 p-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{lesson?.title ?? attempt.segmentId}</p>
                        <Badge variant={attempt.completed ? "default" : "secondary"}>{attempt.completed ? "Passed" : "Practice"}</Badge>
                        <Badge variant="outline">{attempt.mode.replace(/_/g, " ")}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Timing {attempt.timingScore} - transition {attempt.transitionScore} - {new Date(attempt.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black">{attempt.score}</p>
                      <p className="text-xs text-muted-foreground">{attempt.reliability}% rel.</p>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No attempts saved yet. Record a guided practice attempt or finish a live session.</div>
              )}
            </CardContent>
          </Card>
        </section>

        <section id="live-dance-coach" className="scroll-mt-4">
          <PoseAnalyzer mode="dance" />
        </section>
      </div>
    </div>
  );
}
