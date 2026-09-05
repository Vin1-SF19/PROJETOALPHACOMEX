import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {} }));

import { avaliarRegra } from "@/lib/bpm/regras/avaliador";
import {
  carregarResumoChecklistAplicavelCard,
  montarFatoChecklistAutomacaoBpm,
  obterErroChecklistParaMovimento,
} from "@/lib/bpm/checklists/integracao";

const card = {
  id: "card-1",
  pipelineId: "pipeline-1",
  etapaId: "etapa-1",
  servico: "Protocolo",
  tipoProcesso: "Importação",
};

function client(status = "PENDENTE") {
  return {
    bpmCard: { findUnique: vi.fn() },
    bpmCardChecklist: {
      findMany: vi.fn().mockResolvedValue([{
        id: "instancia-1",
        templateId: "template-1",
        templateNome: "Documentação para protocolo",
        itens: [{ id: "item-1", nome: "Anexar procuração", status, obrigatorio: true }],
      }]),
    },
    bpmChecklistTemplate: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

describe("integração do checklist com os motores BPM", () => {
  it("expõe contrato estável e uma mensagem acionável para o bloqueio", async () => {
    const banco = client();
    const resumo = await carregarResumoChecklistAplicavelCard(card, banco as never);
    const erro = await obterErroChecklistParaMovimento(card, banco as never);

    expect(resumo).toMatchObject({
      total: 1,
      concluidos: 0,
      pendentesObrigatorios: 1,
      checklists: [{ id: "instancia-1", templateId: "template-1", concluido: false }],
      itensObrigatoriosPendentes: [{ id: "item-1", nome: "Anexar procuração" }],
    });
    expect(erro).toContain("Documentação para protocolo");
    expect(erro).toContain("Anexar procuração");
  });

  it("libera depois da conclusão e entrega o mesmo fato para regras e automações", async () => {
    const banco = client("CONCLUIDO");
    const fato = await montarFatoChecklistAutomacaoBpm(card, banco as never);
    expect(await obterErroChecklistParaMovimento(card, banco as never)).toBeNull();
    expect(fato.placeholders["checklist.concluido"]).toBe("true");
    expect(avaliarRegra({
      id: "regra-checklist",
      versao: 1,
      nome: "Checklist pendente",
      ativa: true,
      prioridade: 0,
      condicao: {
        operador: "AND",
        condicoes: [{
          tipo: "condicao",
          campo: { fonte: "checklist", campo: "possuiPendenciaObrigatoria" },
          operador: "igual",
          valor: false,
        }],
      },
      resultado: { tipo: "resultado_condicional", valor: "LIBERADO" },
    }, { card: {}, checklist: fato.checklist })).toMatchObject({ permitida: true, aplicada: true });
  });

  it("mantém projeções fail-open e o commit de movimento fail-closed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const falho = {
      bpmCard: { findUnique: vi.fn() },
      bpmCardChecklist: { findMany: vi.fn().mockRejectedValue(new Error("indisponível")) },
      bpmChecklistTemplate: { findMany: vi.fn().mockRejectedValue(new Error("indisponível")) },
    };
    const fato = await montarFatoChecklistAutomacaoBpm(card, falho as never);
    expect(fato.checklist).toMatchObject({ total: 0, pendentesObrigatorios: 0 });
    expect(consoleError).toHaveBeenCalled();
    await expect(obterErroChecklistParaMovimento(card, falho as never))
      .rejects.toThrow("indisponível");
    consoleError.mockRestore();
  });
});
