import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn() },
  commissionEvent: { upsert: vi.fn() },
  commissionRule: { findMany: vi.fn() },
}));
const gerarLancamentosMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/commissions/entry-generator", () => ({
  gerarLancamentosParaEvento: gerarLancamentosMock,
}));

import { sincronizarComissoesDoCardFinanceiro } from "@/lib/bpm/regras-financeiras/comissoes-card";

function cardFinanceiro(pagamento = "Sim") {
  return {
    id: "card-1",
    responsavelId: 42,
    updatedAt: new Date("2026-09-04T12:00:00Z"),
    servico: "Consultoria",
    pipeline: { nome: "Financeiro" },
    empresa: { id: 7, cnpj: "12345678000190", razaoSocial: "Alpha", nomeFantasia: null },
    campoValores: [
      { valor: pagamento, campo: { nome: "Pagamento confirmado" } },
      { valor: "10.000,00", campo: { nome: "Valor bruto do contrato" } },
      { valor: "9.385,00", campo: { nome: "Valor líquido para pagamento" } },
      { valor: "PIX", campo: { nome: "Forma de pagamento" } },
      { valor: "Consultoria", campo: { nome: "Serviço contratado" } },
      { valor: "2026-09-04", campo: { nome: "Data de pagamento" } },
    ],
  };
}

describe("comissões do card financeiro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.commissionRule.findMany.mockResolvedValue([]);
    prismaMock.commissionEvent.upsert.mockResolvedValue({ id: "evento-1" });
    gerarLancamentosMock.mockResolvedValue({ entriesCreated: 1, entriesSkipped: 0, divergencesCreated: 0 });
  });

  it("não cria evento antes da confirmação do pagamento", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardFinanceiro("Não"));
    expect(await sincronizarComissoesDoCardFinanceiro("card-1")).toBeNull();
    expect(prismaMock.commissionEvent.upsert).not.toHaveBeenCalled();
  });

  it("converte valores para centavos e usa chave idempotente do card", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardFinanceiro());
    await sincronizarComissoesDoCardFinanceiro("card-1");
    expect(prismaMock.commissionEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { sourceSystem_sourceEntity_sourceId_eventType: {
        sourceSystem: "alpha-bpm", sourceEntity: "bpm-card-payment", sourceId: "card-1", eventType: "CONTRACTING",
      } },
      create: expect.objectContaining({ grossContractAmountCents: 1_000_000, netContractAmountCents: 938_500 }),
      update: expect.objectContaining({ grossContractAmountCents: 1_000_000, netContractAmountCents: 938_500 }),
    }));
    expect(gerarLancamentosMock).toHaveBeenCalledWith({ eventId: "evento-1", collaboratorIds: [42] });
  });

  it("inclui beneficiário fixo configurado sem duplicar o responsável", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardFinanceiro());
    prismaMock.commissionRule.findMany.mockResolvedValue([
      { collaboratorId: 42 }, { collaboratorId: 77 },
    ]);
    await sincronizarComissoesDoCardFinanceiro("card-1");
    expect(gerarLancamentosMock).toHaveBeenCalledWith({ eventId: "evento-1", collaboratorIds: [42, 77] });
  });
});
