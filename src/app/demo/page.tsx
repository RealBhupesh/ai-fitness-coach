"use client";

import { Suspense } from "react";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createDemoSession } from "@/lib/dummy-auth";

function DemoLoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    createDemoSession();
    router.replace(searchParams.get("next") || "/dashboard");
    router.refresh();
  }, [router, searchParams]);

  return (
    <main className="performance-shell flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-sm rounded-lg border bg-card p-6 text-center text-card-foreground">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Demo login</p>
        <h1 className="mt-3 text-2xl font-black uppercase">Opening FitCoach AI</h1>
        <p className="mt-3 text-sm text-muted-foreground">Preparing the demo dashboard, coach, dance module, and achievements.</p>
      </section>
    </main>
  );
}

export default function DemoLoginPage() {
  return (
    <Suspense fallback={null}>
      <DemoLoginInner />
    </Suspense>
  );
}
