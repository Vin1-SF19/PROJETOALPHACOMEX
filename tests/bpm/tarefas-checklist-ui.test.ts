import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (arquivo: string) => readFileSync(arquivo, "utf8");

describe("tarefas derivadas de checklist na interface", () => {
  it("expõe origem, badge e navegação para o checklist correto", () => {
    const action = ler("src/actions/bpm/Tarefas.ts");
    const central = ler("src/app/PainelAlpha/AlphaCRM/tarefas/TarefasCentralClient.tsx");
    const modal = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx");
    expect(action).toContain("cardChecklist: { select: { id: true, templateNome: true, status: true } }");
    expect(central).toContain("Boolean(t.cardChecklistId)");
    expect(central).toContain("Checklist");
    expect(modal).toContain('new CustomEvent("bpm:abrir-pendencias-checklist"');
  });

  it("substitui a conclusão manual por abertura do checklist", () => {
    const painel = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelTarefasPorTipo.tsx");
    expect(painel).toContain("const gerenciadaPorChecklist = Boolean(tarefa.cardChecklistId)");
    expect(painel).toContain('"Abrir checklist para concluir"');
    expect(painel).toContain('new CustomEvent("bpm:abrir-pendencias-checklist"');
  });
});
