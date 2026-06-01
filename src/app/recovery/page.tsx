"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BatteryCharging, BedDouble, Droplets, HeartPulse, Loader2, Save, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RecoveryCheckIn = {
  sleepHours: number;
  sleepQuality: number;
  soreness: number;
  stress: number;
  energy: number;
  hydration: number;
  mood: string;
  notes: string;
  loggedAt?: string;
};

const defaultCheckIn: RecoveryCheckIn = {
  sleepHours: 7,
  sleepQuality: 3,
  soreness: 2,
  stress: 2,
  energy: 3,
  hydration: 3,
  mood: "steady",
  notes: "",
};

const fields = [
  { key: "sleepQuality", label: "Sleep quality", icon: BedDouble },
  { key: "energy", label: "Energy", icon: Zap },
  { key: "soreness", label: "Soreness", icon: HeartPulse },
  { key: "stress", label: "Stress", icon: BatteryCharging },
  { key: "hydration", label: "Hydration", icon: Droplets },
] as const;

export default function RecoveryPage() {
  const [checkIn, setCheckIn] = useState<RecoveryCheckIn>(defaultCheckIn);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const response = await fetch("/api/recovery/checkin", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        if (!cancelled && data.recoveryCheckIn) {
          setCheckIn({ ...defaultCheckIn, ...data.recoveryCheckIn });
        }
      }
      if (!cancelled) setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const recoveryScore = Math.round(
    Math.min(
      100,
      Math.max(
        1,
        checkIn.sleepHours * 7 + checkIn.sleepQuality * 9 + checkIn.energy * 8 + checkIn.hydration * 5 - checkIn.soreness * 6 - checkIn.stress * 5,
      ),
    ),
  );

  const update = (key: keyof RecoveryCheckIn, value: string | number) => {
    setSaved(false);
    setCheckIn((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    const response = await fetch("/api/recovery/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkIn),
    });
    if (response.ok) setSaved(true);
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Badge className="mb-3">Recovery OS</Badge>
          <h1 className="text-3xl font-black uppercase leading-none md:text-5xl">Daily recovery check-in</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Feed sleep, stress, soreness, hydration, and energy into the coach so readiness and weekly plans adapt like a wearable.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BatteryCharging className="h-5 w-5 text-primary" />
              Recovery estimate
            </CardTitle>
            <CardDescription>This updates the next coach-agent refresh.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading latest check-in
              </div>
            ) : (
              <>
                <p className="text-7xl font-black leading-none text-primary">{recoveryScore}</p>
                <p className="mt-2 text-sm uppercase text-muted-foreground">estimated readiness input</p>
                <div className="mt-5 h-2 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${recoveryScore}%` }} />
                </div>
                <div className="mt-5 rounded-lg border bg-background/45 p-4 text-sm text-muted-foreground">
                  {recoveryScore >= 75
                    ? "Strong enough for a normal session if camera tracking is reliable."
                    : recoveryScore >= 55
                      ? "Keep the session shorter and focus on one skill."
                      : "Recovery is low. Use mobility, walking, or a technique reset."}
                </div>
                {checkIn.loggedAt ? <p className="mt-3 text-xs text-muted-foreground">Last logged {new Date(checkIn.loggedAt).toLocaleString()}</p> : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Check-in signals</CardTitle>
            <CardDescription>Use honest 1-5 ratings. The coach will use this instead of guessing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border bg-background/45 p-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="sleepHours">Sleep hours</Label>
                <span className="text-2xl font-black">{checkIn.sleepHours.toFixed(1)}h</span>
              </div>
              <input
                id="sleepHours"
                className="mt-4 w-full accent-primary"
                type="range"
                min="0"
                max="12"
                step="0.5"
                value={checkIn.sleepHours}
                onChange={(event) => update("sleepHours", Number(event.target.value))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {fields.map((field) => {
                const Icon = field.icon;
                return (
                  <div key={field.key} className="rounded-lg border bg-background/45 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <Label htmlFor={field.key} className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        {field.label}
                      </Label>
                      <span className="text-xl font-black">{checkIn[field.key]}/5</span>
                    </div>
                    <input
                      id={field.key}
                      className="mt-4 w-full accent-primary"
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={checkIn[field.key]}
                      onChange={(event) => update(field.key, Number(event.target.value))}
                    />
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-[0.55fr_1.45fr]">
              <div className="rounded-lg border bg-background/45 p-4">
                <Label htmlFor="mood">Mood</Label>
                <input
                  id="mood"
                  className="mt-3 h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={checkIn.mood}
                  onChange={(event) => update("mood", event.target.value)}
                />
              </div>
              <div className="rounded-lg border bg-background/45 p-4">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  className="mt-3 min-h-24"
                  value={checkIn.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  placeholder="Pain, poor sleep, soreness, travel, or anything your coach should know."
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save recovery check-in
              </Button>
              {saved ? <Badge variant="secondary">Saved. Dashboard readiness will refresh from this signal.</Badge> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
