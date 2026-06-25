"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, Brain, CheckCircle2, CircleGauge, Dumbbell, Music2, ShieldAlert, Sparkles, Target, Users } from "lucide-react";
import type { AppUserProfile, ProfilePersona } from "@/lib/app-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type ProfilesResponse = {
  currentProfile: AppUserProfile | null;
  personas: ProfilePersona[];
  assumptions: string[];
};

const metricLabels: Record<string, string> = {
  readinessScore: "Readiness",
  mobilityScore: "Mobility",
  strengthScore: "Strength",
  danceTimingScore: "Dance timing",
  postureConfidence: "Posture confidence",
};

function formatLabel(value?: string) {
  return value ? value.replace(/_/g, " ") : "not set";
}

function ProfileMetricList({ profile }: { profile: AppUserProfile }) {
  const metrics = Object.entries(profile.baselineMetrics ?? {}).filter(([, value]) => typeof value === "number");

  if (!metrics.length) {
    return <p className="text-sm text-muted-foreground">No baseline metrics yet. Complete onboarding and one coached session to populate this section.</p>;
  }

  return (
    <div className="space-y-3">
      {metrics.map(([key, value]) => (
        <div key={key} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{metricLabels[key] ?? formatLabel(key)}</span>
            <span className="text-muted-foreground">{Math.round(Number(value))}/100</span>
          </div>
          <Progress value={Number(value)} />
        </div>
      ))}
    </div>
  );
}

export default function ProfilesPage() {
  const [data, setData] = useState<ProfilesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/profiles", { credentials: "include" });
        if (!response.ok) return;
        const payload = (await response.json()) as ProfilesResponse;
        if (!cancelled) setData(payload);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentProfile = data?.currentProfile ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge className="mb-3 gap-1">
            <Users className="h-3 w-3" />
            Profile intelligence
          </Badge>
          <h1 className="text-3xl font-black uppercase leading-none md:text-5xl">Profiles and assumptions</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Real account data powers your coach. Sample profiles show the product assumptions used for demos, QA, and calibration.
          </p>
        </div>
        <Link href="/settings">
          <Button className="gap-2">
            <Target className="h-4 w-4" />
            Edit my profile
          </Button>
        </Link>
      </motion.div>

      {loading ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="h-8 w-64 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-primary/25 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CircleGauge className="h-5 w-5 text-primary" />
                  Your active profile
                </CardTitle>
                <CardDescription>The backend returns this from the signed-in user session and profile table.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {currentProfile ? (
                  <>
                    <div>
                      <h2 className="text-2xl font-black">{currentProfile.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {formatLabel(currentProfile.profileType)} · {currentProfile.experience} · {currentProfile.primarySport ?? "General training"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentProfile.goals.length ? currentProfile.goals.map((goal) => <Badge key={goal} variant="secondary">{formatLabel(goal)}</Badge>) : <Badge variant="outline">No goals yet</Badge>}
                    </div>
                    <ProfileMetricList profile={currentProfile} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border bg-background/60 p-4">
                        <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Brain className="h-4 w-4 text-primary" /> Assumptions</p>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          {(currentProfile.readinessAssumptions.length ? currentProfile.readinessAssumptions : ["Complete onboarding to create user-specific assumptions."]).map((item) => (
                            <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border bg-background/60 p-4">
                        <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-amber-500" /> Constraints</p>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          {(currentProfile.coachingConstraints.length ? currentProfile.coachingConstraints : ["AI coach guidance only. No diagnosis or injury assessment."]).map((item) => (
                            <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border bg-background/60 p-5">
                    <p className="font-semibold">No signed-in profile loaded.</p>
                    <p className="mt-1 text-sm text-muted-foreground">Sign in or use demo mode to populate an active profile.</p>
                    <div className="mt-4 flex gap-2">
                      <Link href="/login"><Button>Sign in</Button></Link>
                      <Link href="/signup"><Button variant="outline">Create account</Button></Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Platform assumptions
                </CardTitle>
                <CardDescription>These are shown explicitly so AI feedback stays honest and auditable.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.assumptions ?? []).map((assumption) => (
                  <div key={assumption} className="flex gap-3 rounded-lg border bg-card/70 p-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {assumption}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(data?.personas ?? []).map((persona) => (
              <Card key={persona.id} className="flex flex-col">
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge>{formatLabel(persona.profileType)}</Badge>
                    {persona.profileType === "dance_athlete" ? <Music2 className="h-5 w-5 text-primary" /> : <Dumbbell className="h-5 w-5 text-primary" />}
                  </div>
                  <CardTitle>{persona.title}</CardTitle>
                  <CardDescription>{persona.summary}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <ProfileMetricList profile={persona.sampleProfile} />
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-primary" /> Coach plan</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {persona.coachingPlan.map((item) => (
                        <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-auto rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                    <p className="mb-2 text-sm font-semibold text-amber-500">Guardrails</p>
                    <div className="flex flex-wrap gap-2">
                      {persona.riskFlags.map((flag) => <Badge key={flag} variant="outline">{flag}</Badge>)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
