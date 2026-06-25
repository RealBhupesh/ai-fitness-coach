"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Download, FileText, ShieldAlert } from "lucide-react";
import type { ReviewLabSessionSummary } from "@/lib/review-lab/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function moduleLabel(module: string) {
  if (module === "bicep_curl") return "Bicep curl";
  if (module === "dance") return "Dance phrase";
  return "Squat";
}

export default function ReviewLabPage() {
  const [sessions, setSessions] = useState<ReviewLabSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/review-lab/sessions", { credentials: "include" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <Badge className="mb-3 gap-1">
          <ClipboardCheck className="h-3 w-3" />
          Professor proof layer
        </Badge>
        <h1 className="text-3xl font-black uppercase leading-none md:text-5xl">Movement Intelligence Review Lab</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Review squat, curl, and dance sessions with measured evidence, confidence, AI cue grounding, and explicit limitations.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="h-8 w-64 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No review sessions yet</CardTitle>
            <CardDescription>Complete a squat, curl, or dance session to generate structured evidence.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/coach/workout"><Button>Start workout</Button></Link>
            <Link href="/coach/dance"><Button variant="outline">Start dance</Button></Link>
            <Link href="/review-lab/methodology"><Button variant="outline">View methodology</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => (
            <Card key={session.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Badge>{moduleLabel(session.module)}</Badge>
                  <Badge variant={session.cameraQuality === "ready" ? "secondary" : "outline"}>{session.cameraQuality}</Badge>
                </div>
                <CardTitle>{session.title}</CardTitle>
                <CardDescription>{new Date(session.date).toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>Overall score</span>
                    <span>{session.overallScore}/100</span>
                  </div>
                  <Progress value={session.overallScore} />
                </div>
                <div className="rounded-lg border bg-card/70 p-3 text-sm">
                  <p className="font-semibold">Top finding</p>
                  <p className="mt-1 text-muted-foreground">{session.topMistake}</p>
                </div>
                {session.limitationCount > 0 ? (
                  <div className="flex items-center gap-2 text-sm text-amber-500">
                    <ShieldAlert className="h-4 w-4" />
                    {session.limitationCount} limitation{session.limitationCount === 1 ? "" : "s"} attached
                  </div>
                ) : null}
                <div className="mt-auto flex gap-2">
                  <Link href={`/review-lab/${session.id}`} className="flex-1">
                    <Button className="w-full gap-2"><FileText className="h-4 w-4" /> Review</Button>
                  </Link>
                  <Button variant="outline" className="gap-2" disabled>
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
