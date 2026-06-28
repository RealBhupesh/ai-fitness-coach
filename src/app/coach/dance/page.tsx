"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const DanceStudio = dynamic(() => import("@/components/dance/DanceStudio"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400">Loading AI Pose Analyzer...</p>
      </div>
    </div>
  ),
});

export default function DanceCoachPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-400">Loading...</p>
          </div>
        </div>
      }
    >
      <DanceStudio />
    </Suspense>
  );
}
