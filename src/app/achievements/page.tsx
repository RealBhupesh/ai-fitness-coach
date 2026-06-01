"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy, Lock, Sparkles, Crown, Calendar, Target, Flame, Dumbbell, Music2, Repeat2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AchievementRecord = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  points: number;
  threshold: number;
  progress: number;
  unlocked: boolean;
  unlockedDate: string | null;
};

type AchievementStats = {
  totalSessions: number;
  totalCalories: number;
  totalReps: number;
  danceSessionsCount: number;
  strengthSessionsCount: number;
  bestCompositeScore: number;
  highScoreSessions: number;
  curlScorecards: number;
  squatScorecards: number;
  danceScoreSessions: number;
  currentStreak: number;
  weeklySessionPeak: number;
};

type ClosestAchievementRecord = AchievementRecord & {
  remaining: number;
  percent: number;
};

const rarityByPoints = (points: number) => {
  if (points >= 500) return "legendary";
  if (points >= 250) return "epic";
  if (points >= 100) return "rare";
  return "common";
};

const rarityStyles = {
  common: { border: "border-zinc-500/20", bar: "from-zinc-400 to-zinc-500", badge: "common" },
  rare: { border: "border-blue-500/20", bar: "from-sky-400 to-blue-500", badge: "rare" },
  epic: { border: "border-cyan-500/20", bar: "from-cyan-300 to-primary", badge: "epic" },
  legendary: { border: "border-primary/20", bar: "from-primary to-amber-300", badge: "legendary" },
} as const;

