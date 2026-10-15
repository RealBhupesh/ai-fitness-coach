"use client";
import { Button } from "@/components/ui/button";
export function SessionSaveStatus({ count, error, retry }: { count: number; error: string | null; retry: () => Promise<void> }) {
  if (!count && !error) return null;
  return <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200"><span>{error || `${count} session${count === 1 ? "" : "s"} waiting to save on this device.`}</span><Button variant="outline" onClick={() => void retry()}>Retry saving</Button></div>;
}
