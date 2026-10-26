import { acessoEstaIndisponivel, mapearIndisponibilidadeAuth } from "@/lib/auth/indisponibilidade";
import { NextResponse } from 'next/server';
import { acessoCatcher } from '@/lib/alpha-catcher/access';
import { processarEntradaCatcher } from '@/lib/alpha-catcher/processar-entrada';
import { encaminharWorkerCatcher } from '@/lib/alpha-catcher/worker-client';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function POST(req: Request) {
  try {
  const acesso = await acessoCatcher();
  if (acesso.status !== 200) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: acesso.status });
  const origin = req.headers.get('origin');
  let mesmaOrigem = false;
  try { mesmaOrigem = Boolean(origin && new URL(origin).host === req.headers.get('host')); } catch (authError) {
    if (acessoEstaIndisponivel(authError)) throw authError; /* Origem inválida. */ }
  if (!mesmaOrigem || req.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  }
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ error: 'Envie JSON.' }, { status: 415 });
  }
  const reader = req.body?.getReader();
  const partes: Uint8Array[] = [];
  let tamanho = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > 4096) { await reader.cancel(); return NextResponse.json({ error: 'Entrada muito grande.' }, { status: 413 }); }
      partes.push(value);
    }
  }
  const text = Buffer.concat(partes).toString('utf8');
  let body: unknown;
  try { body = JSON.parse(text); } catch (authError) {
    if (acessoEstaIndisponivel(authError)) throw authError; return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  return await encaminharWorkerCatcher('processar', acesso.userId!, body) ?? await processarEntradaCatcher(body, acesso.userId!);

  } catch (authError) {
    const unavailable = mapearIndisponibilidadeAuth(authError);
    if (unavailable) return unavailable;
    throw authError;
  }
}
