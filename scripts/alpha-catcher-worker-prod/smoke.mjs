import fs from 'node:fs';
import { fetchSmoke } from './smoke-request.mjs';
import { createHash, createHmac, randomUUID } from 'node:crypto';
const secret = fs.readFileSync(process.argv[2], 'utf8').match(/^ALPHA_CATCHER_WORKER_SECRET="([a-f0-9]{64})"$/m)?.[1];
if (!secret) throw Error('Config privada inválida.');
const remote = process.argv[3];
if (remote && remote !== 'https://catcher-worker.alpha-comex.com') throw Error('Origem HTTPS inesperada.');
const body = JSON.stringify({ operacao: remote ? 'listar-historico' : 'ler', userId: 41, dados: remote ? null : randomUUID() });
function createRequest() {
  const instante = String(Date.now()), nonce = randomUUID();
  const signature = createHmac('sha256', secret).update(`POST\n/api/internal/alpha-catcher/worker\nalpha-catcher-vercel\nalpha-catcher-worker\n${instante}\n${nonce}\n${createHash('sha256').update(body).digest('hex')}`).digest('hex');
  return { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-catcher-instante': instante, 'x-catcher-nonce': nonce, 'x-catcher-assinatura': signature }, body, redirect: 'error' };
}
const url = `${remote || 'http://127.0.0.1:3302'}/api/internal/alpha-catcher/worker`;
const { response, request } = await fetchSmoke({ url, createRequest, local: !remote });
if (response.status !== (remote ? 200 : 404)) throw Error(`Smoke autenticado falhou: HTTP ${response.status} (esperado ${remote ? 200 : 404}).`);
await response.body?.cancel();
if ((await fetch(url, { ...request, signal: AbortSignal.timeout(15000) })).status !== 401) throw Error('Proteção contra replay falhou.');
const unsigned = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', redirect: 'error', signal: AbortSignal.timeout(15000) });
if (unsigned.status !== 401) throw Error(`POST sem assinatura aceito: HTTP ${unsigned.status}.`);
await unsigned.body?.cancel();
const page = await fetch(new URL('/', url), { redirect: 'error', signal: AbortSignal.timeout(15000) });
if (page.status !== 404) throw Error(`UI exposta no worker: HTTP ${page.status}.`);
await page.body?.cancel();
console.log('Smoke HMAC, permissão, leitura do banco, replay e isolamento aprovado, sem coleta ou escrita.');
