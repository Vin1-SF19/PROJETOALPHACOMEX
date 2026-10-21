import "server-only";

import { createHash } from "node:crypto";

import { idTarefaUnicaPorTipo } from "@/lib/bpm/automacoes/idempotencia-tarefa";
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { CHAVES_CAMPOS as C } from "@/lib/bpm/financeiro-config.client";
import { etapaEhFechado } from "@/lib/bpm/status-pos-fechamento";
import { extrairPathnamePrivadoAnexoBpm, extrairUrlLegadaAnexoBpm } from "@/lib/bpm/anexos-storage";
import { checarAcessoBpmCard } from "@/lib/bpm/ownership";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";
import { BPM_ANEXO_ALLOWED_MIME } from "@/lib/validations/bpm";
import type { DocumentosContratacaoComercial, SlotContratoComercial, TipoContratoComercial } from "@/lib/bpm/contratos-comerciais";
import { dispararAlertaTarefaBpm, tarefaAlertaSelect } from "@/lib/bpm/alertas-tarefas";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";

export const idTarefaContratacao = (tipo: "envio" | "pagamento", comercialId: string, financeiroId: string) =>
  idTarefaUnicaPorTipo(comercialId, JSON.stringify(["contratacao", tipo, financeiroId]));

export async function acessoAcompanhamentoComercial(cardId: string, userId: number, role: string | null, tx: Prisma.TransactionClient = db) {
  const acesso = await checarAcessoBpmCard(cardId, userId, role, "visualizar", tx);
  if (!acesso.autorizado) throw new Error("Não autorizado");
  const card = await tx.bpmCard.findUnique({ where: { id: cardId }, select: {
    etapa: { select: { visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } } } },
  } });
  return acesso.isAdminGlobal || Boolean(acesso.role && acesso.role !== "VISUALIZADOR" && card
    && resolverVisibilidadeEtapa(acesso.perfilGlobal, card.etapa.visibilidades).podeAgir);
}

export type ArquivoContratacaoServidor = {
  anexoId: string; nome: string; tipo: string; referencia: string;
  armazenamento: "privado" | "legado" | "gerado"; revisao: string;
};

/** Resolve only the current field-owned file; never follow caller-provided URLs. */
async function resolverArquivoContratacao(tx: Prisma.TransactionClient, cardId: string, empresaId: number,
  campo: { campoId: string; valor: string | null } | undefined): Promise<ArquivoContratacaoServidor | null> {
  const anexo = campo?.valor ? await tx.bpmCardAnexo.findFirst({
    where: { id: campo.valor, cardId, campoId: campo.campoId }, select: { id: true, nome: true, tipo: true, url: true },
  }) : null;
  if (!anexo) return null;
  if (anexo.tipo === "application/x-painel-alpha-documento") {
    const token = /^\/PainelAlpha\/GeradorDocumentos\/conferencia\/([0-9a-f-]{36})$/.exec(anexo.url)?.[1];
    const gerado = token ? await tx.documentoGerado.findUnique({ where: { tokenAcesso: token },
      select: { id: true, status: true, pdfUrl: true, variaveisJson: true, finalizadoEm: true, clienteId: true } }) : null;
    let origem: unknown;
    try {
      const variaveis: unknown = typeof gerado?.variaveisJson === "string" ? JSON.parse(gerado.variaveisJson) : gerado?.variaveisJson;
      origem = variaveis && typeof variaveis === "object" && "__bpmCardId" in variaveis ? variaveis.__bpmCardId : null;
    } catch { origem = null; }
    if (gerado?.status !== "FINALIZADO" || origem !== cardId || gerado.clienteId !== empresaId || !gerado.pdfUrl) return null;
    try {
      const url = new URL(gerado.pdfUrl);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com")
        || !url.pathname.startsWith("/gerador-documentos/pdfs-gerados/") || url.username || url.password || url.search || url.hash) return null;
      return { anexoId: anexo.id, nome: anexo.nome, tipo: "application/pdf", referencia: url.toString(), armazenamento: "gerado",
        revisao: JSON.stringify([anexo.id, gerado.id, url.toString(), gerado.finalizadoEm?.toISOString() ?? null]) };
    } catch { return null; }
  }
  if (typeof anexo.tipo !== "string" || !BPM_ANEXO_ALLOWED_MIME.some((tipo) => tipo === anexo.tipo)) return null;
  const privado = extrairPathnamePrivadoAnexoBpm(anexo.url);
  const legado = extrairUrlLegadaAnexoBpm(anexo.url);
  // A valid reference for another card is still not a file of this negotiation.
  if (privado && !privado.startsWith(`bpm/${cardId}/`)) return null;
  if (!privado && !legado) return null;
  if (legado) {
    const url = new URL(legado);
    if (url.username || url.password || url.search || url.hash || !url.pathname.startsWith(`/bpm/${cardId}/`)) return null;
  }
  return { anexoId: anexo.id, nome: anexo.nome, tipo: anexo.tipo, referencia: privado ?? legado!,
    armazenamento: privado ? "privado" : "legado", revisao: JSON.stringify([anexo.id, anexo.url]) };
}

