"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard, exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  adicionarItemExclusivoChecklistSchema,
  alternarTemplateChecklistSchema,
  atualizarItemChecklistCardSchema,
  atualizarItemTemplateChecklistSchema,
  atualizarTemplateChecklistSchema,
  cardChecklistSchema,
  criarItemTemplateChecklistSchema,
  criarTemplateChecklistSchema,
  removerItemTemplateChecklistSchema,
  reordenarItensTemplateChecklistSchema,
  salvarTemplateChecklistSchema,
} from "@/lib/bpm/checklists/schemas";
import {
  materializarChecklistsAplicaveisCard,
} from "@/lib/bpm/checklists/service";
import { carregarResumoChecklistAplicavelCard } from "@/lib/bpm/checklists/integracao";

const ROTA_ADMIN = "/PainelAlpha/AlphaCRM/admin/checklists";
const ROTA_CRM = "/PainelAlpha/AlphaCRM";

async function exigirAdminChecklist() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = Number(session.user.id);
  await exigirAcessoConfigPipeline(userId, "configurarChecklists");
  return { userId, role: session.user.role ?? null };
}

async function exigirUsuarioCard(cardId: string, acao: "visualizar" | "editarCard") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = Number(session.user.id);
  await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, acao);
  return { userId, role: session.user.role ?? null };
}

function erroPublico(error: unknown): string {
  if (error instanceof z.ZodError) return "Dados inválidos";
  if (error instanceof Error && [
    "Não autorizado",
    "Não autorizado — apenas administradores configuram pipelines",
    "Template não encontrado",
    "Item não encontrado",
    "Card não encontrado",
    "Checklist não encontrado",
    "Pipeline inválido",
    "Etapa inválida para o pipeline",
    "Card específico incompatível com os vínculos informados",
    "Responsável não é membro válido do card",
    "A lista de ordenação não corresponde aos itens do template",
    "CONFLITO_CHECKLIST_ITEM",
  ].includes(error.message)) return error.message;
  const codigo = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
  console.error("[ChecklistsBpm] Falha inesperada", {
    tipo: error instanceof Error ? error.name : typeof error,
    ...(codigo ? { codigo } : {}),
  });
  return "Não foi possível concluir a operação de checklist";
}

function nuloSeVazio(valor: string | null | undefined) {
  return valor ? valor : null;
}

async function validarEscopoTemplate(dados: {
  pipelineId?: string | null;
  etapaId?: string | null;
  servico?: string | null;
  tipoProcesso?: string | null;
  cardId?: string | null;
}, client: Pick<Prisma.TransactionClient, "bpmPipeline" | "bpmEtapa" | "bpmCard"> = db) {
  if (dados.etapaId && !dados.pipelineId) throw new Error("Etapa inválida para o pipeline");
  const [pipeline, etapa, card] = await Promise.all([
    dados.pipelineId ? client.bpmPipeline.findUnique({ where: { id: dados.pipelineId }, select: { id: true } }) : null,
    dados.etapaId ? client.bpmEtapa.findUnique({ where: { id: dados.etapaId }, select: { id: true, pipelineId: true } }) : null,
    dados.cardId ? client.bpmCard.findUnique({ where: { id: dados.cardId }, select: { id: true, pipelineId: true, etapaId: true, servico: true, tipoProcesso: true } }) : null,
  ]);
  if (dados.pipelineId && !pipeline) throw new Error("Pipeline inválido");
  if (dados.etapaId && (!etapa || etapa.pipelineId !== dados.pipelineId)) throw new Error("Etapa inválida para o pipeline");
  if (dados.cardId && !card) throw new Error("Card não encontrado");
  if (card && ((dados.pipelineId && dados.pipelineId !== card.pipelineId)
    || (dados.etapaId && dados.etapaId !== card.etapaId)
    || (dados.servico && dados.servico !== card.servico)
    || (dados.tipoProcesso && dados.tipoProcesso !== card.tipoProcesso))) {
    throw new Error("Card específico incompatível com os vínculos informados");
  }
}

