"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth/client";
import { createDemoSession } from "@/lib/dummy-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-950/80 text-zinc-100">
        <CardHeader className="space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">Create your FitCoach AI account</CardTitle>
            <CardDescription>Start with a real account or use demo mode to test the app without creating one.</CardDescription>
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
            <Button className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-800" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-zinc-950/80 px-2 text-zinc-500">or</span></div>
          </div>
          <Button
            variant="outline"
            className="w-full border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={() => {
              createDemoSession();
              router.push("/dashboard");
              router.refresh();
            }}
          >
            Continue as Demo User
          </Button>
          <p className="mt-4 text-sm text-zinc-400">
            Already have an account?{" "}
            <Link href="/login" className="text-orange-400 hover:text-orange-300">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
