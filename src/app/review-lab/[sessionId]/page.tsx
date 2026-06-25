"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, Brain, Download, FileText, ShieldCheck } from "lucide-react";
import type { ReviewLabReport } from "@/lib/review-lab/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function ReviewLabSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<ReviewLabReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/review-lab/sessions/${encodeURIComponent(params.sessionId)}`, { credentials: "include" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setReport(data.report ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  const exportReport = async () => {
    const response = await fetch("/api/review-lab/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId: params.sessionId }),
    });
    if (!response.ok) return;
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `review-lab-${params.sessionId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading report...</div>;
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Card>
          <CardHeader>
            <CardTitle>Report unavailable</CardTitle>
            <CardDescription>The session may not exist or may not belong to this account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/review-lab"><Button>Back to Review Lab</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge className="mb-3">{report.claimBoundary}</Badge>
          <h1 className="text-3xl font-black uppercase leading-none md:text-5xl">{report.title}</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{report.summary}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/review-lab/methodology"><Button variant="outline">Methodology</Button></Link>
          <Button className="gap-2" onClick={exportReport}><Download className="h-4 w-4" /> Export JSON</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Score", `${report.overallScore}/100`],
          ["Confidence", `${Math.round(report.modelConfidence * 100)}%`],
          ["Camera", report.cameraQuality],
          ["Evidence", String(report.evidenceCount)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-black capitalize">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Evidence Timeline</CardTitle>
          <CardDescription>Rep-by-rep or phrase-by-phrase measured evidence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {report.evidence.map((item, index) => (
            <div key={index} className="rounded-lg border bg-card/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold">
                  {item.kind === "rep" ? `Rep ${item.repNumber}` : item.phraseLabel}
                </h3>
                <Badge variant="outline">{item.kind === "rep" ? `${item.overallScore}/100` : `${item.timingScore}/100 timing`}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {item.metrics.map((metric) => (
                  <div key={metric.key} className="rounded-md border bg-background/60 p-3">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{metric.label}</span>
                      <span>{metric.score}/100</span>
                    </div>
                    <Progress value={metric.score} />
                    <p className="mt-2 text-xs text-muted-foreground">{metric.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> AI Cue Grounding</CardTitle>
            <CardDescription>Every cue is tied to measured evidence and claim boundaries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.aiCueHistory.length ? report.aiCueHistory.map((cue, index) => (
              <div key={index} className="rounded-lg border bg-card/70 p-3">
                <p className="font-medium">{cue.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">Grounded by: {cue.groundedBy.join(", ")}</p>
                <Badge className="mt-2" variant="outline">{cue.claimBoundary}</Badge>
              </div>
            )) : <p className="text-sm text-muted-foreground">No AI cues were saved for this session.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Limitations</CardTitle>
            <CardDescription>Conditions that reduce the strength of system claims.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.limitations.map((limitation) => (
              <div key={limitation.code} className="flex gap-3 rounded-lg border bg-card/70 p-3 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium capitalize">{limitation.code.replace(/_/g, " ")}</p>
                  <p className="text-muted-foreground">{limitation.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
