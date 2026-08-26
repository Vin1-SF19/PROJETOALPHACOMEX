import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  parceiro: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  parceiroHistorico: {
    create: vi.fn(),
  },
  parceiroConfig: {
    upsert: vi.fn(),
  },
  indicacao: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  clienteServico: {
    findMany: vi.fn(),
  },
  bpmCard: {
    count: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  transicionarEstagioDesenvolvimento,
  sincronizarEstagioAposIndicacao,
  executarJobDesenvolvimentoParceiros,
  calcularIndicadoresParceiro,
} from "@/lib/parceiros/desenvolvimento";

describe("Desenvolvimento do Parceiro — transicionarEstagioDesenvolvimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
  });

  it("é idempotente: não altera nem grava histórico se já está no estágio alvo", async () => {
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "ATIVO" });
    const r = await transicionarEstagioDesenvolvimento(1, "ATIVO");
    expect(r.alterado).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("transiciona e grava histórico quando o estágio muda", async () => {
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "NOVO" });
    const r = await transicionarEstagioDesenvolvimento(1, "EM_ATIVACAO", { automacaoOrigem: "teste" });
    expect(r.alterado).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

describe("Desenvolvimento do Parceiro — sincronizarEstagioAposIndicacao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
  });

  it("1ª indicação de um parceiro NOVO vira PRIMEIRA_INDICACAO", async () => {
    prismaMock.indicacao.count.mockResolvedValue(1);
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "NOVO" });
    const r = await sincronizarEstagioAposIndicacao(1);
    expect(r.alterado).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("2ª indicação de um parceiro em PRIMEIRA_INDICACAO vira ATIVO", async () => {
    prismaMock.indicacao.count.mockResolvedValue(2);
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "PRIMEIRA_INDICACAO" });
    const r = await sincronizarEstagioAposIndicacao(1);
    expect(r.alterado).toBe(true);
  });

  it("não mexe em um parceiro já ATIVO (evita rebaixar/duplicar automação)", async () => {
    prismaMock.indicacao.count.mockResolvedValue(3);
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "ATIVO" });
    const r = await sincronizarEstagioAposIndicacao(1);
    expect(r.alterado).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("não mexe em um parceiro RECORRENTE", async () => {
    prismaMock.indicacao.count.mockResolvedValue(10);
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "RECORRENTE" });
    const r = await sincronizarEstagioAposIndicacao(1);
    expect(r.alterado).toBe(false);
  });

  // RM-2026-2C7A4B: INATIVO deixou de reagir automaticamente a uma indicação — precisa passar
  // por EM_REATIVACAO primeiro (via ReativarParceiro, ação manual). Só então uma indicação real
  // resolve o destino final automaticamente.
  it("NÃO reativa automaticamente um parceiro INATIVO só por receber uma indicação (precisa de EM_REATIVACAO primeiro)", async () => {
    prismaMock.indicacao.count.mockResolvedValue(5);
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "INATIVO" });
    const r = await sincronizarEstagioAposIndicacao(1);
    expect(r.alterado).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("resolve o destino automaticamente quando uma indicação chega durante EM_REATIVACAO", async () => {
    prismaMock.indicacao.count.mockResolvedValue(5);
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "EM_REATIVACAO" });
    const r = await sincronizarEstagioAposIndicacao(1);
    expect(r.alterado).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

describe("Desenvolvimento do Parceiro — calcularIndicadoresParceiro (sempre derivado dos registros reais)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("parceiro sem nenhuma indicação: indicadores neutros, diasSemIndicacao null", async () => {
    prismaMock.indicacao.findMany.mockResolvedValue([]);
    const r = await calcularIndicadoresParceiro(1);
    expect(r).toEqual({
      jaIndicou: false,
      primeiraIndicacaoEm: null,
      ultimaIndicacaoEm: null,
      diasSemIndicacao: null,
      totalIndicacoes: 0,
      totalOportunidades: 0,
      contratosOriginados: 0,
      conversao: 0,
      receitaOriginada: 0,
    });
    expect(prismaMock.clienteServico.findMany).not.toHaveBeenCalled();
  });

  it("calcula conversão e receita a partir de ClienteServico real", async () => {
    const dezDiasAtras = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    prismaMock.indicacao.findMany.mockResolvedValue([
      { clienteId: 10, dataIndicacao: dezDiasAtras },
      { clienteId: 11, dataIndicacao: new Date() },
    ]);
    prismaMock.clienteServico.findMany.mockResolvedValue([
      { valorContrato: 1000, dataContratacao: "2026-01-01" },
      { valorContrato: null, dataContratacao: null },
    ]);
    prismaMock.bpmCard.count.mockResolvedValue(2);

    const r = await calcularIndicadoresParceiro(1);
    expect(r.totalIndicacoes).toBe(2);
    expect(r.contratosOriginados).toBe(1);
    expect(r.receitaOriginada).toBe(1000);
    expect(r.conversao).toBe(0.5);
    expect(r.totalOportunidades).toBe(2);
    expect(r.diasSemIndicacao).toBe(0);
  });
});

describe("Desenvolvimento do Parceiro — executarJobDesenvolvimentoParceiros (job de manutenção)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
    prismaMock.parceiroConfig.upsert.mockResolvedValue({ diasInatividade: 60 });
  });

  it("ativa parceiros com onboarding concluído parados em NOVO/EM_ATIVACAO", async () => {
    prismaMock.parceiro.findMany
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]) // candidatos de ativação
      .mockResolvedValueOnce([]); // candidatos de inatividade
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "NOVO" });

    const r = await executarJobDesenvolvimentoParceiros();
    expect(r.ativadosSemIndicacao).toBe(2);
    expect(r.marcadosInativos).toBe(0);
  });

  it("NÃO marca inativo um parceiro que indicou depois do limite configurado (mesmo com estágio desatualizado)", async () => {
    const ontem = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    prismaMock.parceiro.findMany
      .mockResolvedValueOnce([]) // ativação
      .mockResolvedValueOnce([{ id: 5, indicacoes: [{ dataIndicacao: ontem }] }]); // inatividade

    const r = await executarJobDesenvolvimentoParceiros();
    expect(r.marcadosInativos).toBe(0);
    expect(prismaMock.parceiro.findUnique).not.toHaveBeenCalled();
  });

  it("marca inativo um parceiro sem nenhuma indicação e estágio parado há mais do que o prazo", async () => {
    prismaMock.parceiro.findMany
      .mockResolvedValueOnce([]) // ativação
      .mockResolvedValueOnce([{ id: 9, indicacoes: [] }]); // inatividade
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "ATIVADO_SEM_INDICACAO" });

    const r = await executarJobDesenvolvimentoParceiros();
    expect(r.marcadosInativos).toBe(1);
  });
});
