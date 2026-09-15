import { createHash, randomUUID } from 'crypto';

export type BibbleMetrics = {
  requestId: string; startedAt: number; userRef: string; model: string;
  queueMs: number; contextMs: number; ttftMs?: number; inputTokens?: number;
  outputTokens?: number; tokenCount: 'exact' | 'estimated' | 'unavailable';
  providerCalls: number; toolCycles: number; tools: Array<{ name: string; durationMs: number; ok: boolean }>;
  finishReason?: string | null; truncated?: boolean; errorCategory?: string;
  adaptiveStyle?: { ms: number; sampleCount: number; applied: boolean };
};

export function createBibbleMetrics(userId: string | number, model: string, seed: { requestId?: string; startedAt?: number } = {}): BibbleMetrics {
  return { requestId: seed.requestId ?? randomUUID(), startedAt: seed.startedAt ?? Date.now(), userRef: createHash('sha256').update(String(userId)).digest('hex').slice(0, 12), model, queueMs: 0, contextMs: 0, tokenCount: 'unavailable', providerCalls: 0, toolCycles: 0, tools: [] };
}

export function safeBibbleLog(metrics: BibbleMetrics) {
  const durationMs = Date.now() - metrics.startedAt;
  const generationMs = metrics.ttftMs === undefined ? undefined : Math.max(1, durationMs - metrics.ttftMs);
  const tokensPerSecond = metrics.outputTokens && generationMs ? Number((metrics.outputTokens / (generationMs / 1000)).toFixed(2)) : undefined;
  console.info('[BIBBLE_METRICS]', JSON.stringify({ ...metrics, durationMs, generationMs, tokensPerSecond, timestamp: new Date(metrics.startedAt).toISOString() }));
}
