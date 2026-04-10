"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Calendar, Dumbbell, Plus, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getDemoSession } from "@/lib/dummy-auth";

const DEMO_USER_ID = "demo-user-001";
const DEMO_WORKOUT_PLAN_STORAGE_KEY = "fitcoach_demo_workout_plan_v1";

type WorkoutPlanRecord = {
  id: string;
  name: string;
  description: string;
  goal: string;
  duration: number;
  daysPerWeek: number;
  difficulty: string;
  isActive: boolean;
  isAiGenerated: boolean;
  weeklySchedule?: string | null;
};

type ScheduleDay = {
  day: string;
  focus: string;
  exercises: Array<{ exerciseName: string; sets: number; reps: number; restSeconds: number }>;
};

const parseSchedule = (raw?: string | null): ScheduleDay[] => {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ScheduleDay[];
  } catch {
    return [];
  }
};

export default function WorkoutPlansPage() {
  const { session } = useUserProfile();
  const [plans, setPlans] = useState<WorkoutPlanRecord[]>([]);
  const [demoActivePlan, setDemoActivePlan] = useState<WorkoutPlanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    goal: "fat_loss",
    duration: "8",
    daysPerWeek: "4",
    difficulty: "intermediate",
  });

  const isDemoMode = session?.user?.id === DEMO_USER_ID || (!!getDemoSession?.() && typeof window !== "undefined");

  useEffect(() => {
    if (!isDemoMode || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(DEMO_WORKOUT_PLAN_STORAGE_KEY);
    if (!raw) return;
    try {
      setDemoActivePlan(JSON.parse(raw) as WorkoutPlanRecord);
    } catch {
      setDemoActivePlan(null);
    }
  }, [isDemoMode]);

  const loadPlans = async () => {
    setLoading(true);
    try {
      if (isDemoMode && typeof window !== "undefined") {
        const raw = window.localStorage.getItem(DEMO_WORKOUT_PLAN_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as WorkoutPlanRecord;
          setDemoActivePlan(parsed);
          setPlans([parsed]);
        }
      }
      const response = await fetch("/api/workout-plans", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load plans");
      const nextPlans = data.plans ?? [];
      if (!nextPlans.length && isDemoMode && typeof window !== "undefined") {
        const raw = window.localStorage.getItem(DEMO_WORKOUT_PLAN_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as WorkoutPlanRecord;
          setDemoActivePlan(parsed);
          setPlans([parsed]);
          return;
        }
      }
      if (nextPlans.length) {
        setDemoActivePlan(null);
      }
      setPlans(nextPlans);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, [isDemoMode, session?.user?.id]);

  const activePlan = useMemo(() => demoActivePlan ?? plans.find((plan) => plan.isActive) ?? null, [demoActivePlan, plans]);
  const archivedPlans = useMemo(() => plans.filter((plan) => !plan.isActive && plan.id !== demoActivePlan?.id), [demoActivePlan?.id, plans]);
  const activeSchedule = useMemo(() => parseSchedule(activePlan?.weeklySchedule), [activePlan?.weeklySchedule]);
  const activeProgress = activePlan ? Math.min(100, Math.round(100 / Math.max(activePlan.duration, 1))) : 0;

  const handleCreate = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/workout-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          goal: form.goal,
          duration: Number(form.duration),
          daysPerWeek: Number(form.daysPerWeek),
          difficulty: form.difficulty,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create plan");
      toast.success("Workout plan created");
      setOpen(false);
      setForm({ name: "", goal: "fat_loss", duration: "8", daysPerWeek: "4", difficulty: "intermediate" });
      await loadPlans();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create plan");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/workout-plans/generate", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate plan");
      if (data.record) {
        setDemoActivePlan(data.record);
      }
      if (isDemoMode && data.record && typeof window !== "undefined") {
        window.localStorage.setItem(DEMO_WORKOUT_PLAN_STORAGE_KEY, JSON.stringify(data.record));
        setPlans([data.record]);
      } else {
        await loadPlans();
      }
      toast.success(`AI workout plan generated${data.provider ? ` via ${data.provider}` : ""}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Workout plans</h1>
          <p className="mt-1 text-muted-foreground">DB-backed plans generated from your profile or created manually.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" disabled={saving} onClick={handleGenerate}>
            <Sparkles className="h-4 w-4" />
            Generate AI plan
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create manually
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a structured plan</DialogTitle>
                <DialogDescription>The new plan becomes your active plan and replaces the current active one.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Plan name</Label>
                  <Input id="name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Goal</Label>
                    <Select value={form.goal} onValueChange={(value) => setForm((prev) => ({ ...prev, goal: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fat_loss">Fat loss</SelectItem>
                        <SelectItem value="muscle_gain">Muscle gain</SelectItem>
                        <SelectItem value="general_fitness">General fitness</SelectItem>
                        <SelectItem value="mobility">Mobility</SelectItem>
                        <SelectItem value="dance_skill">Dance skill</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select value={form.difficulty} onValueChange={(value) => setForm((prev) => ({ ...prev, difficulty: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (weeks)</Label>
                    <Input id="duration" value={form.duration} onChange={(event) => setForm((prev) => ({ ...prev, duration: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="days">Days per week</Label>
                    <Input id="days" value={form.daysPerWeek} onChange={(event) => setForm((prev) => ({ ...prev, daysPerWeek: event.target.value }))} />
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>
                  {saving ? "Saving..." : "Create plan"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-80 rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : activePlan ? (
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-orange-500/10 to-rose-500/10">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-2xl">{activePlan.name}</CardTitle>
                <CardDescription className="mt-1">{activePlan.description}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/coach/workout">
                  <Button className="gap-2">
                    <Zap className="h-4 w-4" />
                    Start coach session
                  </Button>
                </Link>
                <div className="rounded-xl border bg-background/70 px-4 py-2 text-sm">
                  {activePlan.isAiGenerated ? "AI generated" : "Manual"} • {activePlan.difficulty}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-2xl font-bold">{activePlan.duration}</p>
                <p className="text-sm text-muted-foreground">Weeks</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-2xl font-bold">{activePlan.daysPerWeek}</p>
                <p className="text-sm text-muted-foreground">Days/week</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-2xl font-bold capitalize">{activePlan.goal.replace(/_/g, " ")}</p>
                <p className="text-sm text-muted-foreground">Goal</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-2xl font-bold">{activeProgress}%</p>
                <p className="text-sm text-muted-foreground">Cycle progress</p>
              </div>
            </div>
            <Progress value={activeProgress} />

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Weekly schedule</h2>
              <div className="grid gap-3">
                {activeSchedule.map((day) => (
                  <div key={day.day} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold">{day.day}</p>
                        <p className="text-sm text-muted-foreground">{day.focus}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {day.exercises.length} exercises
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      {day.exercises.map((exercise) => (
                        <div key={`${day.day}-${exercise.exerciseName}`} className="rounded-lg bg-muted/40 p-3 text-sm">
                          <p className="font-medium">{exercise.exerciseName}</p>
                          <p className="text-muted-foreground">
                            {exercise.sets} sets • {exercise.reps} reps • {exercise.restSeconds}s rest
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Dumbbell className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold">No active workout plan</p>
              <p className="text-sm text-muted-foreground">Generate one from your profile or create one manually.</p>
            </div>
            <Button onClick={handleGenerate} disabled={saving} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate AI plan
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Plan history</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {archivedPlans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <div className="rounded-full bg-muted px-3 py-1 text-xs">{plan.duration} weeks</div>
                  <div className="rounded-full bg-muted px-3 py-1 text-xs capitalize">{plan.goal.replace(/_/g, " ")}</div>
                  <div className="rounded-full bg-muted px-3 py-1 text-xs capitalize">{plan.difficulty}</div>
                </div>
                <p className="text-sm text-muted-foreground">{parseSchedule(plan.weeklySchedule).length} scheduled training days saved.</p>
              </CardContent>
            </Card>
          ))}
          {!loading && archivedPlans.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-sm text-muted-foreground">Your previous plan snapshots will appear here.</CardContent>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}
