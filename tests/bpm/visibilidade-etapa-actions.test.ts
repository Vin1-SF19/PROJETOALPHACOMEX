import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  exigirConfig: vi.fn(),
  revalidatePath: vi.fn(),
  notificar: vi.fn(),
  pipelineFindUnique: vi.fn(),
  usuariosFindMany: vi.fn(),
  etapaFindUnique: vi.fn(),
  deleteMany: vi.fn(),
  createMany: vi.fn(),
  auditoriaCreate: vi.fn(),
  regrasFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoConfigPipeline: mocks.exigirConfig,
}));
vi.mock("@/lib/bpm/realtime-server", () => ({
  notificarPipelineBpm: mocks.notificar,
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmPipeline: { findUnique: mocks.pipelineFindUnique },
    usuarios: { findMany: mocks.usuariosFindMany },
    bpmEtapa: { findUnique: mocks.etapaFindUnique },
    $transaction: mocks.transaction,
  },
}));

import {
  ListarConfiguracaoVisibilidadePipelineBpm,
  SalvarVisibilidadeEtapaBpm,
} from "@/actions/bpm/VisibilidadeEtapas";

const PIPELINE_ID = "clw0000000000000pipeline";
const ETAPA_ID = "clw000000000000000etapa";

describe("actions de visibilidade por etapa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    mocks.exigirConfig.mockResolvedValue(undefined);
    mocks.usuariosFindMany.mockResolvedValue([
      { role: "Admin" },
      { role: "Líder Comercial" },
      { role: "COMERCIAL" },
    ]);
    mocks.pipelineFindUnique.mockResolvedValue({
      id: PIPELINE_ID,
      etapas: [
        { id: ETAPA_ID, nome: "Novos leads", ordem: 0, visibilidades: [] },
      ],
    });
    mocks.etapaFindUnique.mockResolvedValue({
      pipelineId: PIPELINE_ID,
      visibilidades: [],
    });
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    mocks.createMany.mockResolvedValue({ count: 1 });
    mocks.auditoriaCreate.mockResolvedValue({ id: "audit-1" });
    mocks.regrasFindMany.mockResolvedValue([
      { perfil: "COMERCIAL", podeVer: true, podeAgir: true },
    ]);
    mocks.transaction.mockImplementation(async (callback) => callback({
      bpmEtapaVisibilidade: {
        deleteMany: mocks.deleteMany,
        createMany: mocks.createMany,
        findMany: mocks.regrasFindMany,
      },
      bpmPipelineConfigAuditoria: { create: mocks.auditoriaCreate },
    }));
  });

  it("não enumera perfis ou regras sem autenticação", async () => {
    mocks.auth.mockResolvedValue(null);
    const result = await ListarConfiguracaoVisibilidadePipelineBpm(PIPELINE_ID);
    expect(result).toMatchObject({ success: false, error: "Não autorizado" });
    expect(mocks.pipelineFindUnique).not.toHaveBeenCalled();
  });

  it("lista perfis ativos normalizados sem expor perfis administrativos", async () => {
    const result = await ListarConfiguracaoVisibilidadePipelineBpm(PIPELINE_ID);
    expect(mocks.exigirConfig).toHaveBeenCalledWith(7, "configurarEtapas");
    expect(result).toMatchObject({
      success: true,
      data: {
        perfis: [
          { perfil: "COMERCIAL", nome: "COMERCIAL" },
          { perfil: "LIDERCOMERCIAL", nome: "Líder Comercial" },
        ],
      },
    });
  });

  it("rejeita identificador de pipeline inválido antes de consultar dados", async () => {
    const result = await ListarConfiguracaoVisibilidadePipelineBpm("../pipeline");
    expect(result).toMatchObject({ success: false, error: "Pipeline inválido" });
    expect(mocks.pipelineFindUnique).not.toHaveBeenCalled();
  });

  it("rejeita podeAgir sem podeVer antes de tocar a etapa", async () => {
    const result = await SalvarVisibilidadeEtapaBpm({
      etapaId: ETAPA_ID,
      regras: [{ perfil: "COMERCIAL", podeVer: false, podeAgir: true }],
    });
    expect(result.success).toBe(false);
    expect(mocks.etapaFindUnique).not.toHaveBeenCalled();
  });

  it("substitui regras atomicamente, audita e notifica o pipeline", async () => {
    const result = await SalvarVisibilidadeEtapaBpm({
      etapaId: ETAPA_ID,
      regras: [{ perfil: "comercial", podeVer: true, podeAgir: true }],
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { etapaId: ETAPA_ID } });
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [{
        etapaId: ETAPA_ID,
        perfil: "COMERCIAL",
        podeVer: true,
        podeAgir: true,
      }],
    });
    expect(mocks.auditoriaCreate).toHaveBeenCalled();
    expect(mocks.notificar).toHaveBeenCalledWith({
      pipelineId: PIPELINE_ID,
      tipo: "PIPELINE_ALTERADO",
    });
    expect(result).toMatchObject({ success: true, data: [{ perfil: "COMERCIAL" }] });
  });
});
