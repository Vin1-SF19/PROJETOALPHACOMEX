import { acessoEstaIndisponivel, mapearIndisponibilidadeAuth } from "@/lib/auth/indisponibilidade";
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { acessoCatcher } from '@/lib/alpha-catcher/access';
import { importarEmpresas, normalizarDataConsulta } from '@/lib/alpha-catcher/core';
import { historicoCatcher } from '@/lib/alpha-catcher/historico';

export const runtime = 'nodejs';
export const maxDuration = 180;
const criacoes = new Map<string, Promise<void>>();
const entrada = z.object({ id: z.string().uuid().optional(), arquivo: z.string().trim().min(1).max(255), empresas: z.array(z.unknown()), dataConsulta: z.string().optional() });

export async function POST(req: Request) {
  try {
  const acesso = await acessoCatcher();
  if (acesso.status !== 200) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: acesso.status });
  try {
    if (new URL(req.headers.get('origin') || '').host !== req.headers.get('host') || req.headers.get('sec-fetch-site') === 'cross-site') throw new Error();
  } catch (authError) {
    if (acessoEstaIndisponivel(authError)) throw authError; return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 }); }
  if (!req.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'Envie JSON.' }, { status: 415 });
  let body: unknown;
  try { body = await req.json(); } catch (authError) {
    if (acessoEstaIndisponivel(authError)) throw authError; return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  const parsed = entrada.safeParse(body);
  if (!parsed.success || normalizarDataConsulta(parsed.data.dataConsulta) === null) return NextResponse.json({ error: 'Arquivo ou data inválidos.' }, { status: 400 });
  const dados = importarEmpresas(parsed.data);
  if (!dados.empresas.length) return NextResponse.json({ error: 'Nenhuma empresa válida encontrada.' }, { status: 400 });
  const id = parsed.data.id || randomUUID();
  try {
    const key = `${acesso.userId}:${id}`;
    const anterior = criacoes.get(key) || Promise.resolve();
    const criacao = anterior.catch(() => undefined).then(() => historicoCatcher.iniciarJson(id, acesso.userId!, parsed.data.arquivo, dados.empresas, parsed.data.dataConsulta || null));
    criacoes.set(key, criacao);
    try { await criacao; } finally { if (criacoes.get(key) === criacao) criacoes.delete(key); }
    return NextResponse.json({ id, total: dados.empresas.length, invalidos: dados.invalidos, duplicados: dados.duplicados }, { status: 201 });
  } catch (authError) {
    if (acessoEstaIndisponivel(authError)) throw authError; return NextResponse.json({ error: 'Não foi possível registrar o histórico. Tente novamente antes de processar.' }, { status: 503 }); }

  } catch (authError) {
    const unavailable = mapearIndisponibilidadeAuth(authError);
    if (unavailable) return unavailable;
    throw authError;
  }
}
