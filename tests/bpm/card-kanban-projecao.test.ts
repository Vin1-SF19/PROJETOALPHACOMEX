import { describe, expect, it } from "vitest";
import { projetarResumosKanbanOperacionais } from "@/lib/bpm/card-kanban-projecao";

describe("projeção operacional do card Kanban", () => {
  it("agrega procedimentos, cadência mais próxima e pendências obrigatórias por card e etapa", () => {
    const resumos = projetarResumosKanbanOperacionais({
      pipelineId: "pipeline-a",
      cards: [{ id: "card-a", etapaId: "etapa-a" }, { id: "card-b", etapaId: "etapa-b" }],
      checklists: [
        { cardId: "card-a", templateId: "template-a", itens: [
          { status: "CONCLUIDO", obrigatorio: true },
          { status: "PENDENTE", obrigatorio: true },
          { status: "PENDENTE", obrigatorio: false },
        ] },
        { cardId: "card-b", templateId: "template-b", itens: [{ status: "CONCLUIDO", obrigatorio: true }] },
      ],
      templates: [],
      cadencias: [
        { cardId: "card-a", status: "ATIVA", proximaExecucaoEm: new Date("2026-09-25T15:00:00Z") },
        { cardId: "card-a", status: "ATIVA", proximaExecucaoEm: new Date("2026-09-24T13:30:00Z") },
        { cardId: "card-a", status: "PAUSADA", proximaExecucaoEm: new Date("2026-09-23T12:00:00Z") },
      ],
      camposObrigatorios: [
        { etapaId: "etapa-a", condicaoVisibilidadeJson: null, condicaoObrigatoriedadeJson: null, campo: { id: "cpf", nome: "ID fiscal", pipelineId: "pipeline-a", escopo: "CARD", fonteEntidade: null, valorPadrao: null, pipelinesAssociados: [] } },
        { etapaId: "etapa-a", condicaoVisibilidadeJson: null, condicaoObrigatoriedadeJson: null, campo: { id: "cnpj", nome: "Código fiscal", pipelineId: null, escopo: "CARD", fonteEntidade: null, valorPadrao: null, pipelinesAssociados: [{ pipelineId: "pipeline-a" }] } },
        { etapaId: "etapa-a", condicaoVisibilidadeJson: null, condicaoObrigatoriedadeJson: null, campo: { id: "outro", nome: "Outro", pipelineId: "pipeline-b", escopo: "CARD", fonteEntidade: null, valorPadrao: null, pipelinesAssociados: [] } },
        { etapaId: "etapa-b", condicaoVisibilidadeJson: null, condicaoObrigatoriedadeJson: null, campo: { id: "nome", nome: "Identificação", pipelineId: "pipeline-a", escopo: "CARD", fonteEntidade: null, valorPadrao: null, pipelinesAssociados: [] } },
      ],
      valoresCampos: [
        { cardId: "card-a", campoId: "cpf", valor: "123" },
        { cardId: "card-a", campoId: "cnpj", valor: "  " },
        { cardId: "card-b", campoId: "nome", valor: "Empresa" },
      ],
    });
    expect(resumos.get("card-a")).toEqual({
      checklist: { status: "ok", valor: "1/3 concluídos" },
      cadencia: { status: "ok", valor: "24/09/2026, 10:30" },
      pendencias: { status: "ok", valor: "2" },
    });
    expect(resumos.get("card-b")).toEqual({
      checklist: { status: "ok", valor: "1/1 concluídos" },
      cadencia: { status: "vazio" },
      pendencias: { status: "ok", valor: "0" },
    });
  });

  it("não inventa progresso ou cadência para card sem dados materializados", () => {
    const resumos = projetarResumosKanbanOperacionais({
      pipelineId: "pipeline-a", cards: [{ id: "card-a", etapaId: "etapa-a" }],
      checklists: [], templates: [], cadencias: [], camposObrigatorios: [], valoresCampos: [],
    });
    expect(resumos.get("card-a")).toEqual({
      checklist: { status: "vazio" }, cadencia: { status: "vazio" },
      pendencias: { status: "ok", valor: "0" },
    });
  });

  it("inclui template aplicável ainda virtual sem duplicar instância já materializada", () => {
    const resumos = projetarResumosKanbanOperacionais({
      pipelineId: "pipeline-a",
      cards: [{ id: "card-a", etapaId: "etapa-a" }, { id: "card-b", etapaId: "etapa-b" }],
      checklists: [{ cardId: "card-a", templateId: "materializado", itens: [{ status: "CONCLUIDO", obrigatorio: true }] }],
      templates: [
        { id: "materializado", nome: "Já aberto", pipelineId: "pipeline-a", etapaId: "etapa-a", cardId: null, etapas: [], itens: [{ obrigatorio: true }] },
        { id: "virtual", nome: "A aplicar", pipelineId: "pipeline-a", etapaId: null, cardId: null, etapas: [{ etapaId: "etapa-a" }], itens: [{ obrigatorio: true }, { obrigatorio: false }] },
        { id: "outro-card", nome: "Privado", pipelineId: "pipeline-a", etapaId: null, cardId: "card-b", etapas: [], itens: [{ obrigatorio: true }] },
      ],
      cadencias: [], camposObrigatorios: [], valoresCampos: [],
    });
    expect(resumos.get("card-a")?.checklist).toEqual({ status: "ok", valor: "1/3 concluídos" });
    expect(resumos.get("card-a")?.pendencias).toEqual({ status: "ok", valor: "1" });
    expect(resumos.get("card-b")?.checklist).toEqual({ status: "ok", valor: "0/1 concluídos" });
    expect(resumos.get("card-b")?.pendencias).toEqual({ status: "ok", valor: "1" });
  });

  it("não afirma zero pendências quando campo obrigatório depende de valor GLOBAL", () => {
    const resumos = projetarResumosKanbanOperacionais({
      pipelineId: "pipeline-a", cards: [{ id: "card-a", etapaId: "etapa-a" }],
      checklists: [], templates: [], cadencias: [], valoresCampos: [],
      camposObrigatorios: [{
        etapaId: "etapa-a", condicaoVisibilidadeJson: null, condicaoObrigatoriedadeJson: null,
        campo: { id: "cnpj", nome: "CNPJ", pipelineId: "pipeline-a", escopo: "GLOBAL", fonteEntidade: "Cliente", valorPadrao: null, pipelinesAssociados: [] },
      }],
    });
    expect(resumos.get("card-a")?.pendencias).toEqual({ status: "indisponivel" });
  });
});