export async function ListarTemplatesChecklistBpm() {
  try {
    await exigirAdminChecklist();
    const templates = await db.bpmChecklistTemplate.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 250,
      select: {
        id: true, nome: true, descricao: true, ativo: true,
        pipelineId: true, etapaId: true, servico: true, tipoProcesso: true, cardId: true,
        createdAt: true, updatedAt: true,
        pipeline: { select: { id: true, nome: true } },
        etapa: { select: { id: true, nome: true } },
        card: { select: { id: true, empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } } } },
        itens: { orderBy: [{ ordem: "asc" }, { id: "asc" }], select: { id: true, nome: true, descricao: true, obrigatorio: true, ordem: true } },
        _count: { select: { instancias: true } },
      },
    });
    return { success: true as const, data: templates };
  } catch (error) {
    return { success: false as const, error: erroPublico(error), data: [] };
  }
}

/** Dados do builder administrativo em uma única leitura autenticada. */
export async function ListarWorkspaceChecklistsBpm() {
  try {
    await exigirAdminChecklist();
    const [templates, pipelines, servicos, cards] = await Promise.all([
      db.bpmChecklistTemplate.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 250,
        select: {
          id: true, nome: true, descricao: true, ativo: true,
          pipelineId: true, etapaId: true, servico: true, tipoProcesso: true, cardId: true,
          createdAt: true, updatedAt: true,
          pipeline: { select: { id: true, nome: true } },
          etapa: { select: { id: true, nome: true } },
          card: { select: { id: true, empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } } } },
          itens: { orderBy: [{ ordem: "asc" }, { id: "asc" }], select: { id: true, nome: true, descricao: true, obrigatorio: true, ordem: true } },
          _count: { select: { instancias: true } },
        },
      }),
      db.bpmPipeline.findMany({
        where: { ativo: true },
        orderBy: [{ ordem: "asc" }, { nome: "asc" }],
        select: {
          id: true,
          nome: true,
          etapas: { where: { ativo: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: { id: true, nome: true } },
        },
      }),
      db.servicosComerciais.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { nome: true } }),
      db.bpmCard.findMany({
        where: { status: "ATIVO" },
        orderBy: { updatedAt: "desc" },
        take: 250,
        select: {
          id: true, pipelineId: true, etapaId: true, servico: true, tipoProcesso: true,
          empresa: { select: { razaoSocial: true, nomeFantasia: true } },
        },
      }),
    ]);
    return {
      success: true as const,
      data: { templates, pipelines, servicos: servicos.map((item) => item.nome), cards },
    };
  } catch (error) {
    return {
      success: false as const,
      error: erroPublico(error),
      data: { templates: [], pipelines: [], servicos: [], cards: [] },
    };
  }
}

