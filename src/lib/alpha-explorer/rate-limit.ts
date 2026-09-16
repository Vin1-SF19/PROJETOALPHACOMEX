const WINDOW_MS = 60_000;
const MAX_KEYS = 5_000;

interface RateEntry { timestamps: number[]; touchedAt: number }
declare global { var alphaExplorerRateLimits: Map<string, RateEntry> | undefined }
const entries = globalThis.alphaExplorerRateLimits ?? new Map<string, RateEntry>();
if (process.env.NODE_ENV !== "production") globalThis.alphaExplorerRateLimits = entries;

export function consumeExplorerRateLimit(userId: number, action: "session" | "parts" | "destructive"): boolean {
  const maximum = action === "parts" ? 120 : action === "session" ? 20 : 30;
  const now = Date.now();
  if (entries.size > MAX_KEYS) {
    for (const [key, entry] of entries) if (now - entry.touchedAt > WINDOW_MS * 2) entries.delete(key);
  }
  const key = `${userId}:${action}`;
  const entry = entries.get(key) ?? { timestamps: [], touchedAt: now };
  entry.timestamps = entry.timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);
  entry.touchedAt = now;
  if (entry.timestamps.length >= maximum) {
    entries.set(key, entry);
    return false;
  }
  entry.timestamps.push(now);
  entries.set(key, entry);
  return true;
}
