import { describe, expect, it } from "vitest";
import { avaliarFormalizacaoFinanceira } from "@/lib/bpm/financeiro-formalizacao";

const base = {
  statusAssinatura: "Aguardando assinatura",
  dataAssinatura: null,
  anexoAssinadoId: null,
  anexoAssinadoVinculado: false,
  pagamentoConfirmado: "Não",
};

describe("requisitos independentes da Formalização", () => {
  it("mantém Contrato pendente após pagamento sem assinatura", () => {
    const resultado = avaliarFormalizacaoFinanceira({ ...base, pagamentoConfirmado: "Sim" });
    expect(resultado).toMatchObject({ contrato: "Pendente", pagamento: "Concluído", contratacaoConcluida: false });
  });

  it("mantém Contrato pendente quando há status e data, mas não há anexo vinculado", () => {
    const resultado = avaliarFormalizacaoFinanceira({ ...base, statusAssinatura: "Assinado", dataAssinatura: "2026-09-25", anexoAssinadoId: "arquivo-antigo" });
    expect(resultado.contrato).toBe("Pendente");
    expect(resultado.pendencias).toContain("Contrato assinado/anexo");
  });

  it("não aceita uma data de assinatura impossível", () => {
    const resultado = avaliarFormalizacaoFinanceira({ ...base, statusAssinatura: "Assinado", dataAssinatura: "2026-02-30", anexoAssinadoId: "anexo", anexoAssinadoVinculado: true });
    expect(resultado.pendencias).toContain("Data da assinatura");
  });

  it("conclui o contrato antes do pagamento e a contratação depois", () => {
    const assinado = avaliarFormalizacaoFinanceira({ ...base, statusAssinatura: "Assinado", dataAssinatura: "2026-09-25", anexoAssinadoId: "anexo", anexoAssinadoVinculado: true });
    expect(assinado).toMatchObject({ contrato: "Concluído", pagamento: "Pendente", contratacaoConcluida: false });
    const pago = avaliarFormalizacaoFinanceira({ ...base, statusAssinatura: "Assinado", dataAssinatura: "2026-09-25", anexoAssinadoId: "anexo", anexoAssinadoVinculado: true, pagamentoConfirmado: "Sim" });
    expect(pago).toMatchObject({ contrato: "Concluído", pagamento: "Concluído", contratacaoConcluida: true, pendencias: [] });
  });
});
