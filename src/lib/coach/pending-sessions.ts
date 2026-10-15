export type PendingSession = { clientSessionId: string; payload: Record<string, unknown>; queuedAt: string };
export function queueKey(userId: string) { return `fitcoach:pending-sessions:${userId}`; }
export function readPending(storage: Pick<Storage, "getItem">, userId: string): PendingSession[] {
  try {
    const parsed = JSON.parse(storage.getItem(queueKey(userId)) || "[]");
    return Array.isArray(parsed) ? parsed.filter(p => typeof p.clientSessionId === "string" && p.payload && typeof p.payload === "object") : [];
  } catch { return []; }
}
export function enqueueSession(storage: Pick<Storage, "getItem" | "setItem">, userId: string, payload: Record<string, unknown> & { clientSessionId: string }) {
  const queue = readPending(storage, userId);
  const existing = queue.find(p => p.clientSessionId === payload.clientSessionId);
  if (existing) return existing;
  if (queue.length >= 20) throw new Error("Save pending sessions before starting another session");
  const item = { clientSessionId: payload.clientSessionId, payload, queuedAt: new Date().toISOString() };
  storage.setItem(queueKey(userId), JSON.stringify([...queue, item]));
  return item;
}
export function removePending(storage: Pick<Storage, "getItem" | "setItem">, userId: string, id: string) {
  storage.setItem(queueKey(userId), JSON.stringify(readPending(storage, userId).filter(p => p.clientSessionId !== id)));
}

export function clearUserDeviceData(storage: Pick<Storage, "removeItem">, userId: string) {
  storage.removeItem(queueKey(userId));
  storage.removeItem(`fitness-coach:last-curl-memory:${userId}`);
}
