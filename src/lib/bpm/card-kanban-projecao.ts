import type { CardKanbanValorCampo } from "@/components/bpm/kanban/CardKanbanRenderer";
import { calcularResumoChecklist, templateChecklistCompativel } from "@/lib/bpm/checklists/leitura";
import { campoBpmPossuiFonteMestre } from "@/lib/bpm/valor-efetivo-campo";

type CardResumo = { id: string; etapaId: string };
type ChecklistResumo = {
  cardId: string;
  templateId: string;
  itens: readonly { status: string; obrigatorio: boolean }[];
};
type TemplateResumo = {
  id: string;
  nome: string;
  pipelineId: string | null;
  etapaId: string | null;
  cardId: string | null;
  etapas: readonly { etapaId: string }[];
  itens: readonly { obrigatorio: boolean }[];
};
type CadenciaResumo = { cardId: string; status: string; proximaExecucaoEm: Date | null };
type CampoObrigatorio = {
  etapaId: string;
  condicaoVisibilidadeJson: string | null;
  condicaoObrigatoriedadeJson: string | null;
  campo: {
    id: string; nome: string; pipelineId: string | null; escopo: string;
    fonteEntidade: string | null; valorPadrao: string | null;
    pipelinesAssociados: readonly { pipelineId: string }[];
  };
};
type ValorCampo = { cardId: string; campoId: string; valor: string | null };

export type ResumoKanbanOperacional = {
  checklist: CardKanbanValorCampo;
  cadencia: CardKanbanValorCampo;
  pendencias: CardKanbanValorCampo;
};

/** Resume somente fontes canônicas já persistidas; não materializa nem altera dados. */
export function projetarResumosKanbanOperacionais(input: {
  cards: readonly CardResumo[];
  pipelineId: string;
  checklists: readonly ChecklistResumo[];
  templates: readonly TemplateResumo[];
  cadencias: readonly CadenciaResumo[];
  camposObrigatorios: readonly CampoObrigatorio[];
  valoresCampos: readonly ValorCampo[];
}): Map<string, ResumoKanbanOperacional> {
  const checklistsPorCard = new Map<string, ChecklistResumo[]>();
  for (const checklist of input.checklists) {
    const lista = checklistsPorCard.get(checklist.cardId) ?? [];
    lista.push(checklist);
    checklistsPorCard.set(checklist.cardId, lista);
  }
  const cadenciaPorCard = new Map<string, Date>();
  for (const cadencia of input.cadencias) {
    if (cadencia.status !== "ATIVA" || !cadencia.proximaExecucaoEm) continue;
    const anterior = cadenciaPorCard.get(cadencia.cardId);
    if (!anterior || cadencia.proximaExecucaoEm < anterior) {
      cadenciaPorCard.set(cadencia.cardId, cadencia.proximaExecucaoEm);
    }
  }
  const obrigatoriosPorEtapa = new Map<string, CampoObrigatorio[]>();
  for (const config of input.camposObrigatorios) {
    if (config.campo.pipelineId !== input.pipelineId
      && !config.campo.pipelinesAssociados.some((item) => item.pipelineId === input.pipelineId)) continue;
    const lista = obrigatoriosPorEtapa.get(config.etapaId) ?? [];
    lista.push(config);
    obrigatoriosPorEtapa.set(config.etapaId, lista);
  }
  const valoresPorCard = new Map<string, Map<string, string | null>>();
  for (const valor of input.valoresCampos) {
    const mapa = valoresPorCard.get(valor.cardId) ?? new Map<string, string | null>();
    mapa.set(valor.campoId, valor.valor);
    valoresPorCard.set(valor.cardId, mapa);
  }

  const formatoCadencia = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const resultado = new Map<string, ResumoKanbanOperacional>();
  for (const card of input.cards) {
    const checklists = checklistsPorCard.get(card.id) ?? [];
    const idsMaterializados = new Set(checklists.map((checklist) => checklist.templateId));
    const virtuais = input.templates.filter((template) =>
      !idsMaterializados.has(template.id) && templateChecklistCompativel({
        pipelineId: template.pipelineId, etapaId: template.etapaId, cardId: template.cardId,
        etapaIds: template.etapas.map((item) => item.etapaId),
      }, { id: card.id, pipelineId: input.pipelineId, etapaId: card.etapaId }));
    const resumoChecklist = calcularResumoChecklist([
      ...checklists.map((checklist) => ({
        id: checklist.templateId, templateId: checklist.templateId, templateNome: "Procedimento",
        itens: [...checklist.itens],
      })),
      ...virtuais.map((template) => ({
        id: template.id, templateId: template.id, templateNome: template.nome,
        itens: template.itens.map((item) => ({ ...item, status: "PENDENTE" })),
      })),
    ]);
    const valores = valoresPorCard.get(card.id);
    const camposObrigatorios = obrigatoriosPorEtapa.get(card.etapaId) ?? [];
    // Campos com origem canônica, valor padrão ou regra condicional exigem o
    // resolvedor por card. Não inferimos ausência a partir da tabela de valores.
    const camposIndeterminados = camposObrigatorios.some((config) =>
      config.campo.escopo === "GLOBAL" || Boolean(config.campo.fonteEntidade)
      || Boolean(config.campo.valorPadrao) || campoBpmPossuiFonteMestre(config.campo.nome)
      || Boolean(config.condicaoVisibilidadeJson) || Boolean(config.condicaoObrigatoriedadeJson));
    const pendenciasCampos = camposObrigatorios.filter((config) =>
      !valores?.get(config.campo.id)?.trim()).length;
    const proximaCadencia = cadenciaPorCard.get(card.id);
    resultado.set(card.id, {
      checklist: resumoChecklist.total
        ? { status: "ok", valor: `${resumoChecklist.concluidos}/${resumoChecklist.total} concluídos` }
        : { status: "vazio" },
      cadencia: proximaCadencia ? { status: "ok", valor: formatoCadencia.format(proximaCadencia) } : { status: "vazio" },
      pendencias: camposIndeterminados ? { status: "indisponivel" }
        : { status: "ok", valor: String(resumoChecklist.pendentesObrigatorios + pendenciasCampos) },
    });
  }
  return resultado;
}
