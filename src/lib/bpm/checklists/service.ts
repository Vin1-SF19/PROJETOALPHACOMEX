import "server-only";

import type { Prisma } from "@prisma/client";

import db from "@/lib/prisma";
import { calcularResumoChecklist } from "@/lib/bpm/checklists/leitura";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

function erroUnicidade(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

const selectChecklistCard = {
  id: true,
  cardId: true,
  templateId: true,
  templateNome: true,
  templateDescricao: true,
  status: true,
  concluidoEm: true,
  createdAt: true,
  updatedAt: true,
  itens: {
    orderBy: [{ ordem: "asc" }, { id: "asc" }],
    select: {
      id: true,
      templateItemId: true,
      nome: true,
      descricao: true,
      obrigatorio: true,
      ordem: true,
      exclusivoCard: true,
      status: true,
      observacao: true,
      responsavelId: true,
      concluidoEm: true,
      updatedAt: true,
      responsavel: { select: { id: true, nome: true } },
    },
  },
} satisfies Prisma.BpmCardChecklistSelect;

export async function listarChecklistsMaterializadosCard(cardId: string) {
  return db.bpmCardChecklist.findMany({
    where: { cardId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: selectChecklistCard,
  });
}

export async function materializarChecklistsAplicaveisCard(params: {
  cardId: string;
  usuarioId?: number;
  automacaoOrigem?: string;
}) {
  const card = await db.bpmCard.findUnique({
    where: { id: params.cardId },
    select: { id: true, pipelineId: true, etapaId: true, servico: true, tipoProcesso: true },
  });
  if (!card) throw new Error("Card não encontrado");

  const templates: Array<{
    id: string;
    nome: string;
    descricao: string | null;
    itens: Array<{ id: string; nome: string; descricao: string | null; obrigatorio: boolean; ordem: number }>;
  }> = [];
  let cursor: string | undefined;
  do {
    const pagina = await db.bpmChecklistTemplate.findMany({
      where: {
        ativo: true,
        AND: [
          { OR: [{ pipelineId: null }, { pipelineId: card.pipelineId }] },
          { OR: [{ etapaId: null }, { etapaId: card.etapaId }] },
          { OR: [{ servico: null }, { servico: card.servico }] },
          { OR: [{ tipoProcesso: null }, { tipoProcesso: card.tipoProcesso }] },
          { OR: [{ cardId: null }, { cardId: card.id }] },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 250,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        nome: true,
        descricao: true,
        itens: {
          orderBy: [{ ordem: "asc" }, { id: "asc" }],
          select: { id: true, nome: true, descricao: true, obrigatorio: true, ordem: true },
        },
      },
    });
    templates.push(...pagina);
    cursor = pagina.at(-1)?.id;
    if (pagina.length < 250) break;
  } while (cursor);

  const existentes = await db.bpmCardChecklist.findMany({
    where: { cardId: card.id, templateId: { in: templates.map((template) => template.id) } },
    select: { templateId: true },
  });
  const idsExistentes = new Set(existentes.map((item) => item.templateId));
  const criados: string[] = [];

  for (const template of templates) {
    if (idsExistentes.has(template.id)) continue;
    try {
      const instanciaId = await db.$transaction(async (tx) => {
        const instancia = await tx.bpmCardChecklist.create({
          data: {
            cardId: card.id,
            templateId: template.id,
            templateNome: template.nome,
            templateDescricao: template.descricao,
            itens: {
              create: template.itens.map((item) => ({
                templateItemId: item.id,
                nome: item.nome,
                descricao: item.descricao,
                obrigatorio: item.obrigatorio,
                ordem: item.ordem,
                exclusivoCard: false,
              })),
            },
          },
          select: { id: true },
        });
        await registrarHistoricoCard({
          cardId: card.id,
          acao: "CHECKLIST_MATERIALIZADO",
          usuarioId: params.usuarioId,
          automacaoOrigem: params.automacaoOrigem,
          valorNovoJson: JSON.stringify({ checklistId: instancia.id, templateId: template.id, templateNome: template.nome }),
        }, tx);
        return instancia.id;
      });
      criados.push(instanciaId);
    } catch (error) {
      if (!erroUnicidade(error)) throw error;
    }
  }

  if (criados.length > 0) {
    await notificarPipelineBpm({ pipelineId: card.pipelineId, cardId: card.id, tipo: "TAREFA_ALTERADA" });
  }
  return { criados, checklists: await listarChecklistsMaterializadosCard(card.id) };
}

export async function carregarResumoChecklistCard(
  cardId: string,
  client: Pick<typeof db, "bpmCardChecklist"> = db,
) {
  const instancias = await client.bpmCardChecklist.findMany({
    where: { cardId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      templateId: true,
      templateNome: true,
      itens: { select: { id: true, nome: true, status: true, obrigatorio: true } },
    },
  });
  return calcularResumoChecklist(instancias);
}
