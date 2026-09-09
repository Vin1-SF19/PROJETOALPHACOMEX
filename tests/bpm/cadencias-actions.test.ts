import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), exigirConfig: vi.fn(), pipelineFindFirst: vi.fn(), etapaFindMany: vi.fn(),
  cadenciaFindUnique: vi.fn(), cadenciaFindUniqueOrThrow: vi.fn(), cadenciaCreate: vi.fn(), cadenciaUpdate: vi.fn(),
  associacaoFindFirst: vi.fn(), associacaoFindUnique: vi.fn(), associacaoFindMany: vi.fn(), associacaoCreate: vi.fn(),
  associacaoCreateMany: vi.fn(), associacaoDelete: vi.fn(), associacaoDeleteMany: vi.fn(), auditoriaCreate: vi.fn(),
  transaction: vi.fn(), revalidatePath: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: mocks.exigirConfig, exigirAcessoBpmCard: vi.fn() }));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { $transaction: mocks.transaction, bpmCardCadencia: { findUnique: vi.fn(), findMany: vi.fn() } } }));

import { AtualizarCadenciaBpm, ConfigurarCadenciaEtapaBpm, CriarCadenciaBpm } from "@/actions/bpm/Cadencias";

const PIPELINE_ID = "clw0000000000000pipeline";
const ETAPA_1 = "clw000000000000000etapa";
const ETAPA_2 = "clw00000000000000etapa2";
const CADENCIA_ID = "clw0000000000000cadencia";

function txMock() {
  return {
    bpmPipeline: { findFirst: mocks.pipelineFindFirst },
    bpmEtapa: { findMany: mocks.etapaFindMany },
    bpmCadencia: { findUnique: mocks.cadenciaFindUnique, findUniqueOrThrow: mocks.cadenciaFindUniqueOrThrow, create: mocks.cadenciaCreate, update: mocks.cadenciaUpdate },
    bpmCadenciaEtapa: {
      findFirst: mocks.associacaoFindFirst, findUnique: mocks.associacaoFindUnique, findMany: mocks.associacaoFindMany,
      create: mocks.associacaoCreate, createMany: mocks.associacaoCreateMany, delete: mocks.associacaoDelete, deleteMany: mocks.associacaoDeleteMany,
    },
    bpmPipelineConfigAuditoria: { create: mocks.auditoriaCreate },
  };
}

