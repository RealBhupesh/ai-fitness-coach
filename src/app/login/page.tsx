"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "@/lib/auth/client";
import { createDemoSession, getDemoSession } from "@/lib/dummy-auth";
import { isDemoModeEnabled } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, CircleGauge, Moon, Zap } from "lucide-react";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: sessionData, isPending } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const demoModeEnabled = isDemoModeEnabled();

  useEffect(() => {
    if (!isPending && sessionData?.user?.id) {
      router.replace(searchParams.get("next") || "/dashboard");
      return;
    }
    if (!isPending && !sessionData?.user?.id && demoModeEnabled && getDemoSession()) {
      router.replace(searchParams.get("next") || "/dashboard");
    }
  }, [demoModeEnabled, isPending, router, searchParams, sessionData?.user?.id]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if ((result as any)?.error) {
        setError((result as any).error.message || "Unable to sign in");
        return;
      }

      router.push(searchParams.get("next") || "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="performance-shell flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_430px] lg:items-center">
        <div className="hidden space-y-6 lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <Moon className="h-3.5 w-3.5" />
            recovery intelligence
          </div>
          <h1 className="max-w-xl text-6xl font-black uppercase leading-[0.95]">
            Train from real readiness signals.
          </h1>
          <div className="grid max-w-xl grid-cols-3 gap-3">
            {[
              { label: "Strain", value: "72", icon: Activity },
              { label: "Recovery", value: "86", icon: CircleGauge },
              { label: "Next", value: "25m", icon: Zap },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border bg-card/80 p-4">
                  <Icon className="mb-5 h-5 w-5 text-primary" />
                  <p className="text-3xl font-black">{item.value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      <Card className="w-full max-w-md border-border bg-card/90 text-card-foreground">
        <CardHeader className="space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_30px_color-mix(in_oklch,var(--primary)_20%,transparent)]">
            <CircleGauge className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl font-black uppercase">Sign in to FitCoach AI</CardTitle>
            <CardDescription>{demoModeEnabled ? "Use your account or jump into demo mode to test the dashboard and live coach." : "Use your account to access the dashboard and live coach."}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            <Button className="w-full" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          {demoModeEnabled ? (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  createDemoSession();
                  router.push(searchParams.get("next") || "/dashboard");
                  router.refresh();
                }}
              >
                Continue as Demo User
              </Button>
            </>
          ) : null}
          <p className="mt-4 text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary hover:text-primary/80">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
