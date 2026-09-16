import "server-only";

export const BIBBLE_VOICE_RATE_LIMIT = 6;
export const BIBBLE_VOICE_RATE_WINDOW_MS = 60_000;
export const BIBBLE_VOICE_MAX_GLOBAL_CONCURRENCY = 4;

export interface BibbleVoiceLease {
  release(): void;
}

const recentRequests = new Map<string, number[]>();
const activeUsers = new Set<string>();
let activeGlobal = 0;

export function acquireBibbleVoiceLease(
  userId: string | number,
  now = Date.now(),
): BibbleVoiceLease | null {
  const key = String(userId);
  const windowStart = now - BIBBLE_VOICE_RATE_WINDOW_MS;
  const recent = (recentRequests.get(key) ?? []).filter(timestamp => timestamp > windowStart);

  if (
    activeUsers.has(key)
    || activeGlobal >= BIBBLE_VOICE_MAX_GLOBAL_CONCURRENCY
    || recent.length >= BIBBLE_VOICE_RATE_LIMIT
  ) {
    recentRequests.set(key, recent);
    return null;
  }

  recent.push(now);
  recentRequests.set(key, recent);
  activeUsers.add(key);
  activeGlobal += 1;
  let released = false;

  return {
    release() {
      if (released) return;
      released = true;
      activeUsers.delete(key);
      activeGlobal = Math.max(0, activeGlobal - 1);
    },
  };
}

export function resetBibbleVoiceAdmissionForTests(): void {
  recentRequests.clear();
  activeUsers.clear();
  activeGlobal = 0;
}
