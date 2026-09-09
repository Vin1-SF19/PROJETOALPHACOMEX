import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { $transaction: vi.fn() } }));

import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { ativarCadenciasNaEntradaBpm, chaveExecucaoCicloCadencia } from "@/lib/bpm/cadencias/ativacao-automatica";

type Cadencia = { id: string; nome: string; passos: Array<{ ordem: number; intervaloDias: number }> };
type Vinculo = { id: string; cadenciaId: string; status: string };

function criarTx(params?: { cadencias?: Cadencia[]; vinculos?: Vinculo[] }) {
  return {
    bpmEtapa: { findFirst: vi.fn().mockResolvedValue({ id: "etapa-destino" }) },
    bpmCard: { findFirst: vi.fn().mockResolvedValue({ id: "card-1" }) },
    bpmCadencia: { findMany: vi.fn().mockResolvedValue(params?.cadencias ?? []) },
    bpmCardCadencia: {
      findMany: vi.fn().mockResolvedValue(params?.vinculos ?? []),
      create: vi.fn().mockResolvedValue({ id: "vinculo-novo" }),
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
  it("ativa todas as cadências da etapa e agenda o primeiro passo", async () => {
    const tx = criarTx({ cadencias: [
      { id: "cad-1", nome: "Cadência 1", passos: [{ ordem: 1, intervaloDias: 2 }] },
      { id: "cad-2", nome: "Cadência 2", passos: [{ ordem: 3, intervaloDias: 0 }] },
    ] });

    const resultado = await ativarCadenciasNaEntradaBpm(entradaEtapa, tx as never);

    expect(resultado).toMatchObject({ alteradas: 2, criadas: 2, reativadas: 0, cadenciaIds: ["cad-1", "cad-2"] });
    expect(tx.bpmCadencia.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        pipelineId: "pipeline-1",
        OR: [{ etapas: { some: { etapaId: "etapa-destino" } } }],
      }),
    }));
    expect(tx.bpmCardCadencia.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({
      cadenciaId: "cad-1", proximaExecucaoEm: new Date("2026-09-10T12:00:00.000Z"),
    }) });
    expect(registrarHistoricoCard).toHaveBeenCalledTimes(2);
  });

  it("inclui cadência de pipeline somente numa entrada real no pipeline", async () => {
    const tx = criarTx({ cadencias: [{ id: "cad-pipeline", nome: "Pipeline", passos: [{ ordem: 1, intervaloDias: 1 }] }] });
    await ativarCadenciasNaEntradaBpm({ ...entradaEtapa, pipelineAnteriorId: "pipeline-anterior" }, tx as never);
    expect(tx.bpmCadencia.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { etapas: { some: { etapaId: "etapa-destino" } } },
          { etapaId: null, etapas: { none: {} } },
        ],
      }),
    }));
  });

  it("ignora atualização sem entrada em uma nova etapa", async () => {
    const tx = criarTx();
    const resultado = await ativarCadenciasNaEntradaBpm({ ...entradaEtapa, etapaAnteriorId: "etapa-destino" }, tx as never);
    expect(resultado.alteradas).toBe(0);
    expect(tx.bpmEtapa.findFirst).not.toHaveBeenCalled();
  });

  it("reativa apenas vínculo pausado e preserva ativo, concluído e cancelado", async () => {
    const cadencias = ["pausada", "ativa", "concluida", "cancelada"].map((id) => ({
      id, nome: id, passos: [{ ordem: 1, intervaloDias: 1 }],
    }));
    const tx = criarTx({
      cadencias,
      vinculos: [
        { id: "v-p", cadenciaId: "pausada", status: "PAUSADA" },
        { id: "v-a", cadenciaId: "ativa", status: "ATIVA" },
        { id: "v-c", cadenciaId: "concluida", status: "CONCLUIDA" },
        { id: "v-x", cadenciaId: "cancelada", status: "CANCELADA" },
      ],
    });

    const resultado = await ativarCadenciasNaEntradaBpm(entradaEtapa, tx as never);

    expect(resultado).toMatchObject({ alteradas: 1, criadas: 0, reativadas: 1, cadenciaIds: ["pausada"] });
    expect(tx.bpmCardCadencia.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "v-p", status: "PAUSADA" }, data: expect.objectContaining({ status: "ATIVA" }),
    }));
    expect(tx.bpmCardCadencia.create).not.toHaveBeenCalled();
  });

  it("revalida destino e estado atual do card dentro da transação", async () => {
    const tx = criarTx();
    tx.bpmCard.findFirst.mockResolvedValue(null);
    const resultado = await ativarCadenciasNaEntradaBpm(entradaEtapa, tx as never);
    expect(resultado.alteradas).toBe(0);
    expect(tx.bpmCadencia.findMany).not.toHaveBeenCalled();

    tx.bpmEtapa.findFirst.mockResolvedValue(null);
    await expect(ativarCadenciasNaEntradaBpm(entradaEtapa, tx as never)).rejects.toThrow("CADENCIA_DESTINO_INVALIDO");
  });

  it("trata P2002 tipado como retry idempotente sem histórico duplicado", async () => {
    const tx = criarTx({ cadencias: [{ id: "cad-1", nome: "Cadência", passos: [{ ordem: 1, intervaloDias: 1 }] }] });
    tx.bpmCardCadencia.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicado", {
      code: "P2002", clientVersion: "test",
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
