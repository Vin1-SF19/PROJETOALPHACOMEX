import { describe, expect, it } from "vitest";
import { projetarResumosKanbanOperacionais } from "@/lib/bpm/card-kanban-projecao";

describe("projeção operacional do card Kanban", () => {
  it("agrega procedimentos, cadência mais próxima e pendências obrigatórias por card e etapa", () => {
    const resumos = projetarResumosKanbanOperacionais({
      pipelineId: "pipeline-a",
      cards: [{ id: "card-a", etapaId: "etapa-a" }, { id: "card-b", etapaId: "etapa-b" }],
      checklists: [
        { cardId: "card-a", itens: [
          { status: "CONCLUIDO", obrigatorio: true },
          { status: "PENDENTE", obrigatorio: true },
          { status: "PENDENTE", obrigatorio: false },
        ] },
        { cardId: "card-b", itens: [{ status: "CONCLUIDO", obrigatorio: true }] },
      ],
      cadencias: [
        { cardId: "card-a", status: "ATIVA", proximaExecucaoEm: new Date("2026-09-25T15:00:00Z") },
        { cardId: "card-a", status: "ATIVA", proximaExecucaoEm: new Date("2026-09-24T13:30:00Z") },
        { cardId: "card-a", status: "PAUSADA", proximaExecucaoEm: new Date("2026-09-23T12:00:00Z") },
      ],
      camposObrigatorios: [
        { etapaId: "etapa-a", campo: { id: "cpf", pipelineId: "pipeline-a", pipelinesAssociados: [] } },
        { etapaId: "etapa-a", campo: { id: "cnpj", pipelineId: null, pipelinesAssociados: [{ pipelineId: "pipeline-a" }] } },
        { etapaId: "etapa-a", campo: { id: "outro", pipelineId: "pipeline-b", pipelinesAssociados: [] } },
        { etapaId: "etapa-b", campo: { id: "nome", pipelineId: "pipeline-a", pipelinesAssociados: [] } },
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
      checklists: [], cadencias: [], camposObrigatorios: [], valoresCampos: [],
    });
    expect(resumos.get("card-a")).toEqual({
      checklist: { status: "vazio" }, cadencia: { status: "vazio" },
      pendencias: { status: "ok", valor: "0" },
    });
  });
});
