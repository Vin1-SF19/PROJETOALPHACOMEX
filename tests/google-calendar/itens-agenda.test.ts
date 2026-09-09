import { describe, expect, it } from "vitest";

import { tarefasParaItensAgenda } from "@/components/CalendarioAlpha/lib/itens-agenda";
import { corDoItemAgenda } from "@/components/CalendarioAlpha/lib/tipos";

describe("tarefasParaItensAgenda", () => {
  it("mostra tarefa pendente com vencimento como item verde de dia inteiro", () => {
    const [item] = tarefasParaItensAgenda([{
      id: "task-cache-1",
      taskListGoogleId: "lista-1",
      listaTitulo: "Minhas tarefas",
      titulo: "Enviar proposta",
      notas: null,
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

  it("mantém tarefas concluídas na grade e continua ocultando tarefas sem data", () => {
    const itens = tarefasParaItensAgenda([
      { id: "1", taskListGoogleId: "l", listaTitulo: "L", titulo: "Feita", notas: null, status: "completed", vencimentoEm: "2026-08-27T00:00:00.000Z" },
      { id: "2", taskListGoogleId: "l", listaTitulo: "L", titulo: "Sem data", notas: null, status: "needsAction", vencimentoEm: null },
    ]);

    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({
      tarefaCacheId: "1",
      status: "completed",
      diaInteiro: true,
    });
    expect(corDoItemAgenda(itens[0]!)).not.toBe(corDoItemAgenda({ ...itens[0]!, status: "needsAction" }));
  });

  it("exibe tarefa de chamado no horário local e conserva o fim real concluído", () => {
    const [item] = tarefasParaItensAgenda([{
      id: "task-chamado-1",
      taskListGoogleId: "lista-1",
      listaTitulo: "Minhas tarefas",
      titulo: "Chamado #42 — Impressora",
      notas: null,
      status: "needsAction",
      vencimentoEm: "2026-08-27T00:00:00.000Z",
      inicioAgendadoEm: "2026-08-27T12:00:00.000Z",
      fimPlanejadoAgendadoEm: "2026-08-27T13:00:00.000Z",
      fimConcluidoAgendadoEm: "2026-08-27T12:37:00.000Z",
      statusAgendamento: "CONCLUIDO",
    }]);

    expect(item).toMatchObject({
      tipo: "tarefa",
      diaInteiro: false,
      status: "completed",
      inicioEm: "2026-08-27T12:00:00.000Z",
      fimEm: "2026-08-27T12:37:00.000Z",
      calendarioCorHex: "#22c55e",
    });
  });
});
