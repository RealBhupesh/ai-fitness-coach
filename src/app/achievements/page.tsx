"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Lock, Sparkles, Crown, Calendar, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const rarityByPoints = (points: number) => {
  if (points >= 500) return "legendary";
  if (points >= 250) return "epic";
  if (points >= 100) return "rare";
  return "common";
};

const rarityStyles = {
  common: { border: "border-zinc-500/20", bar: "from-zinc-400 to-zinc-500", badge: "common" },
  rare: { border: "border-blue-500/20", bar: "from-sky-400 to-blue-500", badge: "rare" },
  epic: { border: "border-violet-500/20", bar: "from-fuchsia-400 to-violet-500", badge: "epic" },
  legendary: { border: "border-orange-500/20", bar: "from-amber-400 to-orange-500", badge: "legendary" },
} as const;

export default function AchievementsPage() {
  const [category, setCategory] = useState("all");
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/achievements", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load achievements");
        if (active) setAchievements(data.achievements ?? []);
      } catch {
        if (active) setAchievements([]);
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold md:text-3xl">Achievements</h1>
        <p className="mt-1 text-muted-foreground">Live milestone progress based on your real sessions, streaks, and saved checkpoints.</p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2 border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white">
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

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList className="grid w-full grid-cols-5 md:w-[720px]">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="milestone">Milestone</TabsTrigger>
          <TabsTrigger value="consistency">Consistency</TabsTrigger>
          <TabsTrigger value="workout">Workout</TabsTrigger>
          <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
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
            : visibleUnlocked.map((achievement) => {
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
              })}
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
            : visibleLocked.map((achievement) => (
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
              ))}
        </div>
      </section>
    </div>
  );
}
