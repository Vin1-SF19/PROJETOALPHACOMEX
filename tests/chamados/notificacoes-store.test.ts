import { beforeEach, describe, expect, it } from "vitest";

import { useChamadoNotificacoes } from "@/store/useChamadoNotificacoes";

describe("store de notificações de chamados", () => {
  beforeEach(() => {
    useChamadoNotificacoes.setState({ notificacoes: [], feedbacksPendentes: [] });
  });

  it("deduplica a mesma mensagem recebida por Pusher e pela recuperação", () => {
    const mensagem = {
      id: "mensagem-91",
      chamadoId: 15,
      titulo: "Falha no acesso",
      usuario: "Ana: Consegue verificar?",
      setor: "",
      urgencia: "MENSAGEM",
      createdAt: "2026-09-09T20:00:00.000Z",
    };

    useChamadoNotificacoes.getState().adicionarNotificacao(mensagem);
    useChamadoNotificacoes.getState().adicionarNotificacao(mensagem);

    expect(useChamadoNotificacoes.getState().notificacoes).toHaveLength(1);
  });

  it("mantém uma fila ordenada e deduplica feedback pelo chamado", () => {
    const primeiro = {
      chamadoId: 15,
      titulo: "Falha no acesso",
      closedAt: "2026-09-09T20:00:00.000Z",
    };

    useChamadoNotificacoes.getState().adicionarFeedbackPendente(primeiro);
    useChamadoNotificacoes.getState().adicionarFeedbackPendente(primeiro);
    useChamadoNotificacoes.getState().adicionarFeedbackPendente({
      chamadoId: 16,
      titulo: "Falha no computador",
      closedAt: "2026-09-09T21:00:00.000Z",
    });

    expect(useChamadoNotificacoes.getState().feedbacksPendentes.map((item) => item.chamadoId))
      .toEqual([15, 16]);

    useChamadoNotificacoes.getState().removerFeedbackPendente(15);
    expect(useChamadoNotificacoes.getState().feedbacksPendentes.map((item) => item.chamadoId))
      .toEqual([16]);
  });

  it("reconcilia a fila com as pendências persistidas no servidor", () => {
    useChamadoNotificacoes.getState().adicionarFeedbackPendente({
      chamadoId: 15,
      titulo: "Respondido em outra aba",
      closedAt: "2026-09-09T20:00:00.000Z",
    });

    useChamadoNotificacoes.getState().sincronizarFeedbacksPendentes([
      {
        chamadoId: 16,
        titulo: "Ainda pendente",
        closedAt: "2026-09-09T21:00:00.000Z",
      },
      {
        chamadoId: 16,
        titulo: "Ainda pendente",
        closedAt: "2026-09-09T21:00:00.000Z",
      },
    ]);

    expect(useChamadoNotificacoes.getState().feedbacksPendentes).toEqual([
      {
        chamadoId: 16,
        titulo: "Ainda pendente",
        closedAt: "2026-09-09T21:00:00.000Z",
      },
    ]);
  });
});
