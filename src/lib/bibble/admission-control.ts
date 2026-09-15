type Bucket = { timestamps: number[]; active: number };
const buckets = new Map<string, Bucket>();
let activeGlobal = 0;

export const BIBBLE_RATE_WINDOW_MS = Math.max(1_000, Number(process.env.BIBBLE_RATE_WINDOW_MS) || 60_000);
export const BIBBLE_RATE_MAX = Math.max(1, Number(process.env.BIBBLE_RATE_MAX) || 12);
export const BIBBLE_USER_CONCURRENCY = Math.max(1, Number(process.env.BIBBLE_USER_CONCURRENCY) || 1);
export const BIBBLE_GLOBAL_CONCURRENCY = Math.max(1, Number(process.env.BIBBLE_MAX_CONCURRENCY) || 1);

export type AdmissionLease = { release: () => void; queueMs: number };

/** Limite deliberadamente local à instância; coordenação multi-instância requer infraestrutura externa. */
export function acquireBibbleLease(userId: string, now = Date.now()): AdmissionLease | null {
  const bucket = buckets.get(userId) ?? { timestamps: [], active: 0 };
  bucket.timestamps = bucket.timestamps.filter(ts => now - ts < BIBBLE_RATE_WINDOW_MS);
  if (bucket.timestamps.length >= BIBBLE_RATE_MAX || bucket.active >= BIBBLE_USER_CONCURRENCY || activeGlobal >= BIBBLE_GLOBAL_CONCURRENCY) return null;
  bucket.timestamps.push(now);
  bucket.active += 1;
  activeGlobal += 1;
  buckets.set(userId, bucket);
  let released = false;
  return {
    queueMs: 0,
    release: () => {
      if (released) return;
      released = true;
      bucket.active = Math.max(0, bucket.active - 1);
      activeGlobal = Math.max(0, activeGlobal - 1);
    },
  };
}

export function resetBibbleAdmissionForTests() { buckets.clear(); activeGlobal = 0; }
