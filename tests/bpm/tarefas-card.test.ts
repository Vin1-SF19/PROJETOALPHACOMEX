import { describe, expect, it } from "vitest";
import { separarTarefasCard } from "@/lib/bpm/tarefas-card";

describe("abas de tarefas e procedimentos do card", () => {
  it("separa tarefas comuns de procedimentos vinculados e legados", () => {
    const registros = [
      { id: "tarefa", tipo: "TAREFA", cardChecklistId: null },
      { id: "lista-legada", tipo: "CHECKLIST", cardChecklistId: null },
      { id: "procedimento", tipo: "CHECKLIST", cardChecklistId: "checklist-1" },
    ];
    const resultado = separarTarefasCard(registros);
    expect(resultado.tarefas.map(({ id }) => id)).toEqual(["tarefa"]);
    expect(resultado.procedimentos.map(({ id }) => id)).toEqual(["lista-legada", "procedimento"]);
    expect(registros).toHaveLength(3);
  });
});
