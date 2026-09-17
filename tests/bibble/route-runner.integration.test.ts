import { beforeEach, describe, expect, it, vi } from 'vitest';

const provider = vi.hoisted(() => ({
  call: vi.fn(),
  tool: vi.fn(async (...args: unknown[]) => {
    void args;
    return '{"ok":true}';
  }),
}));
vi.mock('@/../auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: {} }));
vi.mock('@/actions/PermissoesSetor', () => ({ getPermissoesEfetivas: vi.fn() }));
vi.mock('@/lib/bibble/completion', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/bibble/completion')>();
  return { ...actual, callCompletion: provider.call };
});
vi.mock('@/lib/bibble/tool-executor', () => ({ executarTool: provider.tool }));

import { deriveAdaptiveStyleForTurn, runStream } from '@/app/api/bibble/chat/route';
import type { OllamaTool } from '@/lib/bibble/tools';
import { createBibbleMetrics } from '@/lib/bibble/telemetry';
import { issueBibbleMutationGrant, type BibbleMutationGrant } from '@/lib/bibble/mutation-grant';

function response(frames: unknown[]) {
  const data = frames.map(frame => `data: ${JSON.stringify(frame)}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(data, { headers: { 'Content-Type': 'text/event-stream' } });
}

async function execute(tools: OllamaTool[], mutationGrant?: BibbleMutationGrant) {
  const chunks: Uint8Array[] = [];
  const controller = { enqueue: (chunk: Uint8Array) => chunks.push(chunk), close: vi.fn() } as unknown as ReadableStreamDefaultController;
  const abort = new AbortController();
  await runStream(controller, new TextEncoder(), [{ role: 'user', content: 'teste' }], { userId: 1, userName: 'Teste', role: 'ADMIN', permissoes: [] }, abort, 'modelo', tools, 0, 4096, 256, undefined, undefined, undefined, Date.now() + 30_000, mutationGrant);
  return new TextDecoder().decode(Buffer.concat(chunks));
}

describe('integral Bibble runner', () => {
  beforeEach(() => { provider.call.mockReset(); provider.tool.mockClear(); });

  it('uses one provider call and emits successful done for ordinary chat', async () => {
    provider.call.mockResolvedValue(response([{ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }], usage: { completion_tokens: 1 } }]));
    const events = await execute([]);
    expect(provider.call).toHaveBeenCalledTimes(1);
    expect(events).toContain('"type":"text","text":"ok"');
    expect(events).toContain('"type":"done","finishReason":"stop","truncated":false,"successful":true');
  });

  it('uses decision plus final call only after a real tool call', async () => {
    const tool: OllamaTool = { type: 'function', function: { name: 'abrir_chamado', description: 'teste', parameters: { type: 'object', properties: {}, required: [] } } };
    provider.call
      .mockResolvedValueOnce(response([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'abrir_chamado', arguments: '{}' } }] }, finish_reason: 'tool_calls' }] }]))
      .mockResolvedValueOnce(response([{ choices: [{ delta: { content: 'feito' }, finish_reason: 'stop' }], usage: { completion_tokens: 2 } }]));
    const events = await execute([tool]);
    expect(provider.call).toHaveBeenCalledTimes(2);
    expect(events).toContain('"successful":true');
  });

  it('passes the exact server-owned mutation grant to the ticket executor', async () => {
    const tool: OllamaTool = { type: 'function', function: { name: 'abrir_chamado', description: 'teste', parameters: { type: 'object', properties: {}, required: [] } } };
    const mutationGrant = issueBibbleMutationGrant({
      userId: 1,
      requestId: 'runner-ticket-grant',
      tool: 'abrir_chamado',
      expiresAt: Date.now() + 30_000,
      authorizedText: 'Abra um chamado para teste.',
    });
    provider.call
      .mockResolvedValueOnce(response([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'ticket', function: { name: 'abrir_chamado', arguments: '{}' } }] }, finish_reason: 'tool_calls' }] }]))
      .mockResolvedValueOnce(response([{ choices: [{ delta: { content: 'feito' }, finish_reason: 'stop' }] }]));

    await execute([tool], mutationGrant);

    expect(provider.tool).toHaveBeenCalledTimes(1);
    expect(provider.tool.mock.calls[0]?.[3]).toEqual(expect.objectContaining({ mutationGrant }));
  });

  it('does not invent a mutation grant for a read-only ticket consultation', async () => {
    const tool: OllamaTool = { type: 'function', function: { name: 'consultar_chamados', description: 'consulta', parameters: { type: 'object', properties: {}, required: [] } } };
    provider.call
      .mockResolvedValueOnce(response([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'query', function: { name: 'consultar_chamados', arguments: '{}' } }] }, finish_reason: 'tool_calls' }] }]))
      .mockResolvedValueOnce(response([{ choices: [{ delta: { content: 'consulta concluída' }, finish_reason: 'stop' }] }]));

    await execute([tool]);

    expect(provider.tool).toHaveBeenCalledTimes(1);
    expect(provider.tool.mock.calls[0]?.[3]).toEqual(expect.objectContaining({ mutationGrant: undefined }));
  });

  it('marks TTFT when a tool-enabled decision returns visible final text', async () => {
    const tool: OllamaTool = { type: 'function', function: { name: 'abrir_chamado', description: 'teste', parameters: { type: 'object', properties: {}, required: [] } } };
    provider.call.mockResolvedValue(response([{ choices: [{ delta: { content: 'resposta direta' }, finish_reason: 'stop' }], usage: { completion_tokens: 2 } }]));
    const metrics = createBibbleMetrics(1, 'modelo', { requestId: 'request-at-entry', startedAt: Date.now() - 10 });
    const chunks: Uint8Array[] = [];
    await runStream({ enqueue: (chunk: Uint8Array) => chunks.push(chunk), close: vi.fn() } as unknown as ReadableStreamDefaultController, new TextEncoder(), [{ role: 'user', content: 'x' }], { userId: 1, userName: 'T', role: 'USER', permissoes: [] }, new AbortController(), 'm', [tool], 0, 4096, 10, metrics, undefined, undefined, Date.now() + 30_000);
    expect(provider.call).toHaveBeenCalledTimes(1);
    expect(metrics.ttftMs).toBeTypeOf('number');
    expect(new TextDecoder().decode(Buffer.concat(chunks))).toContain('resposta direta');
  });

  it('honors an already aborted controller without provider work', async () => {
    const abort = new AbortController(); abort.abort();
    const chunks: Uint8Array[] = [];
    await runStream({ enqueue: (chunk: Uint8Array) => chunks.push(chunk), close: vi.fn() } as unknown as ReadableStreamDefaultController, new TextEncoder(), [{ role: 'user', content: 'x' }], { userId: 1, userName: 'T', role: 'USER', permissoes: [] }, abort, 'm', [], 0, 4096, 10, undefined, undefined, undefined, Date.now() + 1000);
    expect(provider.call).not.toHaveBeenCalled();
    expect(new TextDecoder().decode(Buffer.concat(chunks))).toContain('"successful":false');
  });

  it('rejects a model-injected tool outside the exact turn set', async () => {
    const allowed: OllamaTool = { type: 'function', function: { name: 'buscar_empresa', description: 'read', parameters: { type: 'object', properties: {}, required: [] } } };
    provider.call
      .mockResolvedValueOnce(response([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'bad', function: { name: 'detalhes_curso', arguments: '{}' } }] }, finish_reason: 'tool_calls' }] }]))
      .mockResolvedValueOnce(response([{ choices: [{ delta: { content: 'negado' }, finish_reason: 'stop' }] }]));
    const events = await execute([allowed]);
    expect(provider.tool).not.toHaveBeenCalled();
    expect(events).toContain('"successful":true');
  });

  it.each(['loader', 'classifier'] as const)('fails open when adaptive memory %s throws, without an extra provider call', async failure => {
    const result = await deriveAdaptiveStyleForTurn(1, 'teste', undefined, {
      loadHistory: failure === 'loader'
        ? vi.fn().mockRejectedValue(new Error('private database detail'))
        : vi.fn().mockResolvedValue([{ content: 'histórico privado' }]),
      classify: failure === 'classifier'
        ? vi.fn(() => { throw new Error('raw classifier detail'); })
        : vi.fn(),
    });
    expect(result).toEqual({
      adaptiveStyle: null,
      telemetry: { ms: expect.any(Number), sampleCount: 0, applied: false },
    });

    const tool: OllamaTool = { type: 'function', function: { name: 'abrir_chamado', description: 'teste', parameters: { type: 'object', properties: {}, required: [] } } };
    provider.call
      .mockResolvedValueOnce(response([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'abrir_chamado', arguments: '{}' } }] }, finish_reason: 'tool_calls' }] }]))
      .mockResolvedValueOnce(response([{ choices: [{ delta: { content: 'continuou' }, finish_reason: 'stop' }], usage: { completion_tokens: 1 } }]));
    const events = await execute([tool]);
    expect(provider.call).toHaveBeenCalledTimes(2);
    expect(provider.tool).toHaveBeenCalledTimes(1);
    expect(events).toContain('"type":"text","text":"continuou"');
    expect(events).toContain('"successful":true');
  });
});
