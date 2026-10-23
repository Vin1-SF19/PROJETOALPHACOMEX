import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { criarReferenciaAnexoBpm, obterTokenBlobPrivadoAnexoBpm } from "@/lib/bpm/anexos-storage";
import { ACAO_UPLOAD_ANEXO_SEM_REGISTRO, ACAO_LIMPEZA_ANEXO_PENDENTE } from "@/lib/bpm/anexos-lifecycle";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  entradaSolicitaFichaViabilidade, fichaViabilidadeDadosSchema, fichaViabilidadeExtrasSchema,
  type FichaViabilidadeDTO, type FichaViabilidadeExtras, type ResultadoFichaViabilidade,
} from "@/lib/bpm/ficha-viabilidade-documento";

type Tx = Prisma.TransactionClient;
export const FICHA_PENDENTE = "FICHA_VIABILIDADE_PENDENTE";
export const FICHA_CONCLUIDA = "FICHA_VIABILIDADE_PROCESSADA";
export const FICHA_FALHA = "FICHA_VIABILIDADE_FALHA";
export const FICHA_ESTADO = "FICHA_VIABILIDADE_ESTADO";
const LEASE_MS = 180_000;
const MAX_TENTATIVAS = 5;
const intencaoSchema = z.object({
  schemaVersion: z.literal(1), empresaId: z.number().int().positive(), eventoId: z.string(),
  actorUserId: z.number().int().positive().nullable(), tentativas: z.number().int().nonnegative(),
  proximaTentativaEm: z.number().nonnegative(), gerada: z.boolean().default(false),
  anexoId: z.string().optional(), revision: z.number().int().positive().optional(),
});
const estadoSchema = z.object({
  schemaVersion: z.literal(1), empresaId: z.number().int().positive(), empresaNome: z.string(),
  anexoId: z.string(), revision: z.number().int().positive(),
  dados: fichaViabilidadeDadosSchema, userLogado: z.string(),
});
const historicoSelect = { id: true, cardId: true, acao: true, valorNovoJson: true, usuarioId: true };
const cardSelect = { id: true, empresaId: true, pipelineId: true, responsavelId: true,
  empresa: { select: { razaoSocial: true } }, pipeline: { select: { chave: true, nome: true } },
  etapa: { select: { chave: true, nome: true } } };

