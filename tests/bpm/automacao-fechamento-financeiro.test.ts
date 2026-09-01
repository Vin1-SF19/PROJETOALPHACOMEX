import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  bpmCard: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  bpmPipeline: { findFirst: vi.fn() },
  bpmEtapa: { findFirst: vi.fn() },
  bpmCardMembro: { create: vi.fn() },
  bpmCardVinculo: { create: vi.fn() },
  bpmCardHistorico: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { executarAutomacaoFechamentoComercial } from "@/lib/bpm/automacoes";

type CardFixture = {
  id: string;
  empresaId: number;
  responsavelId: number;
  pipeline: { id: string; nome: string };
  etapa: { id: string; nome: string };
};

function montarCard(overrides: Partial<CardFixture> = {}): CardFixture {
  return {
    id: "clw0000000000000pai",
    empresaId: 42,
    responsavelId: 7,
    pipeline: { id: "pipRadar", nome: "Revisão de Radar" },
    etapa: { id: "etFechado", nome: "Fechado" },
    ...overrides,
  };
}

function configurarPipelineFinanceiro() {
  prismaMock.bpmPipeline.findFirst.mockImplementation(
    ({ where }: { where: { nome: string } }) =>
      where.nome === "Financeiro"
        ? Promise.resolve({ id: "pipFin", nome: "Financeiro" })
        : Promise.resolve(null),
  );
}

function transacaoRetornaCard(id: string) {
  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock),
  );
  prismaMock.bpmCard.create.mockResolvedValue({ id });
}

beforeEach(() => {
  vi.clearAllMocks();
  transacaoRetornaCard("clw0000000000000filh");
  prismaMock.bpmCard.findFirst.mockResolvedValue(null);
  prismaMock.bpmEtapa.findFirst.mockResolvedValue({ id: "etFirst", ordem: 0 });
  configurarPipelineFinanceiro();
});

describe("executarAutomacaoFechamentoComercial", () => {
  it("(a) etapa 'Fechado' no pipeline comercial cria card no Financeiro com vínculo", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(montarCard());

    const resultado = await executarAutomacaoFechamentoComercial(
      "clw0000000000000pai",
      7,
    );

    expect(resultado).toEqual([
      { pipelineId: "pipFin", pipelineNome: "Financeiro", cardId: "clw0000000000000filh" },
    ]);
    expect(prismaMock.bpmCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          empresaId: 42,
          pipelineId: "pipFin",
          etapaId: "etFirst",
          responsavelId: 7,
        }),
      }),
    );
    expect(prismaMock.bpmCardVinculo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { cardOrigemId: "clw0000000000000pai", cardDestinoId: "clw0000000000000filh" },
      }),
    );
    expect(
      prismaMock.bpmCardHistorico.create.mock.calls.some(
        ([c]) => (c as { data?: { acao?: string } }).data?.acao === "CARD_CRIADO_POR_AUTOMACAO",
      ),
    ).toBe(true);
  });

  it("(b) idempotência: card ativo já existente no Financeiro não cria duplicata", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(montarCard());
    prismaMock.bpmCard.findFirst.mockResolvedValue({ id: "clw0000000jaExiste" });

    const resultado = await executarAutomacaoFechamentoComercial(
      "clw0000000000000pai",
      7,
    );

    expect(resultado).toEqual([]);
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardVinculo.create).not.toHaveBeenCalled();
  });

  it("(c) etapa que não é 'Fechado' não dispara a automação", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(
      montarCard({ etapa: { id: "etTrat", nome: "Em tratativa" } }),
    );

    const resultado = await executarAutomacaoFechamentoComercial(
      "clw0000000000000pai",
      7,
    );

    expect(resultado).toEqual([]);
    expect(prismaMock.bpmPipeline.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
  });

  it("(d) card já dentro do Financeiro não dispara a si mesmo (guard anti-loop)", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(
      montarCard({ pipeline: { id: "pipFin", nome: "Financeiro" } }),
    );

    const resultado = await executarAutomacaoFechamentoComercial(
      "clw0000000000000pai",
      7,
    );

    expect(resultado).toEqual([]);
    expect(prismaMock.bpmPipeline.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
  });
});
