"use client";

import { AlertTriangle, Camera, CheckCircle2, LifeBuoy, Shield, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  cameraOn: boolean;
  loading: boolean;
  ready: boolean;
  title: string;
  description: string;
  calibration: string[];
  confidenceMessage: string;
  whyThisSession?: string;
  focusMetric?: {
    label: string;
    target: string;
    measuredValue: string;
    cue: string;
  };
  cameraState?: {
    quality: string;
    readiness: number;
    canUseDemoFallback: boolean;
  };
  onEnableCamera: () => void | Promise<void>;
  onStartSession: () => void;
  onDemoFallback?: () => void;
};

export function SessionSetupCard({
  cameraOn,
  loading,
  ready,
  title,
  description,
  calibration,
  confidenceMessage,
  whyThisSession,
  focusMetric,
  cameraState,
  onEnableCamera,
  onStartSession,
  onDemoFallback,
}: Props) {
  return (
    <Card className="w-full max-w-lg border-zinc-800 bg-zinc-900/90 text-zinc-100 shadow-2xl">
      <CardHeader className="space-y-3">
        <Badge className="w-fit bg-orange-500/15 text-orange-300">Pre-session calibration</Badge>
        <div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="mt-1 text-zinc-400">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 text-cyan-400" />
            <p>Camera video stays in the live session for pose analysis. Keep enough space around you and stop immediately if you feel pain.</p>
          </div>
        </div>

        {whyThisSession ? (
          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4 text-sm text-zinc-200">
            <p className="font-medium text-cyan-100">Why this session</p>
            <p className="mt-1 text-zinc-300">{whyThisSession}</p>
          </div>
        ) : null}

        {focusMetric ? (
          <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-4 text-sm">
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 h-4 w-4 text-orange-300" />
              <div>
                <p className="font-medium text-orange-100">Today: {focusMetric.label}</p>
                <p className="mt-1 text-zinc-300">{focusMetric.cue}</p>
                <p className="mt-2 text-xs text-zinc-400">Target: {focusMetric.target} • Measured by: {focusMetric.measuredValue}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {calibration.map((item) => (
            <div key={item} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm">
              <span>{item}</span>
              <Badge variant="outline" className={cn("border-zinc-700 text-zinc-300", ready && "border-emerald-500/40 text-emerald-300")}>
                {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : "check"}
              </Badge>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-300">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
            <div>
              <p>{confidenceMessage}</p>
              {cameraState ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Camera: {cameraState.quality.replaceAll("_", " ")} • readiness {cameraState.readiness}%
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {!cameraOn ? (
            <Button className="flex-1 gap-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600" onClick={onEnableCamera} disabled={loading}>
              <Camera className="h-4 w-4" />
              {loading ? "Loading camera..." : "Enable camera"}
            </Button>
          ) : null}
          <Button variant="outline" className="flex-1 border-zinc-700 bg-zinc-950 text-zinc-100" onClick={onStartSession} disabled={!cameraOn || !ready}>
            {ready ? "Start session" : "Finish calibration"}
          </Button>
        </div>
        {cameraState?.canUseDemoFallback && onDemoFallback ? (
          <Button variant="ghost" className="w-full gap-2 text-cyan-100 hover:bg-cyan-500/10 hover:text-cyan-50" onClick={onDemoFallback}>
            <LifeBuoy className="h-4 w-4" />
            Use demo fallback
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