/** Apenas o documento explicitamente ligado ao campo de contrato desta contratação. */
export async function carregarAcompanhamentoComercial(cardId: string, tx: Prisma.TransactionClient = db) {
  const comercial = await tx.bpmCard.findUnique({ where: { id: cardId }, select: {
    id: true, empresaId: true, empresa: { select: { razaoSocial: true, nomeFantasia: true } }, pipelineId: true, responsavelId: true, updatedAt: true, status: true, statusPosFechamento: true,
    pipeline: { select: { nome: true, chave: true } }, etapa: { select: { nome: true, chave: true } },
    vinculosOrigem: { where: { cardDestino: { pipeline: { chave: "financeiro", ativo: true }, status: { notIn: ["ARQUIVADO", "CANCELADO"] } } },
      select: { cardDestinoId: true }, take: 2 },
  } });
  if (!comercial || ["ARQUIVADO", "CANCELADO"].includes(comercial.status)
    || !(comercial.pipeline.chave === "comercial" || comercial.pipeline.nome === "Revisão de Radar")
    || !etapaEhFechado(comercial.etapa.nome, comercial.etapa.chave)) return null;
  if (comercial.vinculosOrigem.length > 1) throw new Error("Há mais de uma contratação financeira vinculada. Solicite a revisão dos vínculos.");
  const financeiroId = comercial.vinculosOrigem[0]?.cardDestinoId;
  if (!financeiroId) return null;
  const financeiro = await tx.bpmCard.findUniqueOrThrow({ where: { id: financeiroId }, select: {
    id: true, empresaId: true, pipelineId: true, responsavelId: true, updatedAt: true, status: true,
    campoValores: { where: { campo: { ativo: true, chave: { in: [C.CONTRATO_ELABORADO, C.LINK_CONTRATO, C.CONTRATO_ENVIADO, C.STATUS_ASSINATURA, C.PAGAMENTO_CONFIRMADO, C.ANEXO_ASSINADO] } } },
      select: { campoId: true, valor: true, campo: { select: { chave: true } } } },
    vinculosDestino: { select: { cardOrigemId: true }, take: 2 },
  } });
  if (financeiro.empresaId !== comercial.empresaId || ["ARQUIVADO", "CANCELADO"].includes(financeiro.status)) {
    throw new Error("O vínculo da contratação precisa ser revisado.");
  }
  // Um documento financeiro compartilhado por negociações diferentes precisa de revisão humana.
  if (financeiro.vinculosDestino.length !== 1 || financeiro.vinculosDestino[0].cardOrigemId !== cardId)
    throw new Error("O vínculo da contratação precisa ser revisado.");
  const link = financeiro.campoValores.find((v) => v.campo.chave === C.LINK_CONTRATO);
  const elaborado = financeiro.campoValores.some((v) => v.campo.chave === C.CONTRATO_ELABORADO && v.valor === "Sim");
  const documento = elaborado ? await resolverArquivoContratacao(tx, financeiro.id, financeiro.empresaId, link) : null;
  const campoAssinado = financeiro.campoValores.find((v) => v.campo.chave === C.ANEXO_ASSINADO);
  const assinado = await resolverArquivoContratacao(tx, financeiro.id, financeiro.empresaId, campoAssinado);
  const envioJaAcompanhado = financeiro.status === "CONCLUIDO" || financeiro.campoValores.some((v) =>
    ([C.CONTRATO_ENVIADO, C.PAGAMENTO_CONFIRMADO].some((chave) => chave === v.campo.chave) && v.valor === "Sim")
    || (v.campo.chave === C.STATUS_ASSINATURA && v.valor === "Assinado"));
  return { comercial, financeiro, documento, assinado, envioJaAcompanhado };
}

