import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {} }));

import { registrarConclusaoContratoFinanceiro } from "@/lib/bpm/financeiro-assinatura-server";
import { CHAVES_CAMPOS as K } from "@/lib/bpm/financeiro-config.client";

const campo = (chave: string, id: string, opcoesJson: string | null = null) => ({ chave, id, opcoesJson });
const campos = [
  campo(K.STATUS_ASSINATURA, "status"),
  campo(K.STATUS_CONTRATO, "contrato", JSON.stringify(["Pendente", "CONTRATO CONCLUÍDO"])),
  campo(K.DATA_ASSINATURA, "data"),
  campo(K.ANEXO_ASSINADO, "anexo"),
  campo(K.PAGAMENTO_CONFIRMADO, "pagamento"),
];

function cliente(anexoValido = true, jaRegistrado = false) {
  return {
    bpmPipeline: { findUnique: vi.fn().mockResolvedValue({ chave: "financeiro" }) },
    bpmCampo: { findMany: vi.fn().mockResolvedValue(campos) },
    bpmCardCampoValor: {
      findMany: vi.fn().mockResolvedValue([
        { campoId: "status", valor: "Assinado" }, { campoId: "data", valor: "2026-09-29" },
        { campoId: "anexo", valor: "anexo-1" }, { campoId: "pagamento", valor: "Sim" },
      ]),
      upsert: vi.fn(),
    },
    bpmCardAnexo: { findFirst: vi.fn().mockResolvedValue(anexoValido ? { id: "anexo-1", url: "bpm-blob:bpm/contratos/assinado.pdf" } : null) },
    bpmTarefa: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    bpmCardHistorico: {
      findFirst: vi.fn().mockResolvedValue(jaRegistrado ? { id: "historico-1" } : null),
      create: vi.fn(),
    },
  };
}

describe("conclusão auditada do contrato financeiro", () => {
  it("encerra acompanhamentos e registra o primeiro evento após assinatura válida", async () => {
    const tx = cliente();
    await registrarConclusaoContratoFinanceiro(tx as never, "card-1", "pipeline-1", 1);
    expect(tx.bpmTarefa.updateMany).toHaveBeenCalledWith({
      where: { cardId: "card-1", tipo: "ASSINATURA_CONTRATO", status: "PENDENTE" },
      data: { status: "CONCLUIDA", concluidaEm: expect.any(Date) },
    });
    expect(tx.bpmCardCampoValor.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { cardId: "card-1", campoId: "contrato", valor: "CONTRATO CONCLUÍDO" },
    }));
    expect(tx.bpmCardHistorico.create).toHaveBeenCalledOnce();
    expect(tx.bpmCardHistorico.create.mock.calls[0][0].data.valorNovoJson).toContain('"tarefasEncerradas":2');
  });

  it("limpa tarefas residuais sem duplicar o evento já registrado", async () => {
    const tx = cliente(true, true);
    await registrarConclusaoContratoFinanceiro(tx as never, "card-1", "pipeline-1", 1);
    expect(tx.bpmTarefa.updateMany).toHaveBeenCalledOnce();
    expect(tx.bpmCardHistorico.create).not.toHaveBeenCalled();
  });

  it("não conclui nem encerra tarefas sem anexo assinado válido", async () => {
    const tx = cliente(false);
    await registrarConclusaoContratoFinanceiro(tx as never, "card-1", "pipeline-1", 1);
    expect(tx.bpmTarefa.updateMany).not.toHaveBeenCalled();
    expect(tx.bpmCardHistorico.create).not.toHaveBeenCalled();
  });
});
