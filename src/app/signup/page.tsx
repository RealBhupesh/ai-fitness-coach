"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth/client";
import { createDemoSession } from "@/lib/dummy-auth";
import { isDemoModeEnabled } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, CircleGauge, ShieldCheck } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const demoModeEnabled = isDemoModeEnabled();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await signUp.email({
        name,
        email,
        password,
      });

      if ((result as any)?.error) {
        setError((result as any).error.message || "Unable to create account");
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="performance-shell flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_430px] lg:items-center">
        <div className="hidden space-y-6 lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-accent">
            <ShieldCheck className="h-3.5 w-3.5" />
            coach calibration
          </div>
          <h1 className="max-w-xl text-6xl font-black uppercase leading-[0.95]">
            Build your personal performance loop.
          </h1>
          <div className="max-w-lg rounded-lg border bg-card/80 p-5">
            <Activity className="mb-6 h-6 w-6 text-primary" />
            <p className="text-sm leading-6 text-muted-foreground">
              FitCoach blends form scorecards, hip-hop timing, calories, achievements, and coach memory into one daily action.
            </p>
          </div>
        </div>
      <Card className="w-full max-w-md border-border bg-card/90 text-card-foreground">
        <CardHeader className="space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_30px_color-mix(in_oklch,var(--primary)_20%,transparent)]">
            <CircleGauge className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl font-black uppercase">Create your FitCoach AI account</CardTitle>
            <CardDescription>{demoModeEnabled ? "Start with a real account or use demo mode to test the app without creating one." : "Start with a real account to use the production app."}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
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
              {submitting ? "Creating account..." : "Create account"}
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
                  router.push("/dashboard");
                  router.refresh();
                }}
              >
                Continue as Demo User
              </Button>
            </>
          ) : null}
          <p className="mt-4 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:text-primary/80">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