export async function CriarTemplateChecklistBpm(payload: unknown) {
  try {
    const { userId } = await exigirAdminChecklist();
    const dados = criarTemplateChecklistSchema.parse(payload);
    await validarEscopoTemplate(dados);
    const template = await db.bpmChecklistTemplate.create({
      data: {
        nome: dados.nome,
        descricao: nuloSeVazio(dados.descricao),
        ativo: dados.ativo,
        pipelineId: dados.pipelineId ?? null,
        etapaId: dados.etapaId ?? null,
        servico: nuloSeVazio(dados.servico),
        tipoProcesso: nuloSeVazio(dados.tipoProcesso),
        cardId: dados.cardId ?? null,
        criadoPorId: userId,
        itens: { create: dados.itens.map((item) => ({ ...item, descricao: nuloSeVazio(item.descricao) })) },
      },
      select: { id: true },
    });
    revalidatePath(ROTA_ADMIN);
    return { success: true as const, data: template };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function AtualizarTemplateChecklistBpm(payload: unknown) {
  try {
    await exigirAdminChecklist();
    const dados = atualizarTemplateChecklistSchema.parse(payload);
    await validarEscopoTemplate(dados);
    const existente = await db.bpmChecklistTemplate.findUnique({ where: { id: dados.id }, select: { id: true } });
    if (!existente) throw new Error("Template não encontrado");
    await db.bpmChecklistTemplate.update({
      where: { id: dados.id },
      data: {
        nome: dados.nome, descricao: nuloSeVazio(dados.descricao), ativo: dados.ativo,
        pipelineId: dados.pipelineId ?? null, etapaId: dados.etapaId ?? null,
        servico: nuloSeVazio(dados.servico), tipoProcesso: nuloSeVazio(dados.tipoProcesso), cardId: dados.cardId ?? null,
      },
      select: { id: true },
    });
    revalidatePath(ROTA_ADMIN);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

/** Salva metadados e reconcilia todos os itens do editor em uma única transação. */
export async function SalvarTemplateChecklistBpm(payload: unknown) {
  try {
    await exigirAdminChecklist();
    const dados = salvarTemplateChecklistSchema.parse(payload);
    await db.$transaction(async (tx) => {
      await validarEscopoTemplate(dados, tx);
      const existente = await tx.bpmChecklistTemplate.findUnique({
        where: { id: dados.id },
        select: { id: true, itens: { select: { id: true } } },
      });
      if (!existente) throw new Error("Template não encontrado");
      const idsExistentes = new Set(existente.itens.map((item) => item.id));
      const idsRecebidos = dados.itens.flatMap((item) => item.id ? [item.id] : []);
      if (idsRecebidos.some((id) => !idsExistentes.has(id))) throw new Error("Item não encontrado");

      await tx.bpmChecklistTemplate.update({
        where: { id: dados.id },
        data: {
          nome: dados.nome,
          descricao: nuloSeVazio(dados.descricao),
          ativo: dados.ativo,
          pipelineId: dados.pipelineId ?? null,
          etapaId: dados.etapaId ?? null,
          servico: nuloSeVazio(dados.servico),
          tipoProcesso: nuloSeVazio(dados.tipoProcesso),
          cardId: dados.cardId ?? null,
        },
        select: { id: true },
      });
      await tx.bpmChecklistTemplateItem.deleteMany({
        where: { templateId: dados.id, ...(idsRecebidos.length > 0 ? { id: { notIn: idsRecebidos } } : {}) },
      });
      for (const [ordem, item] of dados.itens.entries()) {
        const data = {
          nome: item.nome,
          descricao: nuloSeVazio(item.descricao),
          obrigatorio: item.obrigatorio,
          ordem,
        };
        if (item.id) {
          await tx.bpmChecklistTemplateItem.update({ where: { id: item.id }, data, select: { id: true } });
        } else {
          await tx.bpmChecklistTemplateItem.create({ data: { ...data, templateId: dados.id }, select: { id: true } });
        }
      }
    });
    revalidatePath(ROTA_ADMIN);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function AlternarTemplateChecklistBpm(payload: unknown) {
  try {
    await exigirAdminChecklist();
    const dados = alternarTemplateChecklistSchema.parse(payload);
    const existente = await db.bpmChecklistTemplate.findUnique({ where: { id: dados.id }, select: { id: true } });
    if (!existente) throw new Error("Template não encontrado");
    await db.bpmChecklistTemplate.update({ where: { id: dados.id }, data: { ativo: dados.ativo }, select: { id: true } });
    revalidatePath(ROTA_ADMIN);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function CriarItemTemplateChecklistBpm(payload: unknown) {
  try {
    await exigirAdminChecklist();
    const dados = criarItemTemplateChecklistSchema.parse(payload);
    const template = await db.bpmChecklistTemplate.findUnique({ where: { id: dados.templateId }, select: { id: true } });
    if (!template) throw new Error("Template não encontrado");
    const item = await db.bpmChecklistTemplateItem.create({ data: { ...dados, descricao: nuloSeVazio(dados.descricao) }, select: { id: true } });
    revalidatePath(ROTA_ADMIN);
    return { success: true as const, data: item };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function AtualizarItemTemplateChecklistBpm(payload: unknown) {
  try {
    await exigirAdminChecklist();
    const dados = atualizarItemTemplateChecklistSchema.parse(payload);
    const existente = await db.bpmChecklistTemplateItem.findUnique({ where: { id: dados.id }, select: { id: true } });
    if (!existente) throw new Error("Item não encontrado");
    const { id, ...alteracoes } = dados;
    await db.bpmChecklistTemplateItem.update({ where: { id }, data: { ...alteracoes, descricao: nuloSeVazio(alteracoes.descricao) }, select: { id: true } });
    revalidatePath(ROTA_ADMIN);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function RemoverItemTemplateChecklistBpm(payload: unknown) {
  try {
    await exigirAdminChecklist();
    const dados = removerItemTemplateChecklistSchema.parse(payload);
    const existente = await db.bpmChecklistTemplateItem.findUnique({ where: { id: dados.id }, select: { id: true } });
    if (!existente) throw new Error("Item não encontrado");
    await db.bpmChecklistTemplateItem.delete({ where: { id: dados.id } });
    revalidatePath(ROTA_ADMIN);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function ReordenarItensTemplateChecklistBpm(payload: unknown) {
  try {
    await exigirAdminChecklist();
    const dados = reordenarItensTemplateChecklistSchema.parse(payload);
    const itens = await db.bpmChecklistTemplateItem.findMany({ where: { templateId: dados.templateId }, select: { id: true } });
    const existentes = new Set(itens.map((item) => item.id));
    if (itens.length !== dados.itemIds.length || dados.itemIds.some((id) => !existentes.has(id))) {
      throw new Error("A lista de ordenação não corresponde aos itens do template");
    }
    await db.$transaction(dados.itemIds.map((id, ordem) => db.bpmChecklistTemplateItem.update({ where: { id }, data: { ordem }, select: { id: true } })));
    revalidatePath(ROTA_ADMIN);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function ListarChecklistsCardBpm(payload: unknown) {
  try {
    const dados = cardChecklistSchema.parse(payload);
    const { userId } = await exigirUsuarioCard(dados.cardId, "visualizar");
    const resultado = await materializarChecklistsAplicaveisCard({ cardId: dados.cardId, usuarioId: userId });
    return { success: true as const, data: resultado.checklists, materializados: resultado.criados.length };
  } catch (error) {
    return { success: false as const, error: erroPublico(error), data: [] };
  }
}

export async function ObterResumoChecklistCardBpm(payload: unknown) {
  try {
    const dados = cardChecklistSchema.parse(payload);
    await exigirUsuarioCard(dados.cardId, "visualizar");
    const card = await db.bpmCard.findUnique({
      where: { id: dados.cardId },
      select: { id: true, pipelineId: true, etapaId: true, servico: true, tipoProcesso: true },
    });
    if (!card) throw new Error("Card não encontrado");
    return {
      success: true as const,
      data: await carregarResumoChecklistAplicavelCard(card),
    };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function AdicionarItemExclusivoChecklistCardBpm(payload: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Não autorizado");
    const userId = Number(session.user.id);
    const role = session.user.role ?? null;
    const dados = adicionarItemExclusivoChecklistSchema.parse(payload);
    const checklist = await db.bpmCardChecklist.findUnique({
      where: { id: dados.cardChecklistId },
      select: { id: true, cardId: true, card: { select: { pipelineId: true } } },
    });
    if (!checklist) throw new Error("Checklist não encontrado");
    await exigirAcessoBpmCard(checklist.cardId, userId, role, "editarCard");
    const item = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(checklist.cardId, userId, role, "editarCard", tx);
      const ultimo = await tx.bpmCardChecklistItem.findFirst({
        where: { cardChecklistId: checklist.id }, orderBy: [{ ordem: "desc" }, { id: "desc" }], select: { ordem: true },
      });
      const criado = await tx.bpmCardChecklistItem.create({
        data: {
          cardChecklistId: checklist.id, nome: dados.nome, descricao: nuloSeVazio(dados.descricao),
          obrigatorio: dados.obrigatorio, ordem: (ultimo?.ordem ?? -1) + 1, exclusivoCard: true,
        },
        select: { id: true, nome: true, descricao: true, obrigatorio: true, ordem: true, exclusivoCard: true, status: true },
      });
      await tx.bpmCardChecklist.update({ where: { id: checklist.id }, data: { status: "PENDENTE", concluidoEm: null }, select: { id: true } });
      await registrarHistoricoCard({
        cardId: checklist.cardId, acao: "CHECKLIST_ITEM_EXCLUSIVO_ADICIONADO", usuarioId: userId,
        valorNovoJson: JSON.stringify({ checklistId: checklist.id, itemId: criado.id, nome: criado.nome }),
      }, tx);
      return criado;
    });
    revalidatePath(ROTA_CRM);
    await notificarPipelineBpm({ pipelineId: checklist.card.pipelineId, cardId: checklist.cardId, tipo: "TAREFA_ALTERADA" });
    return { success: true as const, data: item };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function AtualizarItemChecklistCardBpm(payload: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Não autorizado");
    const userId = Number(session.user.id);
    const role = session.user.role ?? null;
    const dados = atualizarItemChecklistCardSchema.parse(payload);
    const existente = await db.bpmCardChecklistItem.findUnique({
      where: { id: dados.itemId },
      select: {
        id: true, status: true, observacao: true, responsavelId: true, updatedAt: true,
        cardChecklist: { select: { id: true, cardId: true, card: { select: { pipelineId: true, responsavelId: true } } } },
      },
    });
    if (!existente) throw new Error("Item não encontrado");
    await exigirAcessoBpmCard(existente.cardChecklist.cardId, userId, role, "editarCard");
    const atualizado = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(existente.cardChecklist.cardId, userId, role, "editarCard", tx);
      if (dados.responsavelId !== undefined && dados.responsavelId !== null
        && dados.responsavelId !== existente.cardChecklist.card.responsavelId) {
        const membro = await tx.bpmCardMembro.findUnique({
          where: { cardId_userId: { cardId: existente.cardChecklist.cardId, userId: dados.responsavelId } }, select: { id: true },
        });
        if (!membro) throw new Error("Responsável não é membro válido do card");
      }
      const proximoStatus = dados.status ?? existente.status;
      const proximaObservacao = dados.observacao !== undefined ? nuloSeVazio(dados.observacao) : existente.observacao;
      const proximoResponsavelId = dados.responsavelId !== undefined ? dados.responsavelId : existente.responsavelId;
      const alterou = proximoStatus !== existente.status
        || proximaObservacao !== existente.observacao
        || proximoResponsavelId !== existente.responsavelId;
      if (!alterou) return { item: existente, sinalEmitido: false };
      const gravacao = await tx.bpmCardChecklistItem.updateMany({
        where: { id: dados.itemId, updatedAt: existente.updatedAt },
        data: {
          ...(dados.status !== undefined ? { status: dados.status, concluidoEm: dados.status === "CONCLUIDO" ? new Date() : null } : {}),
          ...(dados.observacao !== undefined ? { observacao: nuloSeVazio(dados.observacao) } : {}),
          ...(dados.responsavelId !== undefined ? { responsavelId: dados.responsavelId } : {}),
        },
      });
      if (gravacao.count !== 1) throw new Error("CONFLITO_CHECKLIST_ITEM");
      const item = await tx.bpmCardChecklistItem.findUnique({
        where: { id: dados.itemId },
        select: { id: true, status: true, observacao: true, responsavelId: true, concluidoEm: true, updatedAt: true },
      });
      if (!item) throw new Error("Item não encontrado");
      const estados = await tx.bpmCardChecklistItem.findMany({
        where: { cardChecklistId: existente.cardChecklist.id }, select: { status: true },
      });
      const concluido = estados.length > 0 && estados.every((estado) => estado.status === "CONCLUIDO");
      await tx.bpmCardChecklist.update({
        where: { id: existente.cardChecklist.id },
        data: { status: concluido ? "CONCLUIDO" : "PENDENTE", concluidoEm: concluido ? new Date() : null },
        select: { id: true },
      });
      await registrarHistoricoCard({
        cardId: existente.cardChecklist.cardId,
        acao: proximoStatus !== existente.status ? "CHECKLIST_STATUS_ALTERADO" : "CHECKLIST_ITEM_ATUALIZADO",
        usuarioId: userId,
        valorAnteriorJson: JSON.stringify({ itemId: existente.id, status: existente.status, responsavelId: existente.responsavelId }),
        valorNovoJson: JSON.stringify({
          itemId: item.id,
          status: item.status,
          responsavelId: item.responsavelId,
          observacaoAlterada: proximaObservacao !== existente.observacao,
          eventoChave: `CHECKLIST:${item.id}:${item.updatedAt.toISOString()}`,
        }),
      }, tx);
      return { item, sinalEmitido: true };
    });
    revalidatePath(ROTA_CRM);
    if (atualizado.sinalEmitido) {
      await notificarPipelineBpm({ pipelineId: existente.cardChecklist.card.pipelineId, cardId: existente.cardChecklist.cardId, tipo: "TAREFA_ALTERADA" });
    }
    return { success: true as const, data: atualizado.item };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}
