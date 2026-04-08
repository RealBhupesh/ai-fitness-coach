"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Activity, Calendar, Dumbbell, Flame, Plus, Scale, Target, Zap } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { DashboardSummary } from "@/lib/app-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type ProgressEntry = {
  id: string;
  date: string;
  weight?: number | null;
  bodyFat?: number | null;
  muscleMass?: number | null;
  adherence?: number;
  notes?: string | null;
};

type ProgressResponse = {
  entries: ProgressEntry[];
  streak: number;
  totalSessions: number;
  avgScore: number;
};

export default function ProgressPage() {
  const { profile } = useUserProfile();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    weight: "",
    bodyFat: "",
    muscleMass: "",
    adherence: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [dashboardRes, progressRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/progress", { cache: "no-store" }),
      ]);
      const dashboardData = await dashboardRes.json();
      const progressData = await progressRes.json();

      if (!dashboardRes.ok) throw new Error(dashboardData.error || "Failed to load dashboard");
      if (!progressRes.ok) throw new Error(progressData.error || "Failed to load progress");

      setDashboard(dashboardData);
      setProgress(progressData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load progress");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const weightTrend = useMemo(() => progress?.entries.filter((entry) => typeof entry.weight === "number") ?? [], [progress]);
  const firstWeight = weightTrend[0]?.weight ?? null;
  const latestWeight = weightTrend[weightTrend.length - 1]?.weight ?? null;
  const weightDelta = firstWeight != null && latestWeight != null ? Number((latestWeight - firstWeight).toFixed(1)) : null;
  const maxWeight = weightTrend.length ? Math.max(...weightTrend.map((entry) => entry.weight as number)) : 0;
  const minWeight = weightTrend.length ? Math.min(...weightTrend.map((entry) => entry.weight as number)) : 0;
  const weightRange = Math.max(maxWeight - minWeight, 1);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight: form.weight ? Number(form.weight) : undefined,
          bodyFat: form.bodyFat ? Number(form.bodyFat) : undefined,
          muscleMass: form.muscleMass ? Number(form.muscleMass) : undefined,
          adherence: form.adherence ? Number(form.adherence) : undefined,
          notes: form.notes || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save progress");

      toast.success("Progress updated");
      setForm({ weight: "", bodyFat: "", muscleMass: "", adherence: "", notes: "" });
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save progress");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Progress</h1>
          <p className="mt-1 text-muted-foreground">Weight trend, session quality, and adherence from your saved data.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Log progress
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save a progress checkpoint</DialogTitle>
              <DialogDescription>Use real measurements so dashboards and achievements stay accurate.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input id="weight" value={form.weight} onChange={(event) => setForm((prev) => ({ ...prev, weight: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bodyFat">Body fat %</Label>
                  <Input id="bodyFat" value={form.bodyFat} onChange={(event) => setForm((prev) => ({ ...prev, bodyFat: event.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="muscleMass">Muscle mass (kg)</Label>
                  <Input id="muscleMass" value={form.muscleMass} onChange={(event) => setForm((prev) => ({ ...prev, muscleMass: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adherence">Plan adherence %</Label>
                  <Input id="adherence" value={form.adherence} onChange={(event) => setForm((prev) => ({ ...prev, adherence: event.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save progress"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)
          : [
              { label: "Total sessions", value: progress?.totalSessions ?? 0, icon: Dumbbell },
              { label: "Current streak", value: `${progress?.streak ?? 0} days`, icon: Zap },
              { label: "Average score", value: `${progress?.avgScore ?? 0}/100`, icon: Activity },
              { label: "Active minutes", value: dashboard?.totalMinutes ?? 0, icon: Flame },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardContent className="pt-6">
                    <Icon className="mb-2 h-5 w-5 text-primary" />
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Weight trend
            </CardTitle>
            <CardDescription>
              {weightDelta == null
                ? "Add weight checkpoints to start tracking trends."
                : `${weightDelta < 0 ? "Down" : "Up"} ${Math.abs(weightDelta)} kg from your first saved entry.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 w-full rounded-xl" />
            ) : weightTrend.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
                No weight entries yet. Use "Log progress" to create your first checkpoint.
              </div>
            ) : (
              <>
                <div className="flex h-72 items-end justify-between gap-2">
                  {weightTrend.map((entry) => {
                    const weight = entry.weight as number;
                    const height = 24 + ((weight - minWeight) / weightRange) * 180;
                    return (
                      <div key={entry.id} className="flex flex-1 flex-col items-center gap-2">
                        <span className="text-xs font-medium">{weight.toFixed(1)}</span>
                        <div className="w-full rounded-t-xl bg-gradient-to-t from-orange-500 to-rose-500" style={{ height }} />
                        <span className="text-center text-[11px] text-muted-foreground">
                          {new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-4 border-t pt-4 text-sm md:grid-cols-3">
                  <p>
                    <span className="text-muted-foreground">Start:</span> {firstWeight?.toFixed(1) ?? "-"} kg
                  </p>
                  <p>
                    <span className="text-muted-foreground">Current:</span> {latestWeight?.toFixed(1) ?? "-"} kg
                  </p>
                  <p>
                    <span className="text-muted-foreground">Target:</span> {profile?.targetWeightKg ?? profile?.weightKg ?? "-"} kg
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-500" />
              Recent checkpoints
            </CardTitle>
            <CardDescription>Latest saved progress entries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading
              ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)
              : (progress?.entries.slice().reverse().slice(0, 5) ?? []).map((entry) => (
                  <div key={entry.id} className="rounded-xl bg-muted/40 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{new Date(entry.date).toLocaleDateString()}</p>
                      <span className="text-xs text-muted-foreground">{entry.adherence ?? 0}% adherence</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                      <span>{entry.weight ? `${entry.weight} kg` : "No weight"}</span>
                      <span>{entry.bodyFat ? `${entry.bodyFat}% fat` : "No body fat"}</span>
                      <span>{entry.muscleMass ? `${entry.muscleMass} kg muscle` : "No muscle"}</span>
                    </div>
                    {entry.notes ? <p className="mt-2 text-sm text-muted-foreground">{entry.notes}</p> : null}
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-500" />
            Recent sessions
          </CardTitle>
          <CardDescription>Saved sessions and their composite coaching scores.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)
            : (dashboard?.recentSessions ?? []).map((session) => (
                <div key={session.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium capitalize">{session.exerciseType || session.type}</p>
                    <span className="text-sm font-semibold">{session.compositeScore}/100</span>
                  </div>
                  <Progress className="mt-3 h-2" value={session.compositeScore} />
                  <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                    <span>{session.duration} min</span>
                    <span>{session.caloriesBurned} kcal</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(session.date).toLocaleString()} {session.summary ? `• ${session.summary}` : ""}
                  </p>
                </div>
              ))}
        </CardContent>
      </Card>
    </div>
  );
}