export async function registrarEventoAcompanhamento(tx: Prisma.TransactionClient, params: {
  cardId: string; pipelineId: string; usuarioId: number | null; acao: string; chave: string; anterior?: unknown; novo: Record<string, unknown>; ocorridoEm?: Date;
}) {
  await tx.bpmCardHistorico.create({ data: {
    cardId: params.cardId, acao: params.acao, usuarioId: params.usuarioId, ...(params.ocorridoEm ? { createdAt: params.ocorridoEm } : {}),
    valorAnteriorJson: params.anterior === undefined ? null : JSON.stringify(params.anterior), valorNovoJson: JSON.stringify(params.novo),
  } });
  await publicarEventoBpm({ tipo: "CARD_ATUALIZADO", entidadeTipo: "CARD", entidadeId: params.cardId,
    cardId: params.cardId, pipelineId: params.pipelineId, atorTipo: params.usuarioId ? "USUARIO" : "SISTEMA",
    atorUserId: params.usuarioId ?? undefined, valorAnterior: params.anterior, valorNovo: params.novo,
    correlationId: params.chave, idempotencyKey: params.chave }, tx);
}

export type RetornoContratoComercial = { cardId: string; pipelineId: string; tarefaAlertaId?: string };

function slotDocumento(cardId: string, tipo: TipoContratoComercial, arquivo: ArquivoContratacaoServidor | null): SlotContratoComercial {
  return arquivo ? { estado: "DISPONIVEL", documento: { id: `contratacao:${cardId}:${tipo}`, nome: arquivo.nome,
    tipo: arquivo.tipo, urlAcesso: `/api/bpm/cards/${encodeURIComponent(cardId)}/contrato?tipo=${tipo}`,
    origem: "CONTRATACAO", somenteLeitura: true } } : { estado: "PENDENTE", documento: null };
}

/** No writes, notifications or storage I/O while projecting a card. */
export async function resolverDocumentosContratacaoComercial(cardId: string, tx: Prisma.TransactionClient = db): Promise<DocumentosContratacaoComercial | null> {
  try {
    const contexto = await carregarAcompanhamentoComercial(cardId, tx);
    if (!contexto) {
      const card = await tx.bpmCard.findUnique({ where: { id: cardId }, select: { pipeline: { select: { nome: true, chave: true } },
        etapa: { select: { nome: true, chave: true } } } });
      if (!card || !(card.pipeline.chave === "comercial" || card.pipeline.nome === "Revisão de Radar")
        || !etapaEhFechado(card.etapa.nome, card.etapa.chave)) return null;
    }
    return { paraEnvio: slotDocumento(cardId, "para_envio", contexto?.documento ?? null), assinado: slotDocumento(cardId, "assinado", contexto?.assinado ?? null) };
  } catch {
    return { paraEnvio: slotDocumento(cardId, "para_envio", null), assinado: slotDocumento(cardId, "assinado", null) };
  }
}

