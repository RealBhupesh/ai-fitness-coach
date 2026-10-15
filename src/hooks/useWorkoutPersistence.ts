"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { enqueueSession, readPending, removePending } from "@/lib/coach/pending-sessions";
export function useWorkoutPersistence(userId?: string) {
  const [pendingCount, setPendingCount] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const busy = useRef(false);
  const refresh = useCallback(() => { if (userId) setPendingCount(readPending(localStorage, userId).length); }, [userId]);
  const send = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/workouts", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Session could not be saved");
    return data;
  }, []);
  const retry = useCallback(async () => {
    if (!userId || busy.current) return;
    busy.current = true; setSaveError(null);
    try {
      for (const item of readPending(localStorage, userId)) {
        await send(item.payload); removePending(localStorage, userId, item.clientSessionId);
      }
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Save failed"); }
    finally { busy.current = false; refresh(); }
  }, [userId, send, refresh]);
  useEffect(() => { refresh(); window.addEventListener("online", retry); return () => window.removeEventListener("online", retry); }, [refresh, retry]);
  const save = useCallback(async (payload: Record<string, unknown> & { clientSessionId: string }) => {
    if (!userId) throw new Error("Sign in before saving this session");
    let item;
    try { item = enqueueSession(localStorage, userId, payload); refresh(); }
    catch { throw new Error("Local recovery storage unavailable. Keep this page open and retry the save."); }
    try {
      const data = await send(item.payload);
      removePending(localStorage, userId, payload.clientSessionId); setSaveError(null); refresh(); return data;
    } catch (error) {
      setSaveError("Session kept on this device. Reconnect and retry saving.");
      throw error;
    }
  }, [userId, refresh, send]);
  return { save, retry, pendingCount, saveError };
}
