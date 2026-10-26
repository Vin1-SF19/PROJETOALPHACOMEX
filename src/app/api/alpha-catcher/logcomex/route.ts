import { acessoEstaIndisponivel, mapearIndisponibilidadeAuth } from "@/lib/auth/indisponibilidade";
import { NextResponse } from 'next/server';
import { encaminharWorkerCatcher } from '@/lib/alpha-catcher/worker-client';
import { acessoCatcher } from '@/lib/alpha-catcher/access';
import { coletaSchema } from '@/lib/alpha-catcher/logcomex-input';
import { iniciarColeta, retomarColeta, lerColetaResposta, cancelarColeta, confirmarCaptcha } from '@/lib/alpha-catcher/logcomex-job';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
  const acesso = await acessoCatcher();
  if (acesso.status !== 200) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: acesso.status });
  const id = new URL(req.url).searchParams.get('id') || '';
  const desdeRaw = new URL(req.url).searchParams.get('desde');
  const desde = desdeRaw === null ? undefined : Number(desdeRaw);
  if (desdeRaw !== null && (!/^\d+$/.test(desdeRaw) || !Number.isSafeInteger(desde))) return NextResponse.json({ error: 'Índice inválido.' }, { status: 400 });
  const remoto = await encaminharWorkerCatcher('ler', acesso.userId!, desde === undefined ? id : { id, desde });
  if (remoto) return remoto;
  const job = lerColetaResposta(id, acesso.userId!, desde);
  return job ? NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } }) : NextResponse.json({ error: 'Execução não encontrada.' }, { status: 404 });

  } catch (authError) {
    const unavailable = mapearIndisponibilidadeAuth(authError);
    if (unavailable) return unavailable;
    throw authError;
  }
}
export async function POST(req: Request) {
  try {
  const acesso = await acessoCatcher();
  if (acesso.status !== 200) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: acesso.status });
  try {
    const origin = req.headers.get('origin');
    if (!origin || new URL(origin).host !== req.headers.get('host') || req.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  } catch (authError) {
    if (acessoEstaIndisponivel(authError)) throw authError; return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 }); }
  if (!req.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'Envie JSON.' }, { status: 415 });
  const reader = req.body?.getReader(); const partes: Uint8Array[] = []; let size = 0;
  if (reader) for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > 1024) { await reader.cancel(); return NextResponse.json({ error: 'Entrada muito grande.' }, { status: 413 }); }
    partes.push(value);
  }
  let data;
  try { data = JSON.parse(Buffer.concat(partes).toString('utf8')); } catch (authError) {
    if (acessoEstaIndisponivel(authError)) throw authError; return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  if (data?.acao === 'retomar') {
    const id = z.string().uuid().safeParse(data.id);
    if (!id.success) return NextResponse.json({ error: 'Importação inválida.' }, { status: 400 });
    const remoto = await encaminharWorkerCatcher('retomar', acesso.userId!, id.data);
    if (remoto) return remoto;
    try { return NextResponse.json(await retomarColeta(id.data, acesso.userId!), { status: 202 }); }
    catch (authError) {
    if (acessoEstaIndisponivel(authError)) throw authError; return NextResponse.json({ error: 'Não foi possível retomar. Confira autoria, estado e execução ativa.' }, { status: 409 }); }
  }
  if (data?.acao === 'cancelar' && typeof data.id === 'string') {
    const remoto = await encaminharWorkerCatcher('cancelar', acesso.userId!, data.id);
    return remoto ?? NextResponse.json({ cancelado: cancelarColeta(data.id, acesso.userId!) });
  }
  if (['confirmar_captcha', 'tentar_captcha'].includes(data?.acao) && typeof data.id === 'string') {
    const remoto = await encaminharWorkerCatcher(data.acao, acesso.userId!, data.id);
    if (remoto) return remoto;
    const aceita = confirmarCaptcha(data.id, acesso.userId!, data.acao);
    return NextResponse.json({ verificando: aceita }, { status: aceita ? 202 : 409 });
  }
  const parsed = coletaSchema.safeParse(data);
  if (!parsed.success) return NextResponse.json({ error: 'Informe datas até sete dias antes de hoje, embarques mínimos até máximos e um limite inteiro maior ou igual a zero (0 = sem limite).' }, { status: 400 });
  const remoto = await encaminharWorkerCatcher('iniciar', acesso.userId!, parsed.data);
  if (remoto) return remoto;
  try { return NextResponse.json(await iniciarColeta(acesso.userId!, parsed.data), { status: 202 }); }
  catch (authError) {
    if (acessoEstaIndisponivel(authError)) throw authError; return NextResponse.json({ error: 'Não foi possível iniciar. Confira a disponibilidade do banco e se há outra coleta em andamento.' }, { status: 409 }); }

  } catch (authError) {
    const unavailable = mapearIndisponibilidadeAuth(authError);
    if (unavailable) return unavailable;
    throw authError;
  }
}
