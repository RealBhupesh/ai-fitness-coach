"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, AlertCircle, Bot, Calendar, CheckCircle2, Clock, Dumbbell, Flame, MessageSquare, Music2, Play, Sparkles, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardSummary } from "@/lib/app-types";
import { useUserProfile } from "@/hooks/useUserProfile";

const emptySummary: DashboardSummary = {
  streak: 0,
  totalWorkouts: 0,
  totalMinutes: 0,
  totalCalories: 0,
  averageScore: 0,
  adherence: 0,
  recentSessions: [],
  weightTrend: [],
  activePlan: null,
  activeNutritionPlan: null,
};

type CoachAgentReport = {
  memory: {
    weakMetrics: string[];
    strongMetrics: string[];
    recurringIssues: string[];
    recommendedFocus: string;
    preferredNextAction: string;
  };
  todayPlan: {
    title: string;
    primaryAction: string;
    primaryHref: string;
    secondaryAction: string;
    secondaryHref: string;
    evidenceChips: string[];
  };
  primarySessionRecommendation: {
    type: "workout" | "dance" | "recovery";
    label: string;
    href: string;
    reason: string;
  };
  focusMetric: {
    label: string;
    target: string;
    measuredValue: string;
    cue: string;
  };
  closestAchievement: {
    name: string;
    description: string;
    icon: string | null;
    progress: number;
    threshold: number;
    remaining: number;
    percent: number;
    nextAction: string;
  } | null;
  preSessionBrief: {
    priority: string;
    reason: string;
    evidence: string[];
    nextAction: string;
    planAdjustment?: string;
    achievementRecommendation?: string;
  };
  postSessionNextAction: {
    priority: string;
    reason: string;
    evidence: string[];
    nextAction: string;
    planAdjustment?: string;
    achievementRecommendation?: string;
  };
  weeklyReport: {
    summary: string;
    evidence: string[];
    planAdjustment: string;
  };
  achievementRecommendation: string;
};

