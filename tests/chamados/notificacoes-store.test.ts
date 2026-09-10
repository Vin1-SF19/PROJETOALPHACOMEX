import { beforeEach, describe, expect, it } from "vitest";

import { useChamadoNotificacoes } from "@/store/useChamadoNotificacoes";

describe("store de notificações de chamados", () => {
  beforeEach(() => {
    useChamadoNotificacoes.setState({ notificacoes: [] });
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
});
