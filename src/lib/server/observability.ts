const ALLOWED = new Set(["requestId", "status", "code", "provider", "model", "tokens", "latencyMs", "attempt", "count", "pending", "operation"]);

export function reportEvent(event: string, fields: Record<string, unknown> = {}) {
  // Never log profiles, prompts, cookies, URLs, video, landmarks, or error bodies.
  const safe = Object.fromEntries(Object.entries(fields).filter(([key]) => ALLOWED.has(key)).map(([key, value]) => [key, typeof value === "string" ? value.replace(/[^a-zA-Z0-9_.:/ -]/g, "").slice(0, 100) : typeof value === "number" || typeof value === "boolean" ? value : null]));
  console.info(JSON.stringify({ event, ...safe, timestamp: new Date().toISOString() }));
}
