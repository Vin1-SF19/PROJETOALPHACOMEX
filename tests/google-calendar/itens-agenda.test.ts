import { describe, expect, it } from "vitest";

import { tarefasParaItensAgenda } from "@/components/CalendarioAlpha/lib/itens-agenda";

describe("tarefasParaItensAgenda", () => {
  it("mostra tarefa pendente com vencimento como item verde de dia inteiro", () => {
    const [item] = tarefasParaItensAgenda([{
      id: "task-cache-1",
      taskListGoogleId: "lista-1",
      listaTitulo: "Minhas tarefas",
      titulo: "Enviar proposta",
      status: "needsAction",
      vencimentoEm: "2026-08-27T00:00:00.000Z",
    }]);

    expect(item).toMatchObject({
      tipo: "tarefa",
      tarefaCacheId: "task-cache-1",
      diaInteiro: true,
      eventType: "task",
      calendarioNome: "Minhas tarefas",
    });
    expect(item?.inicioEm).toContain("2026-08-27");
  });

  it("não mostra tarefas concluídas ou sem data na grade", () => {
    expect(tarefasParaItensAgenda([
      { id: "1", taskListGoogleId: "l", listaTitulo: "L", titulo: "Feita", status: "completed", vencimentoEm: "2026-08-27T00:00:00.000Z" },
      { id: "2", taskListGoogleId: "l", listaTitulo: "L", titulo: "Sem data", status: "needsAction", vencimentoEm: null },
    ])).toEqual([]);
  });
});
