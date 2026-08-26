import { describe, expect, it } from "vitest";
import { calcularPrioridadeFollowUp, followUpEstaVencido } from "@/lib/parceiros/prioridade";

const AMANHA = new Date(Date.now() + 24 * 60 * 60 * 1000);
const ONTEM = new Date(Date.now() - 24 * 60 * 60 * 1000);

describe("calcularPrioridadeFollowUp — algoritmo simples e explicável", () => {
  it("potencial 5 + follow-up vencido > potencial 2 + em dia (pedido original, caso literal)", () => {
    const alto = calcularPrioridadeFollowUp({
      potencialRecorrencia: 5,
      proximaAcaoEm: ONTEM,
      diasSemIndicacao: 10,
      estagioDesenvolvimento: "ATIVO",
    });
    const baixo = calcularPrioridadeFollowUp({
      potencialRecorrencia: 2,
      proximaAcaoEm: AMANHA,
      diasSemIndicacao: 10,
      estagioDesenvolvimento: "ATIVO",
    });
    expect(alto).toBeGreaterThan(baixo);
  });

  it("sem próxima ação pesa menos que follow-up vencido", () => {
    const semAcao = calcularPrioridadeFollowUp({ potencialRecorrencia: 3, proximaAcaoEm: null, diasSemIndicacao: 0, estagioDesenvolvimento: "ATIVO" });
    const vencido = calcularPrioridadeFollowUp({ potencialRecorrencia: 3, proximaAcaoEm: ONTEM, diasSemIndicacao: 0, estagioDesenvolvimento: "ATIVO" });
    expect(vencido).toBeGreaterThan(semAcao);
  });

  it("próxima ação futura não soma nem penaliza", () => {
    const comAcaoFutura = calcularPrioridadeFollowUp({ potencialRecorrencia: 0, proximaAcaoEm: AMANHA, diasSemIndicacao: 0, estagioDesenvolvimento: "EM_ATIVACAO" });
    expect(comAcaoFutura).toBe(0);
  });

  it("dias sem indicação tem teto (não cresce indefinidamente)", () => {
    const dias100 = calcularPrioridadeFollowUp({ potencialRecorrencia: 0, proximaAcaoEm: AMANHA, diasSemIndicacao: 100, estagioDesenvolvimento: "EM_ATIVACAO" });
    const dias1000 = calcularPrioridadeFollowUp({ potencialRecorrencia: 0, proximaAcaoEm: AMANHA, diasSemIndicacao: 1000, estagioDesenvolvimento: "EM_ATIVACAO" });
    expect(dias1000).toBe(dias100);
  });

  it("parceiro ATIVO/RECORRENTE pesa mais que EM_ATIVACAO em igualdade de resto", () => {
    const ativo = calcularPrioridadeFollowUp({ potencialRecorrencia: 2, proximaAcaoEm: AMANHA, diasSemIndicacao: 0, estagioDesenvolvimento: "ATIVO" });
    const emAtivacao = calcularPrioridadeFollowUp({ potencialRecorrencia: 2, proximaAcaoEm: AMANHA, diasSemIndicacao: 0, estagioDesenvolvimento: "EM_ATIVACAO" });
    expect(ativo).toBeGreaterThan(emAtivacao);
  });
});

describe("followUpEstaVencido", () => {
  it("null nunca está vencido", () => expect(followUpEstaVencido(null)).toBe(false));
  it("data passada está vencida", () => expect(followUpEstaVencido(ONTEM)).toBe(true));
  it("data futura não está vencida", () => expect(followUpEstaVencido(AMANHA)).toBe(false));
});
