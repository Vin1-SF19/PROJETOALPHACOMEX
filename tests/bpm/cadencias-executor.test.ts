import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    bpmCardCadencia: { findMany: vi.fn(), update: vi.fn() },
    bpmCadenciaPassoExecucao: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));

import db from "@/lib/prisma";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { processarCadenciasBpm } from "@/lib/bpm/cadencias/executor";

const mockDb = db as unknown as {
  bpmCardCadencia: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  bpmCadenciaPassoExecucao: { updateMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

function vinculo(overrides: Record<string, unknown> = {}) {
  return {
    id: "v-1", cardId: "card-1", cadenciaId: "cad-1", status: "ATIVA",
    passoAtualOrdem: 1, proximaExecucaoEm: new Date("2026-01-01"),
    iniciadaEm: new Date("2026-01-01T00:00:00.000Z"), createdAt: new Date("2026-01-01T00:00:00.000Z"),
    card: { id: "card-1", pipelineId: "pipe-1", etapaId: "etapa-atual", status: "ATIVO", responsavelId: 1 },
    cadencia: {
      id: "cad-1", nome: "Cadência", ativa: true, pipelineId: "pipe-1", etapaId: "etapa-entrada",
      passos: [
        { id: "p-1", ordem: 1, intervaloDias: 0, titulo: "Contato", tipoTarefa: "TAREFA", prioridade: "NORMAL", ativo: true },
        { id: "p-2", ordem: 2, intervaloDias: 2, titulo: "Retorno", tipoTarefa: "EMAIL", prioridade: "NORMAL", ativo: true },
      ],
    },
    ...overrides,
  };
}

function executarTx(v: ReturnType<typeof vinculo>, opcoes?: { p2002?: boolean; falhaTarefa?: boolean; cadenciaAtiva?: boolean }) {
  const tarefa = { id: "tarefa-1" };
  const tx = {
    bpmCard: { findUnique: vi.fn().mockResolvedValue(v.card) },
    bpmCadencia: { findUnique: vi.fn().mockResolvedValue({ ativa: opcoes?.cadenciaAtiva ?? true }) },
    bpmCadenciaPassoExecucao: {
      create: opcoes?.p2002
        ? vi.fn().mockRejectedValue(Object.assign(new Error("duplicada"), { code: "P2002" }))
        : vi.fn().mockResolvedValue({ id: "exec-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    bpmTarefa: {
      create: opcoes?.falhaTarefa ? vi.fn().mockRejectedValue(new Error("DB error")) : vi.fn().mockResolvedValue(tarefa),
    },
    bpmCardCadencia: { update: vi.fn().mockResolvedValue({}) },
  };
  mockDb.$transaction.mockImplementation(async (fn: (client: unknown) => Promise<void>) => fn(tx));
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.bpmCardCadencia.findMany.mockResolvedValue([]);
});

describe("processarCadenciasBpm", () => {
  it("busca apenas vínculos de definições ativas", async () => {
    await processarCadenciasBpm();
    expect(mockDb.bpmCardCadencia.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "ATIVA", cadencia: { ativa: true } }),
    }));
    expect(mockDb.bpmCardCadencia.update).not.toHaveBeenCalled();
  });

  it("continua a cadência depois que o card sai da etapa de entrada", async () => {
    const v = vinculo();
    mockDb.bpmCardCadencia.findMany.mockResolvedValue([v]);
    const tx = executarTx(v);

    const resultado = await processarCadenciasBpm();

    expect(resultado).toMatchObject({ processadas: 1, falhas: 0 });
    expect(tx.bpmTarefa.create).toHaveBeenCalledTimes(1);
    expect(mockDb.bpmCardCadencia.update).not.toHaveBeenCalled();
    expect(registrarHistoricoCard).toHaveBeenCalledWith(expect.objectContaining({ acao: "CADENCIA_PASSO_EXECUTADO" }), tx);
    expect(notificarPipelineBpm).toHaveBeenCalledWith({ pipelineId: "pipe-1", tipo: "TAREFA_ALTERADA" });
  });

  it("trata retry P2002 como idempotente sem duplicar tarefa", async () => {
    const v = vinculo();
    mockDb.bpmCardCadencia.findMany.mockResolvedValue([v]);
    const tx = executarTx(v, { p2002: true });
    const resultado = await processarCadenciasBpm();
    expect(resultado).toMatchObject({ processadas: 1, falhas: 0 });
    expect(tx.bpmTarefa.create).not.toHaveBeenCalled();
    expect(resultado.avisos.join(" ")).toContain("idempotente");
  });

  it("marca execução intermediária como falha", async () => {
    const v = vinculo();
    mockDb.bpmCardCadencia.findMany.mockResolvedValue([v]);
    executarTx(v, { falhaTarefa: true });
    mockDb.bpmCadenciaPassoExecucao.updateMany.mockResolvedValue({ count: 1 });
    const resultado = await processarCadenciasBpm();
    expect(resultado.falhas).toBe(1);
    expect(mockDb.bpmCadenciaPassoExecucao.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { vinculoId: "v-1", status: "EM_EXECUCAO" }, data: expect.objectContaining({ status: "FALHA" }),
    }));
  });

  it("cancela somente quando o card deixou de estar ativo", async () => {
    const v = vinculo({ card: { id: "card-1", pipelineId: "pipe-1", etapaId: "outra", status: "FECHADO", responsavelId: 1 } });
    mockDb.bpmCardCadencia.findMany.mockResolvedValue([v]);
    mockDb.bpmCardCadencia.update.mockResolvedValue({});
    const resultado = await processarCadenciasBpm();
    expect(resultado).toMatchObject({ processadas: 0, falhas: 0 });
    expect(mockDb.bpmCardCadencia.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CANCELADA" }) }));
  });

  it("ignora definição desativada durante a transação sem pausar o vínculo", async () => {
    const v = vinculo();
    mockDb.bpmCardCadencia.findMany.mockResolvedValue([v]);
    executarTx(v, { cadenciaAtiva: false });
    const resultado = await processarCadenciasBpm();
    expect(resultado).toMatchObject({ processadas: 0, falhas: 0 });
    expect(resultado.avisos.join(" ")).toContain("definição inativa");
    expect(mockDb.bpmCardCadencia.update).not.toHaveBeenCalled();
  });

  it("conclui o vínculo no último passo", async () => {
    const base = vinculo();
    const v = vinculo({ passoAtualOrdem: 2, cadencia: { ...base.cadencia } });
    mockDb.bpmCardCadencia.findMany.mockResolvedValue([v]);
    const tx = executarTx(v);
    const resultado = await processarCadenciasBpm();
    expect(resultado.processadas).toBe(1);
    expect(tx.bpmCardCadencia.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CONCLUIDA" }) }));
    expect(registrarHistoricoCard).toHaveBeenCalledWith(expect.objectContaining({ acao: "CADENCIA_CONCLUIDA" }), tx);
  });
});