export default function AchievementsPage() {
  const [category, setCategory] = useState("all");
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [closestAchievement, setClosestAchievement] = useState<ClosestAchievementRecord | null>(null);
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/achievements", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load achievements");
        if (active) {
          setAchievements(data.achievements ?? []);
          setClosestAchievement(data.closestAchievement ?? null);
          setStats(data.stats ?? null);
        }
      } catch {
        if (active) {
          setAchievements([]);
          setClosestAchievement(null);
          setStats(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const unlocked = useMemo(() => achievements.filter((item) => item.unlocked), [achievements]);
  const locked = useMemo(() => achievements.filter((item) => !item.unlocked), [achievements]);
  const visibleUnlocked = useMemo(
    () => (category === "all" ? unlocked : unlocked.filter((item) => item.category === category)),
    [category, unlocked],
  );
  const visibleLocked = useMemo(
    () => (category === "all" ? locked : locked.filter((item) => item.category === category)),
    [category, locked],
  );
  const totalPoints = unlocked.reduce((sum, item) => sum + item.points, 0);
  const level = Math.floor(totalPoints / 100) + 1;
  const statCards = [
    { label: "Calories", value: stats?.totalCalories ?? 0, icon: Flame, tone: "text-orange-500" },
    { label: "Live reps", value: stats?.totalReps ?? 0, icon: Repeat2, tone: "text-cyan-500" },
    { label: "Strength", value: stats?.strengthSessionsCount ?? 0, icon: Dumbbell, tone: "text-emerald-500" },
    { label: "Dance", value: stats?.danceSessionsCount ?? 0, icon: Music2, tone: "text-fuchsia-500" },
  ];
  const closestAction = closestAchievement
    ? closestAchievement.name === "First Steps"
      ? "Complete one coached workout or hip-hop dance session."
      : closestAchievement.category === "dance"
        ? `Complete ${closestAchievement.remaining} more dance evidence session${closestAchievement.remaining === 1 ? "" : "s"}.`
        : closestAchievement.category === "calories"
          ? `Burn ${closestAchievement.remaining} more calories in saved sessions.`
          : closestAchievement.category === "fitness"
            ? `Make ${closestAchievement.remaining} more scorecard or rep progress point${closestAchievement.remaining === 1 ? "" : "s"}.`
            : `Add ${closestAchievement.remaining} more progress point${closestAchievement.remaining === 1 ? "" : "s"}.`
    : "";

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold md:text-3xl">Achievements</h1>
        <p className="mt-1 text-muted-foreground">Live milestone progress based on your real sessions, streaks, and saved checkpoints.</p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5 md:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                <Crown className="h-9 w-9" />
                <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-500 bg-background text-sm font-bold text-amber-500">
                  {level}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold">Level {level}</p>
                <p className="text-sm text-muted-foreground">{totalPoints} XP earned</p>
                <Progress className="mt-3 h-2" value={totalPoints % 100} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Trophy className="mx-auto mb-2 h-8 w-8 text-amber-500" />
            <p className="text-3xl font-bold">{unlocked.length}</p>
            <p className="text-sm text-muted-foreground">Unlocked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Lock className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-3xl font-bold">{locked.length}</p>
            <p className="text-sm text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_auto] md:items-center">
          {closestAchievement ? (
            <>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-background text-3xl shadow-sm">{closestAchievement.icon}</div>
                <div>
                  <Badge className="mb-2 bg-cyan-500/15 text-cyan-700 dark:text-cyan-200">Closest achievement</Badge>
                  <h2 className="text-xl font-semibold">{closestAchievement.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{closestAchievement.description}</p>
                  <p className="mt-2 text-sm font-medium">{closestAction}</p>
                  <div className="mt-3 max-w-md">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{closestAchievement.progress} / {closestAchievement.threshold}</span>
                      <span>{closestAchievement.percent}%</span>
                    </div>
                    <Progress value={closestAchievement.percent} />
                  </div>
                </div>
              </div>
              <Link href={closestAchievement.category === "dance" ? "/coach/dance" : "/coach/workout"}>
                <Button className="w-full gap-2 md:w-auto">
                  <Target className="h-4 w-4" />
                  Work on this
                </Button>
              </Link>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <Trophy className="mt-0.5 h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium">No achievement chase yet</p>
                <p className="text-sm text-muted-foreground">Complete a session and this area will show the exact next unlock action.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-2xl font-bold">{item.value.toLocaleString()}</p>
                  </div>
                  <Icon className={`h-7 w-7 ${item.tone}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Current streak</p>
            <p className="mt-1 text-xl font-semibold">{stats?.currentStreak ?? 0} days</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Best score</p>
            <p className="mt-1 text-xl font-semibold">{stats?.bestCompositeScore ?? 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fitness scorecards</p>
            <p className="mt-1 text-xl font-semibold">{(stats?.curlScorecards ?? 0) + (stats?.squatScorecards ?? 0)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Dance evidence</p>
            <p className="mt-1 text-xl font-semibold">{stats?.danceScoreSessions ?? 0} sessions</p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList className="grid w-full grid-cols-6 md:w-[840px]">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="milestone">Milestone</TabsTrigger>
          <TabsTrigger value="consistency">Consistency</TabsTrigger>
          <TabsTrigger value="fitness">Fitness</TabsTrigger>
          <TabsTrigger value="dance">Dance</TabsTrigger>
          <TabsTrigger value="calories">Calories</TabsTrigger>
        </TabsList>
      </Tabs>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="text-xl font-semibold">Unlocked</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <Card key={index}>
                  <CardContent className="space-y-3 pt-6">
                    <Skeleton className="h-16 w-16 rounded-xl" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))
            : visibleUnlocked.length ? visibleUnlocked.map((achievement) => {
                const rarity = rarityByPoints(achievement.points);
                return (
                  <Card key={achievement.id} className={`overflow-hidden border ${rarityStyles[rarity].border}`}>
                    <div className={`h-1 bg-gradient-to-r ${rarityStyles[rarity].bar}`} />
                    <CardContent className="pt-5">
                      <div className="flex items-start gap-4">
                        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl text-white ${rarityStyles[rarity].bar}`}>
                          {achievement.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold">{achievement.name}</p>
                            <Badge variant="secondary" className="capitalize">
                              {rarityStyles[rarity].badge}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{achievement.description}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              {achievement.points} XP
                            </span>
                            {achievement.unlockedDate ? (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(achievement.unlockedDate).toLocaleDateString()}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }) : (
                <Card className="md:col-span-2 xl:col-span-3">
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    No achievements unlocked yet. Finish a guided session to unlock First Steps.
                  </CardContent>
                </Card>
              )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">In Progress</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <Card key={index}>
                  <CardContent className="space-y-3 pt-6">
                    <Skeleton className="h-16 w-16 rounded-xl" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-2 w-full" />
                  </CardContent>
                </Card>
              ))
            : visibleLocked.length ? visibleLocked.map((achievement) => (
                <Card key={achievement.id} className="overflow-hidden">
                  <div className="h-1 bg-muted" />
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-4">
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-3xl opacity-80">
                        {achievement.icon}
                        <Lock className="absolute bottom-1 right-1 h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold">{achievement.name}</p>
                          <Badge variant="outline" className="capitalize">
                            {rarityByPoints(achievement.points)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{achievement.description}</p>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              {achievement.progress} / {achievement.threshold}
                            </span>
                            <span>{Math.min(100, Math.round((achievement.progress / Math.max(achievement.threshold, 1)) * 100))}%</span>
                          </div>
                          <Progress value={Math.min(100, (achievement.progress / Math.max(achievement.threshold, 1)) * 100)} />
                        </div>
                        <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                          <Sparkles className="h-3 w-3" />
                          {achievement.points} XP on unlock
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <Card className="md:col-span-2 xl:col-span-3">
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    No locked achievements found. New goals will appear as more session evidence is saved.
                  </CardContent>
                </Card>
              )}
        </div>
      </section>
    </div>
  );
}
