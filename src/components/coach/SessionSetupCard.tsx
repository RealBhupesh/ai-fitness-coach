"use client";

import { AlertTriangle, Camera, CheckCircle2, Shield } from "lucide-react";
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
  onEnableCamera: () => void | Promise<void>;
  onStartSession: () => void;
};

export function SessionSetupCard({
  cameraOn,
  loading,
  ready,
  title,
  description,
  calibration,
  confidenceMessage,
  onEnableCamera,
  onStartSession,
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
            <p>{confidenceMessage}</p>
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
      </CardContent>
    </Card>
  );
}
