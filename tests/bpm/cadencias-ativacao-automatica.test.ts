import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { $transaction: vi.fn() } }));

import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { ativarCadenciasNaEntradaBpm, chaveExecucaoCicloCadencia } from "@/lib/bpm/cadencias/ativacao-automatica";

function criarTx(params?: {
  cadencias?: Array<{ id: string; nome: string; passos: Array<{ ordem: number; intervaloDias: number }> }>;
  vinculos?: Array<
    | { id: string; cadencia: { pipelineId: string | null; etapaId: string | null; nome: string } }
    | { id: string; cadenciaId: string; status: string; passoAtualOrdem: number }
  >;
  existente?: { id: string; status: string } | null;
}) {
  return {
    bpmEtapa: { findFirst: vi.fn().mockResolvedValue({ id: "etapa-destino" }) },
    bpmCard: { findFirst: vi.fn().mockResolvedValue({ id: "card-1" }) },
    bpmCadencia: { findMany: vi.fn().mockResolvedValue(params?.cadencias ?? []) },
    bpmCardCadencia: {
      findMany: vi.fn().mockResolvedValue(params?.vinculos ?? []),
      findUnique: vi.fn().mockResolvedValue(params?.existente ?? null),
      create: vi.fn().mockResolvedValue({ id: "vinculo-novo" }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

const entradaEtapa = {
  cardId: "card-1",
  pipelineAnteriorId: "pipeline-1",
  etapaAnteriorId: "etapa-anterior",
  pipelineDestinoId: "pipeline-1",
  etapaDestinoId: "etapa-destino",
  evento: "CARD_MOVIDO" as const,
  agora: new Date("2026-09-08T12:00:00.000Z"),
};

beforeEach(() => vi.clearAllMocks());

describe("ativarCadenciasNaEntradaBpm", () => {
  it("resolve somente a única cadência ativa da etapa exata", async () => {
    const tx = criarTx({ cadencias: [{ id: "cad-1", nome: "Cadência 1", passos: [{ ordem: 1, intervaloDias: 2 }] }] });
    const resultado = await ativarCadenciasNaEntradaBpm(entradaEtapa, tx as never);
    expect(resultado).toMatchObject({ alteradas: 1, criadas: 1, reativadas: 0 });
    expect(tx.bpmCadencia.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ pipelineId: "pipeline-1", etapaId: "etapa-destino", ativa: true }),
      take: 2,
    }));
    expect(tx.bpmCardCadencia.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      cardId: "card-1", cadenciaId: "cad-1", proximaExecucaoEm: new Date("2026-09-10T12:00:00.000Z"),
    }) });
  });

  it("aceita coluna sem cadência como estado normal", async () => {
    const tx = criarTx();
    const resultado = await ativarCadenciasNaEntradaBpm(entradaEtapa, tx as never);
    expect(resultado).toMatchObject({ alteradas: 0, criadas: 0 });
    expect(tx.bpmCardCadencia.create).not.toHaveBeenCalled();
  });

  it("cancela vínculo legado sem etapa e não o usa como fallback", async () => {
    const tx = criarTx({ vinculos: [{ id: "v-legado", cadencia: { pipelineId: "pipeline-1", etapaId: null, nome: "Legada" } }] });
    const resultado = await ativarCadenciasNaEntradaBpm(entradaEtapa, tx as never);
    expect(resultado).toMatchObject({ alteradas: 1, canceladas: 1, criadas: 0 });
    expect(tx.bpmCardCadencia.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "v-legado" }),
      data: expect.objectContaining({ status: "CANCELADA", proximaExecucaoEm: null }),
    }));
    expect(registrarHistoricoCard).toHaveBeenCalledTimes(1);
  });

  it("não escolhe silenciosamente quando há duas cadências ativas na coluna", async () => {
    const tx = criarTx({ cadencias: [
      { id: "cad-1", nome: "Cadência 1", passos: [{ ordem: 1, intervaloDias: 1 }] },
      { id: "cad-2", nome: "Cadência 2", passos: [{ ordem: 1, intervaloDias: 1 }] },
    ] });
    const resultado = await ativarCadenciasNaEntradaBpm(entradaEtapa, tx as never);
    expect(resultado.criadas).toBe(0);
    expect(tx.bpmCardCadencia.create).not.toHaveBeenCalled();
  });

  it("revalida o card na etapa para tolerar corrida pós-movimento", async () => {
    const tx = criarTx();
    tx.bpmCard.findFirst.mockResolvedValue(null);
    const resultado = await ativarCadenciasNaEntradaBpm(entradaEtapa, tx as never);
    expect(resultado.alteradas).toBe(0);
    expect(tx.bpmCadencia.findMany).not.toHaveBeenCalled();
  });

  it("reativa apenas legado pausado e preserva estados ativos ou terminais", async () => {
    const tx = criarTx({
      cadencias: [{ id: "cad-pausada", nome: "Pausada", passos: [{ ordem: 2, intervaloDias: 4 }] }],
      existente: { id: "v-1", status: "PAUSADA" },
    });

    const resultado = await ativarCadenciasNaEntradaBpm(entradaEtapa, tx as never);

    expect(resultado).toMatchObject({ alteradas: 1, criadas: 0, reativadas: 1 });
    expect(tx.bpmCardCadencia.update).toHaveBeenCalledTimes(1);
    expect(tx.bpmCardCadencia.create).not.toHaveBeenCalled();
    expect(registrarHistoricoCard).toHaveBeenCalledWith(expect.objectContaining({ acao: "CADENCIA_REATIVADA" }), tx);
  });

  it("trata P2002 tipado como retry idempotente sem histórico duplicado", async () => {
    const tx = criarTx({ cadencias: [{ id: "cad-1", nome: "Cadência", passos: [{ ordem: 1, intervaloDias: 1 }] }] });
    tx.bpmCardCadencia.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicado", {
      code: "P2002",
      clientVersion: "test",
    }));

    const resultado = await ativarCadenciasNaEntradaBpm(entradaEtapa, tx as never);

    expect(resultado.alteradas).toBe(0);
    expect(registrarHistoricoCard).not.toHaveBeenCalled();
  });

  it("gera chave idempotente por ciclo de entrada", () => {
    expect(chaveExecucaoCicloCadencia({
      vinculoId: "v-1", passoId: "p-1",
      iniciadaEm: new Date("2026-09-08T12:00:00.000Z"),
      createdAt: new Date("2026-09-01T12:00:00.000Z"),
    })).toBe("v-1:p-1:2026-09-08T12:00:00.000Z");
  });
});
