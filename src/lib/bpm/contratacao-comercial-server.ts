import "server-only";

import { idTarefaUnicaPorTipo } from "@/lib/bpm/automacoes/idempotencia-tarefa";
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { CHAVES_CAMPOS as C } from "@/lib/bpm/financeiro-config.client";
import { etapaEhFechado } from "@/lib/bpm/status-pos-fechamento";
import { extrairPathnamePrivadoAnexoBpm, extrairUrlLegadaAnexoBpm } from "@/lib/bpm/anexos-storage";
import { checarAcessoBpmCard } from "@/lib/bpm/ownership";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";
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

/** Apenas o documento explicitamente ligado ao campo de contrato desta contratação. */
export async function carregarAcompanhamentoComercial(cardId: string, tx: Prisma.TransactionClient = db) {
  const comercial = await tx.bpmCard.findUnique({ where: { id: cardId }, select: {
    id: true, pipelineId: true, responsavelId: true, updatedAt: true, status: true, statusPosFechamento: true,
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
    id: true, pipelineId: true, responsavelId: true, updatedAt: true, status: true,
    campoValores: { where: { campo: { ativo: true, chave: { in: [C.CONTRATO_ELABORADO, C.LINK_CONTRATO, C.CONTRATO_ENVIADO, C.STATUS_ASSINATURA, C.PAGAMENTO_CONFIRMADO] } } },
      select: { campoId: true, valor: true, campo: { select: { chave: true } } } },
    vinculosDestino: { select: { cardOrigemId: true }, take: 2 },
  } });
  // Um documento financeiro compartilhado por negociações diferentes precisa de revisão humana.
  if (financeiro.vinculosDestino.length !== 1 || financeiro.vinculosDestino[0].cardOrigemId !== cardId)
    throw new Error("O vínculo da contratação precisa ser revisado.");
  const link = financeiro.campoValores.find((v) => v.campo.chave === C.LINK_CONTRATO);
  const elaborado = financeiro.campoValores.some((v) => v.campo.chave === C.CONTRATO_ELABORADO && v.valor === "Sim");
  const anexo = elaborado && link?.valor ? await tx.bpmCardAnexo.findFirst({
    where: { id: link.valor, cardId: financeiro.id, campoId: link.campoId }, select: { id: true, nome: true, tipo: true, url: true },
  }) : null;
  let documento: { anexoId: string; nome: string; referencia: string; armazenamento: "privado" | "legado" | "gerado" } | null = null;
  if (anexo?.tipo === "application/x-painel-alpha-documento") {
    const id = /^\/PainelAlpha\/GeradorDocumentos\/conferencia\/([0-9a-f-]{36})$/.exec(anexo.url)?.[1];
    const gerado = id ? await tx.documentoGerado.findUnique({ where: { tokenAcesso: id }, select: { status: true, pdfUrl: true, variaveisJson: true } }) : null;
    let origem: unknown;
    try {
      const variaveis = typeof gerado?.variaveisJson === "string" ? JSON.parse(gerado.variaveisJson) : gerado?.variaveisJson;
      origem = variaveis && typeof variaveis === "object" && !Array.isArray(variaveis) ? variaveis.__bpmCardId : null;
    } catch { origem = null; }
    if (gerado?.status === "FINALIZADO" && gerado.pdfUrl && origem === financeiro.id) {
      let url: URL | null = null;
      try { url = new URL(gerado.pdfUrl); } catch { /* Documento legado inválido não fica disponível. */ }
      if (url && url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com")
        && url.pathname.startsWith("/gerador-documentos/pdfs-gerados/") && !url.username && !url.password) {
        documento = { anexoId: anexo.id, nome: anexo.nome, referencia: url.toString(), armazenamento: "gerado" };
      }
    }
  } else if (anexo?.tipo === "application/pdf") {
    const privado = extrairPathnamePrivadoAnexoBpm(anexo.url);
    const legado = extrairUrlLegadaAnexoBpm(anexo.url);
    if (privado || legado) documento = { anexoId: anexo.id, nome: anexo.nome, referencia: privado ?? legado!, armazenamento: privado ? "privado" : "legado" };
  }
  const envioJaAcompanhado = financeiro.status === "CONCLUIDO" || financeiro.campoValores.some((v) =>
    ([C.CONTRATO_ENVIADO, C.PAGAMENTO_CONFIRMADO].some((chave) => chave === v.campo.chave) && v.valor === "Sim")
    || (v.campo.chave === C.STATUS_ASSINATURA && v.valor === "Assinado"));
  return { comercial, financeiro, documento, envioJaAcompanhado };
}

