/** Accept only local absolute paths from return-to query parameters. */
export function safeNextPath(value: string | null, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value) || /^\/%(?:2f|5c)/i.test(value)) return fallback;
  try { return new URL(value, "https://fitcoach.invalid").origin === "https://fitcoach.invalid" ? value : fallback; }
  catch { return fallback; }
}
