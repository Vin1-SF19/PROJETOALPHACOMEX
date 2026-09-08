import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  exigirConfig: vi.fn(),
  etapaFindFirst: vi.fn(),
  cadenciaFindFirst: vi.fn(),
  cadenciaFindUnique: vi.fn(),
  cadenciaCreate: vi.fn(),
  cadenciaUpdate: vi.fn(),
  cadenciaUpdateMany: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoConfigPipeline: mocks.exigirConfig,
  exigirAcessoBpmCard: vi.fn(),
}));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: mocks.transaction,
    bpmCardCadencia: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

import { ConfigurarCadenciaEtapaBpm, CriarCadenciaBpm } from "@/actions/bpm/Cadencias";

const PIPELINE_ID = "clw0000000000000pipeline";
const ETAPA_ID = "clw000000000000000etapa";
const CADENCIA_ID = "clw0000000000000cadencia";

function txMock() {
  return {
    bpmEtapa: { findFirst: mocks.etapaFindFirst },
    bpmCadencia: {
      findFirst: mocks.cadenciaFindFirst,
      findUnique: mocks.cadenciaFindUnique,
      create: mocks.cadenciaCreate,
      update: mocks.cadenciaUpdate,
      updateMany: mocks.cadenciaUpdateMany,
    },
  };
}

describe("actions de cadência por coluna", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    mocks.exigirConfig.mockResolvedValue(undefined);
    mocks.etapaFindFirst.mockResolvedValue({ id: ETAPA_ID });
    mocks.cadenciaFindFirst.mockResolvedValue(null);
    mocks.cadenciaCreate.mockResolvedValue({ id: CADENCIA_ID, pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, ativa: true });
    mocks.cadenciaUpdateMany.mockResolvedValue({ count: 1 });
    mocks.cadenciaUpdate.mockResolvedValue({ id: CADENCIA_ID });
    mocks.transaction.mockImplementation((callback) => callback(txMock()));
  });

  it("autentica antes de consultar ou escrever", async () => {
    mocks.auth.mockResolvedValue(null);
    const resultado = await CriarCadenciaBpm({});
    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejeita criação universal antes de abrir transação", async () => {
    const resultado = await CriarCadenciaBpm({ nome: "Sem coluna", pipelineId: PIPELINE_ID });
    expect(resultado.success).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejeita segunda cadência ativa na mesma coluna sem escrever", async () => {
    mocks.cadenciaFindFirst.mockResolvedValue({ id: "outra" });
    const resultado = await CriarCadenciaBpm({ nome: "Duplicada", pipelineId: PIPELINE_ID, etapaId: ETAPA_ID });
    expect(resultado).toMatchObject({ success: false, error: expect.stringContaining("já possui") });
    expect(mocks.cadenciaCreate).not.toHaveBeenCalled();
  });

  it("configura explicitamente nenhuma cadência para a coluna", async () => {
    const resultado = await ConfigurarCadenciaEtapaBpm({ pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, cadenciaId: null });
    expect(resultado).toEqual({ success: true, data: { cadenciaId: null } });
    expect(mocks.cadenciaUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, ativa: true }),
      data: { ativa: false },
    }));
  });

  it("rejeita cadência pertencente a outro pipeline", async () => {
    mocks.cadenciaFindUnique.mockResolvedValue({ id: CADENCIA_ID, pipelineId: "outro-pipeline", etapaId: "outra-etapa" });
    const resultado = await ConfigurarCadenciaEtapaBpm({ pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, cadenciaId: CADENCIA_ID });
    expect(resultado).toEqual({ success: false, error: "A cadência selecionada pertence a outro pipeline." });
    expect(mocks.cadenciaUpdateMany).not.toHaveBeenCalled();
  });
});