export default function DashboardPage() {
  const { profile } = useUserProfile();
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [agent, setAgent] = useState<CoachAgentReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/dashboard", { credentials: "include" });
        if (!response.ok) {
          if (!cancelled) {
            setSummary(emptySummary);
          }
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          setSummary({
            ...emptySummary,
            ...data,
            recentSessions: Array.isArray(data?.recentSessions) ? data.recentSessions : [],
            weightTrend: Array.isArray(data?.weightTrend) ? data.weightTrend : [],
          });
        }
        const agentResponse = await fetch("/api/coach/agent", { credentials: "include" });
        if (agentResponse.ok) {
          const agentData = await agentResponse.json();
          if (!cancelled) setAgent(agentData);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const name = profile?.name?.split(" ")[0] || "Athlete";
  const firstTime = !loading && summary.totalWorkouts === 0;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Welcome back, <span className="gradient-text">{name}</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {profile?.goals?.length ? `Current focus: ${profile.goals.map((goal) => goal.replace(/_/g, " ")).join(", ")}` : "Complete onboarding to personalize your coach."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/coach/chat">
            <Button variant="outline" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Ask AI Coach
            </Button>
          </Link>
          <Link href="/coach/workout">
            <Button className="gap-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600">
              <Play className="h-4 w-4" />
              Start Session
            </Button>
          </Link>
        </div>
      </motion.div>

      {loading ? (
        <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-emerald-500/10">
          <CardContent className="grid gap-4 pt-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <Badge className="mb-3 bg-cyan-500/15 text-cyan-700 dark:text-cyan-200">Building coach plan</Badge>
              <div className="h-7 w-56 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="h-10 animate-pulse rounded-md bg-muted" />
              <div className="h-10 animate-pulse rounded-md bg-muted" />
            </div>
          </CardContent>
        </Card>
      ) : agent ? (
        <Card className="overflow-hidden border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-background to-emerald-500/10">
          <CardContent className="grid gap-5 pt-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-200">{agent.todayPlan.title}</Badge>
                <Badge variant="outline" className="capitalize">{agent.preSessionBrief.priority}</Badge>
              </div>
              <h2 className="mt-3 text-xl font-semibold md:text-2xl">
                {firstTime ? "Your first move is a short coached baseline." : agent.primarySessionRecommendation.label}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{agent.primarySessionRecommendation.reason}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {agent.todayPlan.evidenceChips.map((chip) => (
                  <Badge key={chip} variant="secondary">{chip}</Badge>
                ))}
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Link href={agent.todayPlan.primaryHref}>
                  <Button className="w-full gap-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 sm:w-auto">
                    {agent.primarySessionRecommendation.type === "dance" ? <Music2 className="h-4 w-4" /> : <Dumbbell className="h-4 w-4" />}
                    {agent.todayPlan.primaryAction}
                  </Button>
                </Link>
                <Link href={agent.todayPlan.secondaryHref}>
                  <Button variant="outline" className="w-full gap-2 sm:w-auto">
                    <Target className="h-4 w-4" />
                    {agent.todayPlan.secondaryAction}
                  </Button>
                </Link>
              </div>
            </div>
            <div className="space-y-3 rounded-lg border bg-background/70 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
                <div>
                  <p className="font-medium">Focus metric: {agent.focusMetric.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{agent.focusMetric.cue}</p>
                </div>
              </div>
              {agent.closestAchievement ? (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{agent.closestAchievement.icon} {agent.closestAchievement.name}</p>
                    <Badge>{agent.closestAchievement.percent}%</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{agent.closestAchievement.nextAction}</p>
                </div>
              ) : (
                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">No locked achievement needs attention yet. Complete a session to refresh the coach nudge.</div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-500/20 bg-amber-500/10">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium">Coach memory is not ready yet</p>
                <p className="text-sm text-muted-foreground">Start one short session and the guided plan will personalize from your scorecards.</p>
              </div>
            </div>
            <Link href="/coach/workout">
              <Button variant="outline">Start first session</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Workout Streak", value: `${summary.streak} days`, icon: Flame },
          { label: "Total Workouts", value: summary.totalWorkouts, icon: Activity },
          { label: "Active Minutes", value: summary.totalMinutes, icon: Clock },
          { label: "Average Score", value: `${summary.averageScore}`, icon: TrendingUp },
        ].map((item, index) => {
          const Icon = item.icon;
          return (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <Badge variant="secondary">{loading ? "…" : "live"}</Badge>
                </div>
                <div className="text-2xl font-bold mt-3">{loading ? "…" : item.value}</div>
                <div className="text-sm text-muted-foreground">{item.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {agent ? (
        <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-cyan-500" />
              Agentic Coach Brief
            </CardTitle>
            <CardDescription>The coach decides from saved scorecards, calories, reps, dance timing, achievements, and streak evidence.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-background/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">Next best action</p>
                <Badge className="capitalize">{agent.preSessionBrief.priority}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{agent.preSessionBrief.nextAction}</p>
              <p className="mt-3 text-xs text-muted-foreground">{agent.preSessionBrief.reason}</p>
            </div>
            <div className="rounded-xl border bg-background/70 p-4">
              <p className="font-medium">Coach memory</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[agent.memory.recommendedFocus, ...agent.memory.weakMetrics.slice(0, 3)].filter(Boolean).map((item) => (
                  <Badge key={item} variant="secondary">{item}</Badge>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{agent.preSessionBrief.planAdjustment}</p>
            </div>
            <div className="rounded-xl border bg-background/70 p-4">
              <p className="font-medium">Weekly agent report</p>
              <p className="mt-2 text-sm text-muted-foreground">{agent.weeklyReport.summary}</p>
              <p className="mt-3 text-xs text-muted-foreground">{agent.closestAchievement?.nextAction ?? agent.achievementRecommendation}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Recent Sessions
            </CardTitle>
            <CardDescription>Your latest completed workouts and coaching summaries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.recentSessions.length ? (
              summary.recentSessions.map((session) => (
                <div key={session.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium capitalize">{session.exerciseType || session.type}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(session.date).toLocaleDateString()} • {session.duration} min • {session.caloriesBurned} cal
                      </div>
                      {session.summary ? <p className="text-sm mt-2 text-muted-foreground">{session.summary}</p> : null}
                    </div>
                    <Badge>{session.compositeScore} / 100</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">No completed sessions yet</p>
                <p className="mt-1">Start your first coached workout or hip-hop session to unlock scorecards, calories, achievements, and coach memory.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/coach/workout"><Button size="sm">Workout baseline</Button></Link>
                  <Link href="/coach/dance"><Button size="sm" variant="outline">Hip-hop baseline</Button></Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-orange-500" />
                Plan Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.activePlan ? (
                <>
                  <div className="font-medium">{summary.activePlan.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Week {summary.activePlan.currentWeek} • {summary.activePlan.daysPerWeek} days/week
                  </div>
                  <Badge variant="secondary">{summary.activePlan.progress}% complete</Badge>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No active workout plan yet.</div>
              )}
              <Link href="/workout-plans">
                <Button variant="outline" className="w-full">Manage plans</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-500" />
                Nutrition Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.activeNutritionPlan ? (
                <>
                  <div className="font-medium">{summary.activeNutritionPlan.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {summary.activeNutritionPlan.dailyCalories} kcal • P{summary.activeNutritionPlan.proteinGrams} C{summary.activeNutritionPlan.carbsGrams} F{summary.activeNutritionPlan.fatGrams}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No active nutrition plan yet.</div>
              )}
              <Link href="/nutrition">
                <Button variant="outline" className="w-full">Open nutrition</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
