#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

const command = process.argv[2] || 'doctor';
const endpoint = new URL(process.env.BIBBLE_OLLAMA_URL || 'http://127.0.0.1:18080');
const model = process.env.BIBBLE_MODEL || 'qwen3.8-131k';
const timeoutMs = Number(process.env.BIBBLE_DOCTOR_TIMEOUT_MS) || 5_000;
const headers = { Accept: 'application/json', 'Content-Type': 'application/json', ...(process.env.OLLAMA_API_KEY ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` } : {}) };

function publicConfig() {
  return { endpoint: endpoint.origin, model, contextWindow: 131072, outputTokenLimit: 4096, concurrency: Number(process.env.BIBBLE_MAX_CONCURRENCY) || 1, rateLimitScope: 'local-instance' };
}

async function doctor() {
  const config = publicConfig();
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('configuração de endpoint inválida');
  const started = performance.now();
  const response = await fetch(new URL('/v1/models', endpoint), { headers, signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
  if (!response.ok) throw new Error(`provider respondeu HTTP ${response.status}`);
  const body = await response.json();
  const models = Array.isArray(body.data) ? body.data.map(item => item.id).filter(Boolean) : [];
  console.log(JSON.stringify({ ok: true, ...config, providerLatencyMs: Math.round(performance.now() - started), modelAvailable: models.includes(model), availableModelCount: models.length }, null, 2));
  if (!models.includes(model)) process.exitCode = 2;
}

async function benchmark() {
  const samples = Math.max(1, Math.min(20, Number(process.env.BIBBLE_BENCHMARK_SAMPLES) || 3));
  const results = [];
  for (let index = 0; index < samples; index += 1) {
    const started = performance.now(); let ttft; let chars = 0; let outputTokens; let finishReason = null;
    const response = await fetch(new URL('/v1/chat/completions', endpoint), { method: 'POST', headers, signal: AbortSignal.timeout(100_000), body: JSON.stringify({ model, stream: true, stream_options: { include_usage: true }, max_tokens: 128, temperature: 0, messages: [{ role: 'user', content: 'Responda somente com: Bibble operacional.' }] }) });
    if (!response.ok || !response.body) throw new Error(`provider respondeu HTTP ${response.status}`);
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || ''; for (const line of lines) { if (!line.startsWith('data: ') || line.includes('[DONE]')) continue; try { const chunk = JSON.parse(line.slice(6)); const text = chunk.choices?.[0]?.delta?.content || ''; if (text && ttft === undefined) ttft = performance.now() - started; chars += text.length; finishReason = chunk.choices?.[0]?.finish_reason || finishReason; outputTokens = chunk.usage?.completion_tokens ?? outputTokens; } catch {} } }
    const totalMs = performance.now() - started; const tokens = outputTokens ?? Math.ceil(chars / 3);
    results.push({ totalMs: Math.round(totalMs), ttftMs: Math.round(ttft ?? totalMs), outputTokens: tokens, tokenCount: outputTokens === undefined ? 'estimated' : 'exact', tokensPerSecond: Number((tokens / Math.max(0.001, (totalMs - (ttft ?? 0)) / 1000)).toFixed(2)), providerCalls: 1, toolCycles: 0, contextWindow: 131072, finishReason });
  }
  const percentile = (key, p) => [...results].sort((a, b) => a[key] - b[key])[Math.min(results.length - 1, Math.ceil(results.length * p) - 1)][key];
  console.log(JSON.stringify({ config: publicConfig(), syntheticPrompt: true, samples: results, summary: { totalP50Ms: percentile('totalMs', .5), totalP95Ms: percentile('totalMs', .95), ttftP50Ms: percentile('ttftMs', .5), ttftP95Ms: percentile('ttftMs', .95) } }, null, 2));
}

async function capabilities() {
  const { BIBBLE_TOOLS } = await import('../src/lib/bibble/tools.ts');
  console.log(JSON.stringify({ count: BIBBLE_TOOLS.length, tools: BIBBLE_TOOLS.map(tool => ({ name: tool.function.name, description: tool.function.description })) }, null, 2));
}

async function benchmarkToolLoop() {
  const started = performance.now();
  const tool = { type: 'function', function: { name: 'consultar_status_sintetico', description: 'Retorna status sintético read-only.', parameters: { type: 'object', properties: {}, additionalProperties: false } } };
  const messages = [{ role: 'user', content: 'Use consultar_status_sintetico e depois responda somente: operacional.' }];
  const first = await fetch(new URL('/v1/chat/completions', endpoint), { method: 'POST', headers, signal: AbortSignal.timeout(100_000), body: JSON.stringify({ model, stream: false, temperature: 0, tools: [tool], messages }) });
  if (!first.ok) throw new Error(`tool decision respondeu HTTP ${first.status}`);
  const decision = await first.json();
  const assistant = decision.choices?.[0]?.message;
  const calls = assistant?.tool_calls ?? [];
  if (calls.length !== 1 || calls[0]?.function?.name !== tool.function.name) throw new Error('provider não produziu o tool call sintético esperado');
  messages.push(assistant, { role: 'tool', tool_call_id: calls[0].id, content: JSON.stringify({ ok: true, status: 'operacional' }) });
  const second = await fetch(new URL('/v1/chat/completions', endpoint), { method: 'POST', headers, signal: AbortSignal.timeout(100_000), body: JSON.stringify({ model, stream: false, temperature: 0, messages }) });
  if (!second.ok) throw new Error(`tool final respondeu HTTP ${second.status}`);
  const final = await second.json();
  console.log(JSON.stringify({ ok: true, syntheticPrompt: true, readOnly: true, providerCalls: 2, toolCycles: 1, toolCalls: calls.length, totalMs: Math.round(performance.now() - started), usage: { decision: decision.usage ?? null, final: final.usage ?? null }, finishReason: final.choices?.[0]?.finish_reason ?? null }, null, 2));
}

try {
  if (command === 'doctor') await doctor(); else if (command === 'benchmark') await benchmark(); else if (command === 'benchmark-tool') await benchmarkToolLoop(); else if (command === 'capabilities') await capabilities(); else throw new Error('uso: bibble.mjs doctor|benchmark|benchmark-tool|capabilities');
} catch (error) { console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'falha desconhecida' })); process.exitCode = 1; }