/** Called only by document mutations, inside their transaction; all side effects stay post-commit. */
export async function disponibilizarContratoComercial(tx: Prisma.TransactionClient, financeiroId: string, usuarioId: number | null): Promise<RetornoContratoComercial | null> {
  const vinculos = await tx.bpmCardVinculo.findMany({ where: { cardDestinoId: financeiroId }, select: { cardOrigemId: true }, take: 2 });
  if (vinculos.length !== 1) return null;
  let contexto;
  try { contexto = await carregarAcompanhamentoComercial(vinculos[0].cardOrigemId, tx); }
  catch { return null; } // Ambiguous links cannot broaden document access or block a valid financial upload.
  if (!contexto || contexto.financeiro.id !== financeiroId) return null;
  const { comercial, documento } = contexto;
  const fingerprint = createHash("sha256").update(JSON.stringify([documento?.revisao ?? null, contexto.assinado?.revisao ?? null])).digest("hex");
  const anterior = await tx.bpmCardHistorico.findFirst({ where: { cardId: comercial.id, acao: "CONTRATACAO_DOCUMENTOS_ATUALIZADOS" },
    orderBy: { createdAt: "desc" }, select: { valorNovoJson: true } });
  let fingerprintAnterior: unknown;
  try { fingerprintAnterior = JSON.parse(anterior?.valorNovoJson ?? "{}").fingerprint; } catch { fingerprintAnterior = null; }
  if (fingerprintAnterior === fingerprint || !anterior && !documento && !contexto.assinado) return null;
  const retorno: RetornoContratoComercial = { cardId: comercial.id, pipelineId: comercial.pipelineId };
  const podePrepararEnvio = Boolean(documento && !contexto.envioJaAcompanhado
    && (!comercial.statusPosFechamento || ["AGUARDANDO_CONTRATO", "CONTRATO_A_ENVIAR"].includes(comercial.statusPosFechamento)));
  const tarefaId = idTarefaContratacao("envio", comercial.id, financeiroId);
  const tarefa = podePrepararEnvio ? await tx.bpmTarefa.findUnique({ where: { id: tarefaId }, select: { id: true, status: true } }) : null;
  const revisao = documento ? createHash("sha256").update(documento.revisao).digest("hex") : null;
  const chave = `${tarefaId}:documento:${revisao}`;
  const eventoEnvio = podePrepararEnvio && tarefa?.status !== "CONCLUIDA"
    ? await tx.bpmEventoDominio.findUnique({ where: { idempotencyKey: chave }, select: { id: true } }) : null;
  const prepararEnvio = podePrepararEnvio && tarefa?.status !== "CONCLUIDA" && !eventoEnvio;
  const agora = new Date();
  const proximaVersao = new Date(Math.max(agora.getTime(), comercial.updatedAt.getTime() + 1));
  const alteracao = await tx.bpmCard.updateMany({ where: { id: comercial.id, updatedAt: comercial.updatedAt }, data: {
    ...(prepararEnvio ? { statusPosFechamento: "CONTRATO_A_ENVIAR" } : {}),
    versao: { increment: 1 }, updatedAt: proximaVersao,
  } });
  if (alteracao.count !== 1) throw new Error("O card comercial mudou. Recarregue e tente novamente.");
  await registrarEventoAcompanhamento(tx, { cardId: comercial.id, pipelineId: comercial.pipelineId, usuarioId,
    acao: "CONTRATACAO_DOCUMENTOS_ATUALIZADOS", ocorridoEm: proximaVersao, chave: `contratacao-docs:${comercial.id}:${proximaVersao.toISOString()}:${fingerprint}`,
    novo: { fingerprint, paraEnvioDisponivel: Boolean(documento), assinadoDisponivel: Boolean(contexto.assinado) } });
  if (!prepararEnvio || !documento) return retorno;
  const responsavel = await tx.usuarios.findUnique({ where: { id: comercial.responsavelId }, select: { id: true, status: true, role: true } });
  const elegivel = Boolean(responsavel?.status === "ATIVO" && (await checarAcessoBpmCard(comercial.id, responsavel.id, responsavel.role, "visualizar", tx)).autorizado);
  const descricao = `Contrato pronto para envio — ${comercial.empresa.nomeFantasia || comercial.empresa.razaoSocial}. Documento: ${documento.nome}.`;
  if (tarefa) await tx.bpmTarefa.update({ where: { id: tarefaId }, data: { descricao,
    responsavelId: comercial.responsavelId, ...(elegivel ? { alertaEm: agora, alertaDisparadoEm: null } : { alertaEm: null, alertaDisparadoEm: null }) } });
  else await tx.bpmTarefa.create({ data: { id: tarefaId, cardId: comercial.id, titulo: "Enviar contrato", responsavelId: comercial.responsavelId,
    descricao, tipo: "TAREFA", ...(elegivel ? { alertaEm: agora } : {}) } });
  await registrarEventoAcompanhamento(tx, { cardId: comercial.id, pipelineId: comercial.pipelineId, usuarioId,
    acao: "CONTRATO_DISPONIBILIZADO", chave, anterior: { statusPosFechamento: comercial.statusPosFechamento },
    novo: { statusPosFechamento: "CONTRATO_A_ENVIAR", financeiroCardId: financeiroId, anexoId: documento.anexoId, revisao } });
  return { ...retorno, ...(elegivel ? { tarefaAlertaId: tarefaId } : {}) };
}

/** Push failures cannot undo a confirmed document; the existing alerts API/cron reconciles delivery. */
export async function notificarContratacaoComercialPosCommit(retorno: RetornoContratoComercial | null | undefined) {
  if (!retorno) return;
  await Promise.allSettled([
    Promise.resolve().then(() => notificarPipelineBpm({ cardId: retorno.cardId, pipelineId: retorno.pipelineId, tipo: "ANEXO_ALTERADO" })),
    (async () => {
      if (!retorno.tarefaAlertaId) return;
      const tarefa = await db.bpmTarefa.findUnique({ where: { id: retorno.tarefaAlertaId }, select: tarefaAlertaSelect });
      if (tarefa) await dispararAlertaTarefaBpm(tarefa, new Date());
    })(),
  ]);
}
