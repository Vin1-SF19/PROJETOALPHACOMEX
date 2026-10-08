import { z } from 'zod';
import { historicoCatcher } from '@/lib/alpha-catcher/historico';
import { NextResponse } from 'next/server';
import { acessoCatcher } from '@/lib/alpha-catcher/access';
import { processarEmpresa, EsperaCatcher } from '@/lib/alpha-catcher/service';
import { normalizarEmpresa, normalizarDiasReceita, normalizarDataConsulta } from '@/lib/alpha-catcher/core';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function POST(req: Request) {
  const acesso = await acessoCatcher();
  if (acesso.status !== 200) return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: acesso.status });
  const origin = req.headers.get('origin');
  let mesmaOrigem = false;
  try { mesmaOrigem = Boolean(origin && new URL(origin).host === req.headers.get('host')); } catch { /* Origem inválida. */ }
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
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  const empresa = normalizarEmpresa(body);
  if (!empresa) return NextResponse.json({ error: 'CNPJ ou consignatário inválido.' }, { status: 400 });
  const days = normalizarDiasReceita(body && typeof body === 'object' && 'days' in body ? body.days : undefined);
  if (days === null) return NextResponse.json({ error: 'Dias deve ser um inteiro maior ou igual a zero.' }, { status: 400 });
  const id = z.string().uuid().optional().safeParse(body && typeof body === 'object' && 'historicoId' in body ? body.historicoId : undefined);
  if (!id.success) return NextResponse.json({ error: 'Importação inválida.' }, { status: 400 });
  const enviada = body && typeof body === 'object' && 'dataConsulta' in body ? body.dataConsulta : undefined;
  let contexto: Awaited<ReturnType<typeof historicoCatcher.contexto>> | null = null;
  if (id.data) {
    try { contexto = await historicoCatcher.contexto(id.data, acesso.userId!, empresa.cnpj); }
    catch { return NextResponse.json({ error: 'Histórico indisponível. Tente novamente.' }, { status: 503 }); }
    if (!contexto) return NextResponse.json({ error: 'Empresa não pertence a esta importação.' }, { status: 404 });
  }
  const origem = contexto?.origem || 'JSON';
  const dataConsulta = contexto ? contexto.dataConsulta || undefined : enviada;
  if (normalizarDataConsulta(enviada) === null || (contexto && enviada !== undefined && (origem !== 'JSON' || enviada !== contexto.dataConsulta))) {
    return NextResponse.json({ error: 'Informe uma data válida até hoje. A data da importação não pode ser alterada.' }, { status: 400 });
  }
  if (id.data) historicoCatcher.consulta(id.data, acesso.userId!, empresa.cnpj, true);
  try {
    const resultado = await processarEmpresa(contexto?.empresa || empresa, undefined, { days, origem, ...(id.data ? { importacaoId: id.data, importacaoUserId: acesso.userId! } : {}), ...(typeof dataConsulta === 'string' ? { dataConsulta } : {}) });
    let historicoAviso: string | undefined;
    if (id.data) {
      try { await historicoCatcher.resultado(id.data, acesso.userId!, resultado); }
      catch { historicoAviso = 'A empresa foi processada, mas não foi possível atualizar o histórico. Atualize para conferir.'; }
    }
    return NextResponse.json({ ...resultado, ...(historicoAviso ? { historicoAviso } : {}) });
  } catch (error) {
    if (error instanceof EsperaCatcher) return NextResponse.json({ error: error.message, segundos: error.segundos }, {
      status: 429, headers: { 'Retry-After': String(error.segundos) },
    });
    return NextResponse.json({ error: 'Falha ao processar empresa. Tente novamente.' }, { status: 500 });
  } finally { if (id.data) historicoCatcher.consulta(id.data, acesso.userId!, empresa.cnpj, false); }
}
