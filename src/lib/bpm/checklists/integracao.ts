import "server-only";

import type { Prisma } from "@prisma/client";

import db from "@/lib/prisma";
import {
  calcularResumoChecklist,
  type ContextoCardChecklist,
  type InstanciaEstadoChecklist,
  type ResumoChecklistCard,
} from "@/lib/bpm/checklists/leitura";

type ClienteIntegracaoChecklist = Pick<
  Prisma.TransactionClient,
  "bpmCard" | "bpmCardChecklist" | "bpmChecklistTemplate"
>;

export const RESUMO_CHECKLIST_VAZIO = calcularResumoChecklist([]);

async function listarTemplatesAplicaveis(card: ContextoCardChecklist, client: ClienteIntegracaoChecklist) {
  const templates: Array<{
    id: string;
    nome: string;
    itens: Array<{ id: string; nome: string; status: string; obrigatorio: boolean }>;
  }> = [];
  let cursor: string | undefined;
  do {
    const pagina = await client.bpmChecklistTemplate.findMany({
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
        itens: {
          orderBy: [{ ordem: "asc" }, { id: "asc" }],
          select: { id: true, nome: true, obrigatorio: true },
        },
      },
    });
    templates.push(...pagina.map((template) => ({
      ...template,
      itens: template.itens.map((item) => ({ ...item, status: "PENDENTE" })),
    })));
    cursor = pagina.at(-1)?.id;
    if (pagina.length < 250) break;
  } while (cursor);
  return templates;
}

/** Estado único para validações, regras e automações, sem materialização implícita. */
export async function carregarResumoChecklistAplicavelCard(
  card: ContextoCardChecklist,
  client: ClienteIntegracaoChecklist = db,
): Promise<ResumoChecklistCard> {
  const contexto = card.tipoProcesso === undefined
    ? await client.bpmCard.findUnique({
        where: { id: card.id },
        select: { id: true, pipelineId: true, etapaId: true, servico: true, tipoProcesso: true },
      })
    : card;
  if (!contexto) throw new Error("Card não encontrado");
  const [materializados, templates] = await Promise.all([
    client.bpmCardChecklist.findMany({
      where: { cardId: contexto.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        templateId: true,
        templateNome: true,
        itens: {
          orderBy: [{ ordem: "asc" }, { id: "asc" }],
          select: { id: true, nome: true, status: true, obrigatorio: true },
        },
      },
    }),
    listarTemplatesAplicaveis(contexto, client),
  ]);
  const idsMaterializados = new Set(materializados.map((item) => item.templateId));
  const virtuais: InstanciaEstadoChecklist[] = templates
    .filter((template) => !idsMaterializados.has(template.id))
    .map((template) => ({
      id: template.id,
      templateId: template.id,
      templateNome: template.nome,
      materializado: false,
      itens: template.itens,
    }));
  return calcularResumoChecklist([
    ...materializados.map((item) => ({ ...item, materializado: true })),
    ...virtuais,
  ]);
}

export async function carregarResumoChecklistAplicavelSeguro(
  card: ContextoCardChecklist,
  client: ClienteIntegracaoChecklist = db,
): Promise<ResumoChecklistCard> {
  try {
    return await carregarResumoChecklistAplicavelCard(card, client);
  } catch (error) {
    const codigo = typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined;
    console.error("[bpm/checklists] falha ao ler estado — seguindo sem bloquear", {
      tipo: error instanceof Error ? error.name : typeof error,
      ...(codigo ? { codigo } : {}),
    });
    return RESUMO_CHECKLIST_VAZIO;
  }
}

export async function obterErroChecklistParaMovimento(
  card: ContextoCardChecklist,
  client: ClienteIntegracaoChecklist = db,
): Promise<string | null> {
  const resumo = await carregarResumoChecklistAplicavelSeguro(card, client);
  if (!resumo.possuiPendenciaObrigatoria) return null;
  const templates = resumo.templatesComPendencia.map((item) => item.nome).join(", ");
  const itens = resumo.itensObrigatoriosPendentes.slice(0, 5).map((item) => item.nome);
  const complemento = resumo.itensObrigatoriosPendentes.length > itens.length ? ", …" : "";
  return `Avanço bloqueado: ${resumo.pendentesObrigatorios} ${resumo.pendentesObrigatorios === 1 ? "item obrigatório pendente" : "itens obrigatórios pendentes"} em ${templates}. Conclua: ${itens.join(", ")}${complemento}.`;
}

export async function montarFatoChecklistAutomacaoBpm(
  card: ContextoCardChecklist,
  client: ClienteIntegracaoChecklist = db,
) {
  const checklist = await carregarResumoChecklistAplicavelSeguro(card, client);
  return {
    tipo: "CHECKLIST_ESTADO" as const,
    cardId: card.id,
    checklist,
    placeholders: {
      "checklist.total": String(checklist.total),
      "checklist.concluidos": String(checklist.concluidos),
      "checklist.percentual": String(checklist.percentual),
      "checklist.concluido": String(checklist.concluido),
      "checklist.pendentesObrigatorios": String(checklist.pendentesObrigatorios),
      "checklist.possuiPendenciaObrigatoria": String(checklist.possuiPendenciaObrigatoria),
    },
  };
}
