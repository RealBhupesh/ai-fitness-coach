"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, AlertCircle, Award, BatteryCharging, Bell, Bot, Calendar, CheckCircle2, Clock, Dumbbell, Flame, HeartPulse, LineChart, MessageSquare, Music2, Play, Sparkles, Target, TrendingUp, Trophy, Users } from "lucide-react";
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
  readiness: {
    score: number;
    label: string;
    recommendation: string;
    drivers: string[];
    recoveryDebt: number;
  };
  strainLoad: {
    todayStrain: number;
    weeklyLoad: number;
    label: string;
    targetRange: string;
    explanation: string;
  };
  weeklyAdaptivePlan: Array<{
    day: string;
    label: string;
    type: string;
    duration: number;
    intensity: string;
    reason: string;
    href: string;
  }>;
  bodyBattery: Array<{
    time: string;
    energy: number;
    label: string;
  }>;
  smartAlerts: Array<{
    title: string;
    message: string;
    href: string;
    severity: string;
  }>;
  trendInsights: Array<{
    label: string;
    value: string;
    trend: string;
    detail: string;
  }>;
  wearableIntegrations: Array<{
    name: string;
    status: string;
    signal: string;
  }>;
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
  const communityLeaderboard = summary.communityLeaderboard ?? [];
  const featuredAchievements = summary.featuredAchievements ?? [];
  const bodyBatteryAverage = agent?.bodyBattery?.length
    ? Math.round(agent.bodyBattery.reduce((sum, item) => sum + item.energy, 0) / agent.bodyBattery.length)
    : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Badge className="mb-3">Daily readiness loop</Badge>
          <h1 className="text-3xl font-black uppercase leading-none md:text-5xl">
            Welcome back, <span className="gradient-text">{name}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
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
            <Button className="gap-2">
              <Play className="h-4 w-4" />
              Start Session
            </Button>
          </Link>
        </div>
      </motion.div>

      {loading ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="grid gap-4 pt-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <Badge className="mb-3">Building coach plan</Badge>
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
        <Card className="overflow-hidden border-primary/25 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_10%,transparent),color-mix(in_oklch,var(--card)_92%,transparent)_44%,color-mix(in_oklch,var(--accent)_9%,transparent))]">
          <CardContent className="grid gap-5 pt-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{agent.todayPlan.title}</Badge>
                <Badge variant="outline" className="capitalize">{agent.preSessionBrief.priority}</Badge>
              </div>
              <h2 className="mt-3 max-w-2xl text-3xl font-black uppercase leading-[0.95] md:text-5xl">
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
                  <Button className="w-full gap-2 sm:w-auto">
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
            <div className="space-y-3 rounded-lg border border-border/70 bg-background/55 p-4 backdrop-blur">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Focus metric: {agent.focusMetric.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{agent.focusMetric.cue}</p>
                </div>
              </div>
              {agent.closestAchievement ? (
                <div className="rounded-md border bg-muted/25 p-3">
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

      {agent ? (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_1.25fr_0.7fr]">
          <Card className="overflow-hidden border-primary/20 bg-card/92">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-primary" />
                Readiness
              </CardTitle>
              <CardDescription>Sleep, recovery debt, recent load, and weak metrics decide the day.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-6xl font-black leading-none text-primary">{agent.readiness.score}</p>
                  <p className="mt-2 text-sm font-semibold uppercase text-muted-foreground">{agent.readiness.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Recovery debt</p>
                  <p className="text-2xl font-black">{agent.readiness.recoveryDebt}</p>
                </div>
              </div>
              <div className="mt-5 h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${agent.readiness.score}%` }} />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{agent.readiness.recommendation}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {agent.readiness.drivers.slice(0, 4).map((driver) => (
                  <Badge key={driver} variant="secondary">{driver}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/20 bg-card/92">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5 text-accent" />
                Strain + Body Battery
              </CardTitle>
              <CardDescription>WHOOP-style training load plus an energy curve for the day.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-lg border bg-background/45 p-4">
                <div className="flex items-center justify-between">
                  <Badge>{agent.strainLoad.label}</Badge>
                  <span className="text-xs text-muted-foreground">{agent.strainLoad.targetRange}</span>
                </div>
                <p className="mt-4 text-5xl font-black leading-none">{agent.strainLoad.todayStrain}</p>
                <p className="mt-1 text-sm text-muted-foreground">today strain</p>
                <p className="mt-4 text-2xl font-black">{agent.strainLoad.weeklyLoad}</p>
                <p className="text-sm text-muted-foreground">weekly load</p>
                <p className="mt-4 text-xs text-muted-foreground">{agent.strainLoad.explanation}</p>
              </div>
              <div className="rounded-lg border bg-background/45 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <BatteryCharging className="h-4 w-4 text-primary" />
                    Body battery
                  </div>
                  <Badge variant="secondary">{bodyBatteryAverage}% avg</Badge>
                </div>
                <div className="mt-5 grid h-40 grid-cols-5 items-end gap-2">
                  {agent.bodyBattery.map((point) => (
                    <div key={point.time} className="flex h-full flex-col justify-end gap-2">
                      <div className="rounded-t-md bg-primary/80" style={{ height: `${Math.max(12, point.energy)}%` }} />
                      <div>
                        <p className="text-[10px] font-semibold">{point.time}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{point.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-400/20 bg-card/92">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-300" />
                Smart Alerts
              </CardTitle>
              <CardDescription>Small nudges that prevent drop-off.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {agent.smartAlerts.length ? agent.smartAlerts.map((alert) => (
                <Link key={alert.title} href={alert.href} className="block rounded-lg border bg-background/45 p-3 transition hover:border-primary/50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{alert.title}</p>
                    <Badge variant={alert.severity === "warning" ? "destructive" : "secondary"}>{alert.severity}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{alert.message}</p>
                </Link>
              )) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No urgent alerts. Save a session or recovery check-in to refresh nudges.</div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {agent ? (
        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Adaptive Week
              </CardTitle>
              <CardDescription>The coach reshapes this week from readiness, strain, achievements, and weak metrics.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-7">
                {agent.weeklyAdaptivePlan.map((day) => (
                  <Link key={`${day.day}-${day.label}`} href={day.href} className="rounded-lg border bg-background/45 p-3 transition hover:border-primary/50">
                    <div className="flex items-center justify-between gap-2 md:block">
                      <p className="text-xs font-black uppercase text-muted-foreground">{day.day}</p>
                      <Badge className="mt-0 md:mt-2" variant="secondary">{day.duration}m</Badge>
                    </div>
                    <p className="mt-3 min-h-10 text-sm font-semibold leading-tight">{day.label}</p>
                    <p className="mt-2 text-[11px] capitalize text-muted-foreground">{day.type} • {day.intensity}</p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                Performance Trends
              </CardTitle>
              <CardDescription>Signals that make the app feel like a health OS.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {agent.trendInsights.map((insight) => (
                <div key={insight.label} className="rounded-lg border bg-background/45 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{insight.label}</p>
                    <Badge variant="secondary">{insight.trend}</Badge>
                  </div>
                  <p className="mt-2 text-2xl font-black">{insight.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{insight.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

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

      {(communityLeaderboard.length || featuredAchievements.length) ? (
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          {featuredAchievements.length ? (
            <Card className="overflow-hidden border-primary/20 bg-card/95">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Achievement Runway
                </CardTitle>
                <CardDescription>New users can see what unlocks next before their first live session.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {featuredAchievements.slice(0, 4).map((achievement) => {
                  const percent = Math.min(100, Math.round((achievement.progress / Math.max(achievement.threshold, 1)) * 100));
                  return (
                    <div key={achievement.id} className="rounded-lg border bg-background/45 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{achievement.name}</p>
                            {achievement.unlocked ? <Badge>Unlocked</Badge> : <Badge variant="secondary">{percent}%</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{achievement.description}</p>
                        </div>
                        <Award className="h-5 w-5 shrink-0 text-accent" />
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{achievement.progress} / {achievement.threshold}</span>
                        <span>{achievement.points} XP</span>
                      </div>
                    </div>
                  );
                })}
                <Link href="/achievements">
                  <Button variant="outline" className="w-full gap-2">
                    <Trophy className="h-4 w-4" />
                    Open achievements
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : null}

          {communityLeaderboard.length ? (
            <Card className="overflow-hidden border-accent/20 bg-card/95">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-accent" />
                  People Scoring
                </CardTitle>
                <CardDescription>Class leaderboard for demo comparisons, dance score, streak, and top move.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {communityLeaderboard.slice(0, 4).map((athlete, index) => (
                  <div key={athlete.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border bg-background/45 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-sm font-black text-primary">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{athlete.name}</p>
                        <Badge variant="secondary">{athlete.level}</Badge>
                        <Badge variant="outline">{athlete.trend}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {athlete.role} • {athlete.sessions} sessions • top move: {athlete.topMove}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black leading-none">{athlete.score}</p>
                      <p className="text-xs text-muted-foreground">dance {athlete.danceScore}</p>
                    </div>
                  </div>
                ))}
                <Link href="/coach/dance">
                  <Button className="w-full gap-2">
                    <Music2 className="h-4 w-4" />
                    Practice dance score
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {agent ? (
        <Card className="border-accent/20 bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-accent" />
              Agentic Coach Brief
            </CardTitle>
            <CardDescription>The coach decides from saved scorecards, calories, reps, dance timing, achievements, and streak evidence.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border bg-background/55 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">Next best action</p>
                <Badge className="capitalize">{agent.preSessionBrief.priority}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{agent.preSessionBrief.nextAction}</p>
              <p className="mt-3 text-xs text-muted-foreground">{agent.preSessionBrief.reason}</p>
            </div>
            <div className="rounded-lg border bg-background/55 p-4">
              <p className="font-medium">Coach memory</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[agent.memory.recommendedFocus, ...agent.memory.weakMetrics.slice(0, 3)].filter(Boolean).map((item, index) => (
                  <Badge key={`${item}-${index}`} variant="secondary">{item}</Badge>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{agent.preSessionBrief.planAdjustment}</p>
            </div>
            <div className="rounded-lg border bg-background/55 p-4">
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
                <div key={session.id} className="rounded-lg border bg-background/35 p-4">
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