export class FichaViabilidadeError extends Error {
  constructor(readonly code: "CONFLICT" | "BUSY" | "NOT_FOUND" | "INVALID_STAGE" | "FAILED", message: string) { super(message); }
}
const id = (tipo: string, value: string) => `ficha:${tipo}:${createHash("sha256").update(value).digest("hex")}`;
const estadoId = (cardId: string, empresaId: number) => id("estado", `${cardId}:${empresaId}`);
function parse<T>(schema: z.ZodType<T>, value: string | null): T | null {
  try { const result = schema.safeParse(JSON.parse(value ?? "null")); return result.success ? result.data : null; } catch { return null; }
}
function unicidade(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"; }

/** Resolve apenas a cadeia causal do próprio card; o configurador não é o autor. */
export async function resolverAtorFichaViabilidade(tx: Tx, input: {
  cardId: string; userId?: number; tipo: string; automacaoExecucaoId?: string; causationId?: string;
}): Promise<number | null> {
  if (input.tipo === "MANUAL" && input.userId && input.userId > 0) return input.userId;
  const execucao = input.automacaoExecucaoId ? await tx.bpmAutomacaoExecucao.findUnique({
    where: { id: input.automacaoExecucaoId }, select: { cardId: true, eventoId: true },
  }) : null;
  let eventoId = execucao?.cardId === input.cardId ? execucao.eventoId : input.causationId;
  const vistos = new Set<string>();
  for (let depth = 0; eventoId && depth < 8 && !vistos.has(eventoId); depth += 1) {
    vistos.add(eventoId);
    const evento = await tx.bpmEventoDominio.findUnique({ where: { id: eventoId },
      select: { cardId: true, atorTipo: true, atorUserId: true, causationId: true } });
    if (!evento || evento.cardId !== input.cardId) break;
    if (evento.atorTipo === "USUARIO" && evento.atorUserId) return evento.atorUserId;
    eventoId = evento.causationId;
  }
  return null;
}

/** Chamado na transação que confirmou a entrada. Nunca procura cards legados. */
export async function registrarIntencaoFichaViabilidade(tx: Tx, input: {
  cardId: string; empresaId: number; eventoId: string; idempotencyKey: string; actorUserId: number | null;
}) {
  const solicitacaoId = id("entrada", `${input.cardId}:${input.empresaId}:${input.idempotencyKey}`);
  await tx.bpmCardHistorico.upsert({
    where: { id: solicitacaoId }, update: {}, create: {
      id: solicitacaoId, cardId: input.cardId, acao: FICHA_PENDENTE, usuarioId: input.actorUserId,
      automacaoOrigem: "Ficha de análise de viabilidade",
      valorNovoJson: JSON.stringify({ schemaVersion: 1, empresaId: input.empresaId, eventoId: input.eventoId,
        actorUserId: input.actorUserId, tentativas: 0, proximaTentativaEm: 0, gerada: false }),
    },
  });
  return solicitacaoId;
}

async function lerEstado(tx: Tx, cardId: string, empresaId: number): Promise<FichaViabilidadeDTO | null> {
  const registro = await tx.bpmCardHistorico.findUnique({ where: { id: estadoId(cardId, empresaId) }, select: historicoSelect });
  const estado = registro?.acao === FICHA_ESTADO && registro.cardId === cardId ? parse(estadoSchema, registro.valorNovoJson) : null;
  if (!estado || estado.empresaId !== empresaId) return null;
  const anexo = await tx.bpmCardAnexo.findFirst({ where: { id: estado.anexoId, cardId }, select: { id: true } });
  if (!anexo) return null;
  return { anexoId: estado.anexoId, empresaId, empresaNome: estado.empresaNome,
    dados: estado.dados, userLogado: estado.userLogado, revision: estado.revision };
}

export async function obterFichaViabilidadePersistida(cardId: string, solicitacaoId?: string, actorUserId?: number): Promise<ResultadoFichaViabilidade> {
  const card = await db.bpmCard.findUnique({ where: { id: cardId }, select: { empresaId: true } });
  if (!card) throw new FichaViabilidadeError("NOT_FOUND", "Card não encontrado.");
  const ficha = await lerEstado(db, cardId, card.empresaId);
  const job = solicitacaoId
    ? await db.bpmCardHistorico.findFirst({ where: { id: solicitacaoId, cardId, acao: { in: [FICHA_PENDENTE, FICHA_CONCLUIDA, FICHA_FALHA] } }, select: historicoSelect })
    : await db.bpmCardHistorico.findFirst({ where: { cardId, acao: { in: [FICHA_PENDENTE, FICHA_FALHA] } }, orderBy: { createdAt: "desc" }, select: historicoSelect });
  const intent = job ? parse(intencaoSchema, job.valorNovoJson) : null;
  const valido = intent?.empresaId === card.empresaId;
  const gerada = Boolean(solicitacaoId && ficha && valido && job?.acao === FICHA_CONCLUIDA && intent?.gerada
    && intent.actorUserId === actorUserId && intent.anexoId === ficha.anexoId && intent.revision === ficha.revision);
  return { estado: ficha ? "PRONTA" : valido && job?.acao === FICHA_FALHA ? "FALHA" : valido && job ? "PENDENTE" : "AUSENTE",
    data: ficha, gerada, solicitacaoId: valido ? job?.id ?? null : null,
    ...(valido && job?.acao === FICHA_FALHA && !ficha ? { mensagem: "A reunião foi mantida. Não foi possível gerar a ficha; tente novamente." } : {}) };
}

/** Só o request que originou o agendamento recebe o descriptor anunciado. */
export async function obterFichaDoAgendamento(cardId: string, actorUserId: number, criadaApos: Date) {
  const job = await db.bpmCardHistorico.findFirst({ where: { cardId, usuarioId: actorUserId,
    createdAt: { gte: criadaApos }, acao: { in: [FICHA_PENDENTE, FICHA_CONCLUIDA, FICHA_FALHA] } },
  orderBy: { createdAt: "desc" }, select: { id: true } });
  return job ? obterFichaViabilidadePersistida(cardId, job.id, actorUserId) : null;
}

type Lease = { recurso: string; titular: string; fencingToken: number };
async function adquirirLease(cardId: string): Promise<Lease | null> {
  const recurso = `ficha-viabilidade:${cardId}`, titular = randomUUID(), agora = new Date();
  try {
    const criado = await db.bpmAutomacaoLease.create({ data: { recurso, titular, fencingToken: 1, expiraEm: new Date(agora.getTime() + LEASE_MS) } });
    return { recurso, titular, fencingToken: criado.fencingToken };
  } catch (error) { if (!unicidade(error)) throw error; }
  const update = await db.bpmAutomacaoLease.updateMany({ where: { recurso, expiraEm: { lte: agora } },
    data: { titular, fencingToken: { increment: 1 }, expiraEm: new Date(agora.getTime() + LEASE_MS) } });
  if (!update.count) return null;
  const lease = await db.bpmAutomacaoLease.findUnique({ where: { recurso }, select: { titular: true, fencingToken: true } });
  return lease?.titular === titular ? { recurso, titular, fencingToken: lease.fencingToken } : null;
}
async function validarLease(tx: Tx, lease: Lease) {
  const renovado = await tx.bpmAutomacaoLease.updateMany({
    where: { ...lease, expiraEm: { gt: new Date() } }, data: { expiraEm: new Date(Date.now() + LEASE_MS) },
  });
  if (!renovado.count) throw new FichaViabilidadeError("CONFLICT", "A ficha mudou enquanto era gerada. Recarregue e tente novamente.");
}
async function liberarLease(lease: Lease) {
  try { await db.bpmAutomacaoLease.updateMany({ where: lease, data: { expiraEm: new Date(0) } }); }
  catch { console.error("[FichaViabilidade] Lease aguardando expiração", { recurso: lease.recurso }); }
}

async function criarVersao(input: { cardId: string; empresaId: number; actorUserId: number | null; lease: Lease;
  atual: FichaViabilidadeDTO | null; extras?: FichaViabilidadeExtras; userRole?: string | null;
  intencao?: { id: string; json: string | null; payload: z.infer<typeof intencaoSchema> } }) {
  const { carregarDadosFichaViabilidadeCard } = await import("@/lib/bpm/ficha-viabilidade-server");
  const fonte = await carregarDadosFichaViabilidadeCard(input.cardId);
  if (fonte.card.empresaId !== input.empresaId) throw new FichaViabilidadeError("CONFLICT", "A empresa do card mudou. Recarregue a ficha.");
  const ator = input.actorUserId ? await db.usuarios.findUnique({ where: { id: input.actorUserId }, select: { nome: true } }) : null;
  const headId = estadoId(input.cardId, input.empresaId);
  const headAnterior = await db.bpmCardHistorico.findUnique({ where: { id: headId }, select: { valorNovoJson: true } });
  const snapshotAnterior = headAnterior ? parse(estadoSchema, headAnterior.valorNovoJson) : null;
  const dados = fichaViabilidadeDadosSchema.parse({ ...fonte.ficha.dados,
    extra: { ...(input.atual?.dados.extra ?? fonte.ficha.dados.extra), ...input.extras } });
  const userLogado = ator?.nome ?? "Gerado automaticamente";
  const token = obterTokenBlobPrivadoAnexoBpm();
  if (!token) throw new FichaViabilidadeError("FAILED", "Armazenamento da ficha indisponível. Tente novamente.");
  const [{ readFile }, path, { renderToBuffer }, { FichaAlphaPDF }, { put }] = await Promise.all([
    import("node:fs/promises"), import("node:path"), import("@react-pdf/renderer"),
    import("@/components/GerarFicha"), import("@vercel/blob"),
  ]);
  const logo = await readFile(path.join(process.cwd(), "public", "LogoTipo02.png"));
  const bytes = await renderToBuffer(FichaAlphaPDF({
    dados, userLogado, finalidade: "pre-analise", logoPath: `data:image/png;base64,${logo.toString("base64")}`,
  }));
  const pathname = `bpm/${input.cardId}/${randomUUID()}-ficha-viabilidade.pdf`;
  const referencia = criarReferenciaAnexoBpm(pathname);
  // O intent de limpeza precede o upload: mesmo um crash antes do commit é reconciliável.
  const limpeza = await db.bpmCardHistorico.create({ data: { cardId: input.cardId, acao: ACAO_UPLOAD_ANEXO_SEM_REGISTRO,
    valorAnteriorJson: referencia, usuarioId: input.actorUserId } });
  await put(pathname, bytes, { access: "private", addRandomSuffix: false, contentType: "application/pdf", token });
  const nome = `Ficha de análise de viabilidade - ${fonte.card.empresa.razaoSocial}.pdf`;
  const revision = (snapshotAnterior?.revision ?? 0) + 1;
  const dto = await db.$transaction(async tx => {
    await validarLease(tx, input.lease);
    const card = await tx.bpmCard.findUnique({ where: { id: input.cardId }, select: { empresaId: true } });
    if (card?.empresaId !== input.empresaId) throw new FichaViabilidadeError("CONFLICT", "A empresa do card mudou. Recarregue a ficha.");
    if (input.extras && input.actorUserId) await exigirAcessoBpmCard(input.cardId, input.actorUserId, input.userRole ?? null, "editarCard", tx);
    const anterior = await lerEstado(tx, input.cardId, input.empresaId);
    if ((anterior?.revision ?? 0) !== (input.atual?.revision ?? 0)) throw new FichaViabilidadeError("CONFLICT", "Esta ficha foi atualizada. Reabra o complemento antes de salvar.");
    const anexoAnterior = anterior ? await tx.bpmCardAnexo.findUnique({ where: { id: anterior.anexoId }, select: { url: true } }) : null;
    const anexo = anterior
      ? await tx.bpmCardAnexo.update({ where: { id: anterior.anexoId }, data: { url: referencia, nome, tamanho: bytes.byteLength, tipo: "application/pdf" } })
      : await tx.bpmCardAnexo.create({ data: { cardId: input.cardId, url: referencia, nome, tipo: "application/pdf", tamanho: bytes.byteLength,
        enviadoPorId: input.actorUserId ?? fonte.card.responsavelId } });
    const snapshot = { schemaVersion: 1 as const, empresaId: input.empresaId, empresaNome: fonte.card.empresa.razaoSocial,
      anexoId: anexo.id, revision, dados, userLogado };
    if (headAnterior) {
      const changed = await tx.bpmCardHistorico.updateMany({ where: { id: headId, valorNovoJson: headAnterior.valorNovoJson }, data: { valorNovoJson: JSON.stringify(snapshot) } });
      if (!changed.count) throw new FichaViabilidadeError("CONFLICT", "Esta ficha foi atualizada. Reabra o complemento antes de salvar.");
    } else await tx.bpmCardHistorico.create({ data: { id: headId, cardId: input.cardId, acao: FICHA_ESTADO, valorNovoJson: JSON.stringify(snapshot) } });
    if (input.intencao) {
      const concluida = await tx.bpmCardHistorico.updateMany({ where: { id: input.intencao.id,
        acao: { in: [FICHA_PENDENTE, FICHA_FALHA] }, valorNovoJson: input.intencao.json },
      data: { acao: FICHA_CONCLUIDA, valorNovoJson: JSON.stringify({ ...input.intencao.payload, gerada: true, anexoId: anexo.id, revision }) } });
      if (!concluida.count) throw new FichaViabilidadeError("CONFLICT", "A solicitação da ficha mudou. Recarregue e tente novamente.");
    }
    await tx.bpmCardHistorico.update({ where: { id: limpeza.id }, data: { acao: "ANEXO_UPLOAD_REGISTRADO" } });
    await tx.bpmCardHistorico.create({ data: { cardId: input.cardId, acao: anterior ? "FICHA_VIABILIDADE_COMPLEMENTADA" : "FICHA_VIABILIDADE_GERADA",
      usuarioId: input.actorUserId, automacaoOrigem: input.extras ? null : "Ficha de análise de viabilidade",
      valorNovoJson: JSON.stringify({ anexoId: anexo.id, revision, empresaId: input.empresaId }) } });
    // O arquivo anterior só é elegível para limpeza depois da confirmação da nova versão.
    if (anexoAnterior?.url) await tx.bpmCardHistorico.create({ data: { cardId: input.cardId,
      acao: ACAO_LIMPEZA_ANEXO_PENDENTE, valorAnteriorJson: anexoAnterior.url } });
    return { anexoId: anexo.id, empresaId: input.empresaId, empresaNome: snapshot.empresaNome, dados, userLogado, revision };
  });
  try { await notificarPipelineBpm({ pipelineId: fonte.card.pipelineId, cardId: input.cardId, tipo: "CARD_ATUALIZADO" }); }
  catch { console.error("[FichaViabilidade] Atualização visual pendente", { cardId: input.cardId }); }
  return dto;
}

export async function processarIntencaoFichaViabilidade(solicitacaoId: string, ignorarBackoff = false): Promise<ResultadoFichaViabilidade> {
  const job = await db.bpmCardHistorico.findUnique({ where: { id: solicitacaoId }, select: historicoSelect });
  const intent = job ? parse(intencaoSchema, job.valorNovoJson) : null;
  if (!job || !intent || ![FICHA_PENDENTE, FICHA_FALHA, FICHA_CONCLUIDA].includes(job.acao)) throw new FichaViabilidadeError("NOT_FOUND", "Solicitação de ficha não encontrada.");
  if (job.acao === FICHA_CONCLUIDA) return { ...(await obterFichaViabilidadePersistida(job.cardId)), gerada: false, solicitacaoId };
  if (!ignorarBackoff && (intent.tentativas >= MAX_TENTATIVAS || intent.proximaTentativaEm > Date.now())) return obterFichaViabilidadePersistida(job.cardId);
  const lease = await adquirirLease(job.cardId);
  if (!lease) return { ...(await obterFichaViabilidadePersistida(job.cardId)), estado: "PENDENTE", gerada: false, solicitacaoId };
  try {
    const card = await db.bpmCard.findUnique({ where: { id: job.cardId }, select: { empresaId: true } });
    if (card?.empresaId !== intent.empresaId) throw new FichaViabilidadeError("CONFLICT", "A empresa do card mudou. Recarregue a ficha.");
    const atual = await lerEstado(db, job.cardId, intent.empresaId);
    const ficha = atual ?? await criarVersao({ cardId: job.cardId, empresaId: intent.empresaId, actorUserId: intent.actorUserId, lease, atual: null,
      intencao: { id: solicitacaoId, json: job.valorNovoJson, payload: intent } });
    if (atual) await db.$transaction(async tx => {
      await validarLease(tx, lease);
      await tx.bpmCardHistorico.updateMany({ where: { id: solicitacaoId, acao: { in: [FICHA_PENDENTE, FICHA_FALHA] }, valorNovoJson: job.valorNovoJson },
        data: { acao: FICHA_CONCLUIDA, valorNovoJson: JSON.stringify({ ...intent, gerada: false, anexoId: ficha.anexoId, revision: ficha.revision }) } });
    });
    return { estado: "PRONTA", data: ficha, gerada: !atual, solicitacaoId };
  } catch (error) {
    const tentativas = intent.tentativas + 1;
    try { await db.$transaction(async tx => {
      await validarLease(tx, lease);
      await tx.bpmCardHistorico.updateMany({ where: { id: solicitacaoId, acao: { in: [FICHA_PENDENTE, FICHA_FALHA] }, valorNovoJson: job.valorNovoJson },
        data: { acao: FICHA_FALHA, valorNovoJson: JSON.stringify({ ...intent, tentativas, proximaTentativaEm: Date.now() + Math.min(60 * 60_000, 30_000 * 2 ** Math.min(tentativas, 6)) }) } });
    }); } catch { /* Um worker cujo lease expirou não pode reescrever o estado do sucessor. */ }
    console.error("[FichaViabilidade] Geração pendente", { solicitacaoId, tipo: error instanceof Error ? error.name : "Erro" });
    const confirmada = await obterFichaViabilidadePersistida(job.cardId).catch(() => null);
    if (confirmada?.data) return { ...confirmada, gerada: false, solicitacaoId };
    return { estado: "FALHA", data: null, gerada: false, solicitacaoId, mensagem: "A reunião foi mantida. Não foi possível gerar a ficha; tente novamente." };
  } finally { await liberarLease(lease); }
}

export async function garantirFichaViabilidade(cardId: string, actorUserId: number): Promise<ResultadoFichaViabilidade> {
  const card = await db.bpmCard.findUnique({ where: { id: cardId }, select: cardSelect });
  if (!card) throw new FichaViabilidadeError("NOT_FOUND", "Card não encontrado.");
  const atual = await lerEstado(db, cardId, card.empresaId);
  if (atual) return { estado: "PRONTA", data: atual, gerada: false, solicitacaoId: null };
  const job = await db.bpmCardHistorico.findFirst({ where: { cardId, acao: { in: [FICHA_PENDENTE, FICHA_FALHA] } }, orderBy: { createdAt: "desc" }, select: historicoSelect });
  const intent = job ? parse(intencaoSchema, job.valorNovoJson) : null;
  if (intent?.empresaId === card.empresaId && job) {
    const result = await processarIntencaoFichaViabilidade(job.id, true);
    return { ...result, gerada: result.gerada && intent.actorUserId === actorUserId };
  }
  if (!entradaSolicitaFichaViabilidade(card.pipeline, card.etapa)) throw new FichaViabilidadeError("INVALID_STAGE", "A geração está disponível em Reunião Agendada da Revisão de Radar.");
  const head = await db.bpmCardHistorico.findUnique({ where: { id: estadoId(cardId, card.empresaId) }, select: { valorNovoJson: true } });
  const revisionAnterior = head ? parse(estadoSchema, head.valorNovoJson)?.revision ?? 0 : 0;
  const solicitacaoId = await db.$transaction(tx => registrarIntencaoFichaViabilidade(tx, {
    cardId, empresaId: card.empresaId, actorUserId, eventoId: "manual", idempotencyKey: `manual:${cardId}:${card.empresaId}:${revisionAnterior}`,
  }));
  return processarIntencaoFichaViabilidade(solicitacaoId, true);
}

export async function salvarComplementoFichaViabilidade(input: { cardId: string; expectedRevision: number; extras: FichaViabilidadeExtras }, actorUserId: number, userRole: string | null) {
  const card = await db.bpmCard.findUnique({ where: { id: input.cardId }, select: { empresaId: true } });
  if (!card) throw new FichaViabilidadeError("NOT_FOUND", "Card não encontrado.");
  const lease = await adquirirLease(input.cardId);
  if (!lease) throw new FichaViabilidadeError("BUSY", "A ficha está sendo atualizada. Aguarde e tente novamente.");
  try {
    const atual = await lerEstado(db, input.cardId, card.empresaId);
    if (!atual) throw new FichaViabilidadeError("NOT_FOUND", "Gere a ficha antes de complementar.");
    if (atual.revision !== input.expectedRevision) throw new FichaViabilidadeError("CONFLICT", "Esta ficha foi atualizada. Reabra o complemento antes de salvar.");
    return await criarVersao({ cardId: input.cardId, empresaId: card.empresaId, actorUserId, userRole, lease, atual,
      extras: fichaViabilidadeExtrasSchema.parse(input.extras) });
  } finally { await liberarLease(lease); }
}

export async function reconciliarFichasViabilidade(limite = 25) {
  const tamanhoLote = Number.isInteger(limite) ? Math.max(1, Math.min(limite, 100)) : 25;
  // Filtrar elegibilidade ANTES do limite impede que falhas esgotadas ou jobs em
  // backoff na frente da fila bloqueiem indefinidamente novas intenções.
  const jobs = await db.$queryRaw<Array<{ id: string; valorNovoJson: string }>>(Prisma.sql`
    SELECT id, valorNovoJson FROM BpmCardHistorico
    WHERE acao IN (${FICHA_PENDENTE}, ${FICHA_FALHA})
      AND json_valid(valorNovoJson)
      AND json_extract(valorNovoJson, '$.schemaVersion') = 1
      AND json_type(valorNovoJson, '$.empresaId') = 'integer'
      AND json_extract(valorNovoJson, '$.empresaId') > 0
      AND json_type(valorNovoJson, '$.eventoId') = 'text'
      AND json_type(valorNovoJson, '$.actorUserId') IN ('integer', 'null')
      AND (json_type(valorNovoJson, '$.actorUserId') = 'null' OR json_extract(valorNovoJson, '$.actorUserId') > 0)
      AND json_type(valorNovoJson, '$.tentativas') = 'integer'
      AND json_extract(valorNovoJson, '$.tentativas') >= 0
      AND json_extract(valorNovoJson, '$.tentativas') < ${MAX_TENTATIVAS}
      AND json_type(valorNovoJson, '$.proximaTentativaEm') IN ('integer', 'real')
      AND json_extract(valorNovoJson, '$.proximaTentativaEm') >= 0
      AND json_extract(valorNovoJson, '$.proximaTentativaEm') <= ${Date.now()}
      AND (json_type(valorNovoJson, '$.gerada') IS NULL OR json_type(valorNovoJson, '$.gerada') IN ('true', 'false'))
      AND (json_type(valorNovoJson, '$.anexoId') IS NULL OR json_type(valorNovoJson, '$.anexoId') = 'text')
      AND (json_type(valorNovoJson, '$.revision') IS NULL OR (json_type(valorNovoJson, '$.revision') = 'integer' AND json_extract(valorNovoJson, '$.revision') > 0))
    ORDER BY createdAt ASC, id ASC LIMIT ${tamanhoLote}
  `);
  let concluidas = 0, falhas = 0;
  for (const job of jobs) {
    const intent = parse(intencaoSchema, job.valorNovoJson);
    if (!intent || intent.tentativas >= MAX_TENTATIVAS || intent.proximaTentativaEm > Date.now()) continue;
    try { const result = await processarIntencaoFichaViabilidade(job.id); if (result.estado === "PRONTA") concluidas += 1; else if (result.estado === "FALHA") falhas += 1; }
    catch { falhas += 1; }
  }
  return { examinadas: jobs.length, concluidas, falhas };
}
