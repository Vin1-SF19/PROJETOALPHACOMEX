import 'server-only';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
const caminho = '/api/internal/alpha-catcher/worker';
const globals = globalThis as typeof globalThis & { catcherWorkerNonces?: Map<string, number> };
const usados = globals.catcherWorkerNonces ??= new Map<string, number>();
function assinatura(body: string, instante: string, nonce: string, secret: string) {
  return createHmac('sha256', secret).update(`POST\n${caminho}\nalpha-catcher-vercel\nalpha-catcher-worker\n${instante}\n${nonce}\n${createHash('sha256').update(body).digest('hex')}`).digest('hex');
}
export function assinarWorkerCatcher(body: string, secret: string, agora = Date.now()) {
  if (secret.length < 32) throw new Error('Chave do worker inválida.');
  const instante = String(agora), nonce = randomUUID();
  return { 'x-catcher-instante': instante, 'x-catcher-nonce': nonce, 'x-catcher-assinatura': assinatura(body, instante, nonce, secret) };
}
export function verificarWorkerCatcher(body: string, headers: Headers, secret: string, agora = Date.now()) {
  if (secret.length < 32) return false;
  const instante = headers.get('x-catcher-instante') || '', nonce = headers.get('x-catcher-nonce') || '', recebida = headers.get('x-catcher-assinatura') || '';
  if (!/^\d{13}$/.test(instante) || agora - Number(instante) > 45000 || Number(instante) - agora > 2000 || !/^[0-9a-f-]{36}$/i.test(nonce) || !/^[a-f0-9]{64}$/.test(recebida)) return false;
  const esperada = assinatura(body, instante, nonce, secret);
  if (!timingSafeEqual(Buffer.from(recebida, 'hex'), Buffer.from(esperada, 'hex'))) return false;
  for (const [key, exp] of usados) if (exp < agora) usados.delete(key);
  if (usados.has(nonce)) return false;
  usados.set(nonce, Number(instante) + 45000);
  return true;
}
