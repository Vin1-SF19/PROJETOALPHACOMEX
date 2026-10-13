import 'server-only';
import { z } from 'zod';
import { historicoCatcher } from './historico';
import { NextResponse } from 'next/server';
import { coletaSchema } from './logcomex-input';
import { iniciarColeta, retomarColeta, lerColetaResposta, cancelarColeta, confirmarCaptcha } from './logcomex-job';
import { processarEntradaCatcher } from './processar-entrada';
import type { OperacaoWorkerCatcher } from './worker-client';
export async function executarWorkerCatcher(operacao: OperacaoWorkerCatcher, userId: number, dados: unknown) {
  if (operacao === 'listar-historico') {
    const cursor = z.number().int().positive().safe().nullable().safeParse(dados);
    if (!cursor.success) return NextResponse.json({ error: 'Página inválida.' }, { status: 400 });
    return NextResponse.json(await historicoCatcher.listarCompartilhado(cursor.data ?? undefined, userId), { headers: { 'Cache-Control': 'no-store' } });
  }
  if (operacao === 'detalhar-historico') {
    const referencia = z.union([z.number().int().positive().safe(), z.string().uuid()]).safeParse(dados);
    if (!referencia.success) return NextResponse.json({ error: 'Importação inválida.' }, { status: 400 });
    const detalhe = await historicoCatcher.detalharCompartilhado(referencia.data, userId);
    return detalhe ? NextResponse.json(detalhe, { headers: { 'Cache-Control': 'no-store' } }) : NextResponse.json({ error: 'Importação não encontrada.' }, { status: 404 });
  }
  if (operacao === 'processar') return processarEntradaCatcher(dados, userId);
  if (operacao === 'retomar') {
    const id = z.string().uuid().safeParse(dados);
    if (!id.success) return NextResponse.json({ error: 'Importação inválida.' }, { status: 400 });
    try { return NextResponse.json(await retomarColeta(id.data, userId), { status: 202 }); }
    catch { return NextResponse.json({ error: 'Não foi possível retomar. Confira autoria, estado e execução ativa.' }, { status: 409 }); }
  }
  if (operacao === 'iniciar') {
    const parsed = coletaSchema.safeParse(dados);
    if (!parsed.success) return NextResponse.json({ error: 'Parâmetros da coleta inválidos.' }, { status: 400 });
    try { return NextResponse.json(await iniciarColeta(userId, parsed.data), { status: 202 }); }
    catch { return NextResponse.json({ error: 'Não foi possível iniciar. Confira a disponibilidade do banco e se há outra coleta em andamento.' }, { status: 409 }); }
  }
  const id = typeof dados === 'string' ? dados : typeof dados === 'object' && dados !== null && 'id' in dados && typeof dados.id === 'string' ? dados.id : '';
  if (operacao === 'ler') {
    const desde = typeof dados === 'object' && dados !== null && 'desde' in dados && typeof dados.desde === 'number' && Number.isSafeInteger(dados.desde) && dados.desde >= 0 ? dados.desde : undefined;
    const job = lerColetaResposta(id, userId, desde);
    return job ? NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } }) : NextResponse.json({ error: 'Execução não encontrada.' }, { status: 404 });
  }
  if (operacao === 'cancelar') return NextResponse.json({ cancelado: cancelarColeta(id, userId) });
  const aceita = confirmarCaptcha(id, userId, operacao);
  return NextResponse.json({ verificando: aceita }, { status: aceita ? 202 : 409 });
}
