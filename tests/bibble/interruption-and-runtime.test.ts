import { describe, expect, it } from 'vitest';
import { interruptBibbleTurn } from '@/lib/bibble/turn-interruption';
import { safeBibbleLog } from '@/lib/bibble/telemetry';
import { readFile } from 'fs/promises';
import { executarTool } from '@/lib/bibble/tool-executor';

describe('Bibble interruption and runtime contracts', () => {
  it('aborts the active request and removes the unpersisted pair', () => {
    const controller = new AbortController();
    const messages = [
      { id: 'old', role: 'assistant' as const, content: 'ok' },
      { id: 'user', role: 'user' as const, content: 'novo' },
      { id: 'pending', role: 'assistant' as const, content: '', streaming: true },
    ];
    expect(interruptBibbleTurn(controller, messages)).toEqual([messages[0]]);
    expect(controller.signal.aborted).toBe(true);
  });

  it('uses post-TTFT generation duration for throughput', () => {
    const original = console.info; let payload = '';
    console.info = (_label, value) => { payload = String(value); };
    try {
      safeBibbleLog({ requestId: 'r', startedAt: Date.now() - 1100, userRef: 'u', model: 'm', queueMs: 0, contextMs: 100, ttftMs: 1000, outputTokens: 10, tokenCount: 'exact', providerCalls: 1, toolCycles: 0, tools: [] });
      const metric = JSON.parse(payload);
      expect(metric.generationMs).toBeLessThan(200);
      expect(metric.tokensPerSecond).toBeGreaterThan(50);
    } finally { console.info = original; }
  });

  it('applies reduced motion to the sprite loop, bubble and streaming dots', async () => {
    const source = await readFile('src/components/BibbleChatHome/BibbleSpriteCompanion.tsx', 'utf8');
    expect(source).toContain('if (reduceMotion) return');
    expect(source).toContain('initial={reduceMotion ? false');
    expect(source).toContain('animate={reduceMotion ? undefined');
    expect(source).toContain('OPERATIONAL_STREAMING_FALAS');
  });

  it('does not start a mutation without sufficient deadline margin', async () => {
    const result = await executarTool('abrir_chamado', { titulo: 'x' }, { userId: 1, userName: 'T', role: 'USER', permissoes: [] }, { deadlineAt: Date.now() + 100 });
    expect(result).toContain('não possui prazo seguro');
  });

  it('aborts and clears delayed humor and blocks Onyx probe failures before native fallback', async () => {
    const sprite = await readFile('src/components/BibbleChatHome/BibbleSpriteCompanion.tsx', 'utf8');
    expect(sprite).toContain('curiosidadeFetch.current?.abort()');
    expect(sprite).toContain('pendingCuriosidade.current = null');
    expect(sprite).toContain('humorEnabled && !isStreaming');
    const layout = await readFile('src/components/BibbleChatHome/BibbleChatLayout.tsx', 'utf8');
    const failedProbe = layout.indexOf('if (!onyxRes.ok)');
    const nativeFallback = layout.indexOf('// 2. Conversa Bibble/Ollama');
    expect(failedProbe).toBeGreaterThan(0);
    expect(layout.slice(failedProbe, nativeFallback)).toContain('setRuntimeBlocked(message)');
    expect(layout.slice(failedProbe, nativeFallback)).toContain('return;');
    expect(layout).toContain('if (runtimeBlocked) return;');
  });

  it('creates request correlation before auth and context work', async () => {
    const route = await readFile('src/app/api/bibble/chat/route.ts', 'utf8');
    const post = route.slice(route.indexOf('export async function POST'));
    expect(post.indexOf('const requestId = randomUUID()')).toBeLessThan(post.indexOf('await auth()'));
    expect(post).toContain('createBibbleMetrics(userId, activeModel, { requestId, startedAt: requestStartedAt })');
  });
});
