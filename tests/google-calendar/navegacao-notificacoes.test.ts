import { describe, expect, it } from "vitest";

import { intencaoParaNotificacaoAgenda } from "@/lib/google-calendar/navegacao";

describe("navegação das notificações da Agenda Alpha", () => {
  it("abre diretamente os compartilhamentos ao receber um convite", () => {
    expect(intencaoParaNotificacaoAgenda({
      tipo: "SOLICITACAO_RECEBIDA",
      solicitacaoId: "sol-42",
    })).toEqual({
      acao: "ABRIR_COMPARTILHAMENTOS",
      solicitacaoId: "sol-42",
    });
  });

  it("abre somente a agenda para compromissos e respostas", () => {
    expect(intencaoParaNotificacaoAgenda({ tipo: "COMPROMISSO" })).toEqual({ acao: "ABRIR_AGENDA" });
    expect(intencaoParaNotificacaoAgenda({ tipo: "SOLICITACAO_RESPONDIDA" })).toEqual({ acao: "ABRIR_AGENDA" });
  });
});
