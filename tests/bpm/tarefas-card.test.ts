import { describe, expect, it } from "vitest";
import { separarTarefasCard } from "@/lib/bpm/tarefas-card";

describe("abas de tarefas e procedimentos do card", () => {
  it("mantém tarefas independentes, inclusive legadas do tipo CHECKLIST, fora dos procedimentos vinculados", () => {
    const registros = [
      { id: "tarefa", tipo: "TAREFA", cardChecklistId: null },
      { id: "lista-legada", tipo: "CHECKLIST", cardChecklistId: null },
      { id: "procedimento", tipo: "CHECKLIST", cardChecklistId: "checklist-1" },
    ];
    const resultado = separarTarefasCard(registros);
    expect(resultado.tarefas.map(({ id }) => id)).toEqual(["tarefa", "lista-legada"]);
    expect(resultado.procedimentos.map(({ id }) => id)).toEqual(["procedimento"]);
    expect(registros).toHaveLength(3);
  });
});