describe("actions de cadência multicoluna", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    mocks.exigirConfig.mockResolvedValue(undefined);
    mocks.pipelineFindFirst.mockResolvedValue({ id: PIPELINE_ID });
    mocks.etapaFindMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id, index) => ({ id, ordem: index + 1 })));
    mocks.associacaoFindFirst.mockResolvedValue(null);
    mocks.associacaoFindUnique.mockResolvedValue(null);
    mocks.associacaoFindMany.mockResolvedValue([]);
    mocks.associacaoCreateMany.mockResolvedValue({ count: 0 });
    mocks.associacaoDeleteMany.mockResolvedValue({ count: 0 });
    mocks.cadenciaCreate.mockResolvedValue({ id: CADENCIA_ID });
    mocks.cadenciaUpdate.mockResolvedValue({ id: CADENCIA_ID });
    mocks.cadenciaFindUniqueOrThrow.mockResolvedValue({ id: CADENCIA_ID, pipelineId: PIPELINE_ID, etapaId: ETAPA_1, etapas: [], passos: [] });
    mocks.transaction.mockImplementation((callback) => callback(txMock()));
  });

  it("autentica antes de consultar ou escrever", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await CriarCadenciaBpm({})).toEqual({ success: false, error: "Não autorizado" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejeita IDs duplicados antes da transação", async () => {
    const resultado = await CriarCadenciaBpm({ nome: "Contato", pipelineId: PIPELINE_ID, etapaIds: [ETAPA_1, ETAPA_1] });
    expect(resultado.success).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("cria uma cadência em duas colunas sem escrever o vínculo singular legado", async () => {
    expect((await CriarCadenciaBpm({ nome: "Contato", pipelineId: PIPELINE_ID, etapaIds: [ETAPA_1, ETAPA_2] })).success).toBe(true);
    expect(mocks.cadenciaCreate).toHaveBeenCalledWith({ data: expect.not.objectContaining({ etapaId: expect.anything() }) });
    expect(mocks.associacaoCreateMany).toHaveBeenCalledWith({ data: [
      { cadenciaId: CADENCIA_ID, etapaId: ETAPA_1 }, { cadenciaId: CADENCIA_ID, etapaId: ETAPA_2 },
    ] });
    expect(mocks.auditoriaCreate).toHaveBeenCalledOnce();
  });

  it("rejeita coluna ocupada antes de criar", async () => {
    mocks.associacaoFindFirst.mockResolvedValue({ etapaId: ETAPA_2 });
    const resultado = await CriarCadenciaBpm({ nome: "Duplicada", pipelineId: PIPELINE_ID, etapaIds: [ETAPA_1, ETAPA_2] });
    expect(resultado).toEqual({ success: false, error: "Uma das colunas já pertence a outra cadência." });
    expect(mocks.cadenciaCreate).not.toHaveBeenCalled();
  });

  it("traduz colisão concorrente P2002", async () => {
    mocks.associacaoCreateMany.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicado", { code: "P2002", clientVersion: "test" }));
    const resultado = await CriarCadenciaBpm({ nome: "Concorrente", pipelineId: PIPELINE_ID, etapaIds: [ETAPA_1] });
    expect(resultado).toEqual({ success: false, error: "Uma das colunas já pertence a outra cadência." });
  });

  it("remove parcialmente por diff sem perder a associação mantida", async () => {
    mocks.cadenciaFindUnique.mockResolvedValue({
      id: CADENCIA_ID,
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_1,
      etapas: [{ etapaId: ETAPA_1 }, { etapaId: ETAPA_2 }],
    });
    mocks.associacaoFindMany.mockResolvedValue([{ etapaId: ETAPA_1 }, { etapaId: ETAPA_2 }]);
    const resultado = await AtualizarCadenciaBpm({ id: CADENCIA_ID, etapaIds: [ETAPA_2] });
    expect(resultado.success).toBe(true);
    expect(mocks.associacaoDeleteMany).toHaveBeenCalledWith({
      where: { cadenciaId: CADENCIA_ID, etapaId: { in: [ETAPA_1] } },
    });
    expect(mocks.associacaoCreateMany).not.toHaveBeenCalled();
    expect(mocks.cadenciaUpdate).toHaveBeenCalledWith({
      where: { id: CADENCIA_ID },
      data: { pipelineId: PIPELINE_ID },
    });
  });

  it("remove só a associação e preserva a definição como cadência de entrada do pipeline", async () => {
    mocks.associacaoFindUnique.mockResolvedValue({ cadenciaId: CADENCIA_ID });
    const resultado = await ConfigurarCadenciaEtapaBpm({ pipelineId: PIPELINE_ID, etapaId: ETAPA_1, cadenciaId: null });
    expect(resultado).toEqual({ success: true, data: { cadenciaId: null } });
    expect(mocks.associacaoDelete).toHaveBeenCalledWith({ where: { etapaId: ETAPA_1 } });
    expect(mocks.cadenciaUpdate).not.toHaveBeenCalled();
  });

  it("adiciona a mesma cadência a outra coluna sem remover as existentes", async () => {
    mocks.cadenciaFindUnique.mockResolvedValue({ id: CADENCIA_ID, pipelineId: PIPELINE_ID });
    mocks.associacaoFindMany.mockResolvedValue([
      { cadenciaId: CADENCIA_ID, etapaId: ETAPA_1, etapa: { ordem: 1 } },
      { cadenciaId: CADENCIA_ID, etapaId: ETAPA_2, etapa: { ordem: 2 } },
    ]);
    const resultado = await ConfigurarCadenciaEtapaBpm({ pipelineId: PIPELINE_ID, etapaId: ETAPA_2, cadenciaId: CADENCIA_ID });
    expect(resultado).toEqual({ success: true, data: { cadenciaId: CADENCIA_ID } });
    expect(mocks.associacaoCreate).toHaveBeenCalledWith({ data: { cadenciaId: CADENCIA_ID, etapaId: ETAPA_2 } });
    expect(mocks.associacaoDelete).not.toHaveBeenCalled();
  });

  it("rejeita cadência pertencente a outro pipeline", async () => {
    mocks.cadenciaFindUnique.mockResolvedValue({ id: CADENCIA_ID, pipelineId: "outro-pipeline" });
    const resultado = await ConfigurarCadenciaEtapaBpm({ pipelineId: PIPELINE_ID, etapaId: ETAPA_1, cadenciaId: CADENCIA_ID });
    expect(resultado).toEqual({ success: false, error: "A cadência selecionada pertence a outro pipeline." });
    expect(mocks.associacaoCreate).not.toHaveBeenCalled();
  });
});
