import 'server-only';
import { NextResponse } from 'next/server';
import { assinarWorkerCatcher } from './worker-auth';
export type OperacaoWorkerCatcher = 'iniciar' | 'retomar' | 'ler' | 'cancelar' | 'confirmar_captcha' | 'tentar_captcha' | 'processar' | 'listar-historico' | 'detalhar-historico';
export async function encaminharWorkerCatcher(operacao: OperacaoWorkerCatcher, userId: number, dados: unknown): Promise<Response | null> {
  // O host nunca encaminha para si próprio. Vercel nunca inicia subprocesso local.
  if (!process.env.VERCEL && process.env.ALPHA_CATCHER_WORKER_HOST === 'true') return null;
  const configurada = process.env.ALPHA_CATCHER_WORKER_URL;
  if (!configurada && !process.env.VERCEL) return null;
  try {
    if (!configurada || !Number.isSafeInteger(userId) || userId <= 0) throw new Error();
    const url = new URL(configurada);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    url.pathname = '/api/internal/alpha-catcher/worker';
    const body = JSON.stringify({ operacao, userId, dados });
    const secret = process.env.ALPHA_CATCHER_WORKER_SECRET || '';
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...assinarWorkerCatcher(body, secret) }, body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(operacao === 'processar' ? 175000 : 30000) });
    const resultado: unknown = await response.json();
    if (!resultado || typeof resultado !== 'object' || (response.ok && ['iniciar', 'retomar'].includes(operacao) && !('id' in resultado))) throw new Error();
    // Não encaminhar logs/stack de serviços de infraestrutura ou páginas de proxy.
    if (response.status >= 500) throw new Error();
    const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
    const retry = response.headers.get('retry-after');
    if (retry && /^\d+$/.test(retry)) headers['Retry-After'] = retry;
    return NextResponse.json(resultado, { status: response.status, headers });
  } catch {
    return NextResponse.json({ error: 'Worker Logcomex indisponível ou não configurado. A coleta precisa de um servidor persistente.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
