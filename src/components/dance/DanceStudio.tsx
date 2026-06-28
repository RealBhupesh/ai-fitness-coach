"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, Award, CheckCircle2, Clock3, Gauge, Medal, Music2, Play, Radio, Sparkles, Target, Trophy, Users } from "lucide-react";
import PoseAnalyzer from "@/components/PoseAnalyzer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_COMMUNITY_LEADERBOARD } from "@/lib/demo-performance";
import type { DanceRoutinePack, DanceTutorialStep } from "@/lib/dance/types";

type RoutineResponse = {
  routine?: DanceRoutinePack & { tutorial?: DanceTutorialStep[] };
  source?: string;
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

export default function DanceStudio() {
  const [routine, setRoutine] = useState<RoutineResponse["routine"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadRoutine = async () => {
      try {
        const response = await fetch("/api/dance/routine", { credentials: "include", cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as RoutineResponse;
        if (!cancelled) setRoutine(data.routine ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadRoutine();
    return () => {
      cancelled = true;
    };
  }, []);

  const tutorial = useMemo(() => routine?.tutorial ?? [], [routine]);
  const currentStep = tutorial[activeStep] ?? tutorial[0];
  const currentSegment = currentStep ? routine?.segments.find((segment) => segment.id === currentStep.segmentId) : null;

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
                {DEMO_COMMUNITY_LEADERBOARD.slice(0, 3).map((athlete, index) => (
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
              {tutorial.length ? tutorial.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`w-full rounded-lg border p-3 text-left transition ${index === activeStep ? "border-primary bg-primary/10" : "bg-background/45 hover:border-primary/50"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{step.order}. {step.title}</p>
                    <Badge variant={index === activeStep ? "default" : "secondary"}>{step.count}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{step.practiceCue}</p>
                </button>
              )) : (
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
                    <Badge>{currentStep.count}</Badge>
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
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
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

        <section id="live-dance-coach" className="scroll-mt-4">
          <PoseAnalyzer mode="dance" />
        </section>
      </div>
    </div>
  );
}
