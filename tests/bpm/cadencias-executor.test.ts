import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing executor
vi.mock("@/lib/prisma", () => {
  const mockTx = {
    bpmCadenciaPassoExecucao: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    bpmTarefa: {
      create: vi.fn(),
    },
    bpmCardCadencia: {
      update: vi.fn(),
    },
    bpmCardHistorico: {
      create: vi.fn(),
    },
  };
  const mockDb = {
    bpmCardCadencia: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    bpmCadenciaPassoExecucao: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    bpmTarefa: {
      create: vi.fn(),
    },
    bpmCardHistorico: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<void>) => fn(mockTx)),
  };
  return { default: mockDb };
});

vi.mock("@/lib/bpm/historico-server", () => ({
  registrarHistoricoCard: vi.fn(),
}));

vi.mock("@/lib/bpm/realtime-server", () => ({
  notificarPipelineBpm: vi.fn(),
}));

import db from "@/lib/prisma";
import { processarCadenciasBpm } from "@/lib/bpm/cadencias/executor";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const mockDb = db as unknown as {
  bpmCardCadencia: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  bpmCadenciaPassoExecucao: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  bpmTarefa: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

function makeVinculo(overrides: Record<string, unknown> = {}) {
  return {
    id: "vinculo1",
    cardId: "card1",
    cadenciaId: "cad1",
    status: "ATIVA",
    passoAtualOrdem: 1,
    proximaExecucaoEm: new Date("2026-01-01"),
    card: { id: "card1", pipelineId: "pipe1", etapaId: "et1", status: "ATIVO", responsavelId: 1 },
    cadencia: {
      id: "cad1",
      nome: "Cadência Teste",
      ativa: true,
      passos: [
        { id: "passo1", ordem: 1, intervaloDias: 7, titulo: "Passo 1", tipoTarefa: "TAREFA", prioridade: "NORMAL", ativo: true },
        { id: "passo2", ordem: 2, intervaloDias: 14, titulo: "Passo 2", tipoTarefa: "EMAIL", prioridade: "ALTA", ativo: true },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processarCadenciasBpm", () => {
  it("processa vínculo vencido: cria tarefa, avança passo, registra histórico", async () => {
    const vinculo = makeVinculo();
    mockDb.bpmCardCadencia.findMany.mockResolvedValue([vinculo]);

    const execucao = { id: "exec1" };
    const tarefa = { id: "tarefa1" };

    // $transaction calls the fn with a mock tx
    mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        bpmCadenciaPassoExecucao: {
          create: vi.fn().mockResolvedValue(execucao),
          update: vi.fn().mockResolvedValue({}),
        },
        bpmTarefa: { create: vi.fn().mockResolvedValue(tarefa) },
        bpmCardCadencia: { update: vi.fn().mockResolvedValue({}) },
        bpmCardHistorico: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const resultado = await processarCadenciasBpm();

    expect(resultado.processadas).toBe(1);
    expect(resultado.falhas).toBe(0);
    expect(mockDb.$transaction).toHaveBeenCalled();
    expect(registrarHistoricoCard).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: "card1",
        acao: "CADENCIA_PASSO_EXECUTADO",
        automacaoOrigem: "Motor de Cadências",
      }),
      expect.anything(),
    );
    expect(notificarPipelineBpm).toHaveBeenCalledWith({ pipelineId: "pipe1", tipo: "TAREFA_ALTERADA" });
  });

  it("idempotência: P2002 (unique constraint) não duplica tarefa", async () => {
    const vinculo = makeVinculo();
    mockDb.bpmCardCadencia.findMany.mockResolvedValue([vinculo]);

    // Simulate P2002 on execution create
    const p2002Error = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        bpmCadenciaPassoExecucao: {
          create: vi.fn().mockRejectedValue(p2002Error),
          update: vi.fn(),
        },
        bpmTarefa: { create: vi.fn() },
        bpmCardCadencia: { update: vi.fn() },
        bpmCardHistorico: { create: vi.fn() },
      };
      return fn(tx);
    });

    const resultado = await processarCadenciasBpm();

    // Should be counted as processed (idempotent), not as failure
    expect(resultado.processadas).toBe(1);
    expect(resultado.falhas).toBe(0);
    expect(resultado.avisos.some((a) => a.includes("idempotente"))).toBe(true);
  });

  it("falha intermediária: execução não fica EM_EXECUCAO órfã", async () => {
    const vinculo = makeVinculo();
    mockDb.bpmCardCadencia.findMany.mockResolvedValue([vinculo]);

    // Execution creates OK but tarefa.create throws
    mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        bpmCadenciaPassoExecucao: {
          create: vi.fn().mockResolvedValue({ id: "exec1" }),
          update: vi.fn(),
        },
        bpmTarefa: { create: vi.fn().mockRejectedValue(new Error("DB error")) },
        bpmCardCadencia: { update: vi.fn() },
        bpmCardHistorico: { create: vi.fn() },
      };
      return fn(tx);
    });

    // Cleanup: updateMany should be called to mark EM_EXECUCAO → FALHA
    mockDb.bpmCadenciaPassoExecucao.updateMany.mockResolvedValue({ count: 1 });

    const resultado = await processarCadenciasBpm();

    expect(resultado.falhas).toBe(1);
    expect(mockDb.bpmCadenciaPassoExecucao.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { vinculoId: "vinculo1", status: "EM_EXECUCAO" },
        data: expect.objectContaining({ status: "FALHA" }),
      }),
    );
  });

  it("card não ATIVO: vínculo é cancelado", async () => {
    const vinculo = makeVinculo({ card: { id: "card1", pipelineId: "pipe1", etapaId: "et1", status: "FECHADO", responsavelId: 1 } });
    mockDb.bpmCardCadencia.findMany.mockResolvedValue([vinculo]);
    mockDb.bpmCardCadencia.update.mockResolvedValue({});

    const resultado = await processarCadenciasBpm();

    expect(mockDb.bpmCardCadencia.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vinculo1" },
        data: expect.objectContaining({ status: "CANCELADA" }),
      }),
    );
    expect(resultado.processadas).toBe(0);
    expect(resultado.falhas).toBe(0);
  });

  it("cadência inativa: vínculo é pausado", async () => {
    const vinculo = makeVinculo({ cadencia: { id: "cad1", nome: "Cad", ativa: false, passos: [] } });
    mockDb.bpmCardCadencia.findMany.mockResolvedValue([vinculo]);
    mockDb.bpmCardCadencia.update.mockResolvedValue({});

    const resultado = await processarCadenciasBpm();

    expect(mockDb.bpmCardCadencia.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vinculo1" },
        data: expect.objectContaining({ status: "PAUSADA" }),
      }),
    );
    expect(resultado.processadas).toBe(0);
  });

  it("último passo: vínculo é concluído", async () => {
    const vinculo = makeVinculo({
      passoAtualOrdem: 2,
      cadencia: {
        id: "cad1",
        nome: "Cad",
        ativa: true,
        passos: [
          { id: "passo1", ordem: 1, intervaloDias: 7, titulo: "P1", tipoTarefa: "TAREFA", prioridade: "NORMAL", ativo: true },
          { id: "passo2", ordem: 2, intervaloDias: 14, titulo: "P2", tipoTarefa: "TAREFA", prioridade: "NORMAL", ativo: true },
        ],
      },
    });
    mockDb.bpmCardCadencia.findMany.mockResolvedValue([vinculo]);

    const execucao = { id: "exec1" };
    const tarefa = { id: "tarefa1" };
    mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        bpmCadenciaPassoExecucao: {
          create: vi.fn().mockResolvedValue(execucao),
          update: vi.fn().mockResolvedValue({}),
        },
        bpmTarefa: { create: vi.fn().mockResolvedValue(tarefa) },
        bpmCardCadencia: { update: vi.fn().mockResolvedValue({}) },
        bpmCardHistorico: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const resultado = await processarCadenciasBpm();

    expect(resultado.processadas).toBe(1);
    expect(registrarHistoricoCard).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "CADENCIA_CONCLUIDA" }),
      expect.anything(),
    );
  });
});
