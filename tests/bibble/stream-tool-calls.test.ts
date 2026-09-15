import { describe, expect, it } from 'vitest';
import { consumeCompletionStream } from '@/lib/bibble/completion';

describe('Bibble provider stream tool protocol', () => {
  it('assembles fragmented tool calls and exact usage', async () => {
    const frames = [
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_', type: 'function', function: { name: 'buscar_', arguments: '{\"cnpj\":' } }] }, finish_reason: null }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: '1', function: { name: 'empresa', arguments: '\"123\"}' } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 20, completion_tokens: 5 } },
    ].map(item => `data: ${JSON.stringify(item)}\n\n`).join('') + 'data: [DONE]\n\n';
    const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(frames)); controller.close(); } }));
    const result = await consumeCompletionStream(response, () => undefined);
    expect(result.toolCalls[0]).toEqual({ id: 'call_1', type: 'function', function: { name: 'buscar_empresa', arguments: '{"cnpj":"123"}' } });
    expect(result.usage?.completion_tokens).toBe(5);
    expect(result.finishReason).toBe('tool_calls');
  });
});