export async function registrarEventoAcompanhamento(tx: Prisma.TransactionClient, params: {
  cardId: string; pipelineId: string; usuarioId: number | null; acao: string; chave: string; anterior?: unknown; novo: Record<string, unknown>;
}) {
  await tx.bpmCardHistorico.create({ data: {
    cardId: params.cardId, acao: params.acao, usuarioId: params.usuarioId,
    valorAnteriorJson: params.anterior === undefined ? null : JSON.stringify(params.anterior), valorNovoJson: JSON.stringify(params.novo),
  } });
  await publicarEventoBpm({ tipo: "CARD_ATUALIZADO", entidadeTipo: "CARD", entidadeId: params.cardId,
    cardId: params.cardId, pipelineId: params.pipelineId, atorTipo: params.usuarioId ? "USUARIO" : "SISTEMA",
    atorUserId: params.usuarioId ?? undefined, valorAnterior: params.anterior, valorNovo: params.novo,
    correlationId: params.chave, idempotencyKey: params.chave }, tx);
}

/** Chamado dentro da transação financeira; leituras nunca materializam tarefas/estados. */
export async function disponibilizarContratoComercial(tx: Prisma.TransactionClient, financeiroId: string, usuarioId: number | null) {
  const vinculos = await tx.bpmCardVinculo.findMany({ where: { cardDestinoId: financeiroId }, select: { cardOrigemId: true }, take: 2 });
  if (vinculos.length !== 1) return null;
  const contexto = await carregarAcompanhamentoComercial(vinculos[0].cardOrigemId, tx);
  if (!contexto?.documento || contexto.financeiro.id !== financeiroId || contexto.envioJaAcompanhado) return null;
  const { comercial, documento } = contexto;
  // Não voltar para envio se já há envio, assinatura ou confirmação posterior.
  if (comercial.statusPosFechamento && !["AGUARDANDO_CONTRATO", "CONTRATO_A_ENVIAR"].includes(comercial.statusPosFechamento)) return null;
  const tarefaId = idTarefaContratacao("envio", comercial.id, financeiroId);
  if (await tx.bpmTarefa.findUnique({ where: { id: tarefaId }, select: { id: true } })) return null;
  const alteracao = await tx.bpmCard.updateMany({ where: { id: comercial.id, updatedAt: comercial.updatedAt }, data: {
    statusPosFechamento: "CONTRATO_A_ENVIAR", versao: { increment: 1 }, updatedAt: new Date(Math.max(Date.now(), comercial.updatedAt.getTime() + 1)),
  } });
  if (alteracao.count !== 1) throw new Error("O card comercial mudou. Recarregue e tente novamente.");
  await tx.bpmTarefa.create({ data: { id: tarefaId, cardId: comercial.id, titulo: "Enviar contrato", responsavelId: comercial.responsavelId,
    descricao: "Contrato elaborado e disponível no acompanhamento da contratação.", tipo: "TAREFA" } });
  await registrarEventoAcompanhamento(tx, { cardId: comercial.id, pipelineId: comercial.pipelineId, usuarioId,
    acao: "CONTRATO_DISPONIBILIZADO", chave: tarefaId, anterior: { statusPosFechamento: comercial.statusPosFechamento },
    novo: { statusPosFechamento: "CONTRATO_A_ENVIAR", financeiroCardId: financeiroId, anexoId: documento.anexoId } });
  return { cardId: comercial.id, pipelineId: comercial.pipelineId };
}
