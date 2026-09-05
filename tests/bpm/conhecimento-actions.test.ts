import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const exigirAcessoConfigPipelineMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  bpmPipeline: { findUnique: vi.fn() },
  bpmPipelineConhecimentoLink: { create: vi.fn(), delete: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: exigirAcessoConfigPipelineMock }));

import { CriarConhecimentoLinkBpm, ExcluirConhecimentoLinkBpm, ListarConhecimentoLinksBpm } from "@/actions/bpm/Conhecimento";

const PIPELINE_ID = "clxpipeline0000000000000001";

describe("Conhecimento.ts — Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
    exigirAcessoConfigPipelineMock.mockResolvedValue(undefined);
    prismaMock.bpmPipeline.findUnique.mockResolvedValue({ id: PIPELINE_ID });
  });

  it("ListarConhecimentoLinksBpm rejeita sem sessão", async () => {
    authMock.mockResolvedValue(null);

    const resposta = await ListarConhecimentoLinksBpm(PIPELINE_ID);

    expect(resposta).toEqual({ success: false, error: "Não autorizado", data: [] });
  });

  it("cria um link válido", async () => {
    prismaMock.bpmPipelineConhecimentoLink.create.mockResolvedValue({ id: "clxlink00000000000000000001" });

    const resposta = await CriarConhecimentoLinkBpm({ pipelineId: PIPELINE_ID, titulo: "Manual", url: "https://example.com/manual" });

    expect(resposta).toEqual({ success: true, data: { id: "clxlink00000000000000000001" } });
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("rejeita URL inválida", async () => {
    const resposta = await CriarConhecimentoLinkBpm({ pipelineId: PIPELINE_ID, titulo: "Manual", url: "nao-e-uma-url" });

    expect(resposta.success).toBe(false);
    expect(prismaMock.bpmPipelineConhecimentoLink.create).not.toHaveBeenCalled();
  });

  it("rejeita pipeline inexistente", async () => {
    prismaMock.bpmPipeline.findUnique.mockResolvedValue(null);

    const resposta = await CriarConhecimentoLinkBpm({ pipelineId: PIPELINE_ID, titulo: "Manual", url: "https://example.com" });

    expect(resposta).toEqual({ success: false, error: "Pipeline inválido" });
  });

  it("exclui um link existente", async () => {
    prismaMock.bpmPipelineConhecimentoLink.findUnique.mockResolvedValue({ id: "clxlink00000000000000000001", pipelineId: PIPELINE_ID });

    const resposta = await ExcluirConhecimentoLinkBpm({ id: "clxlink00000000000000000001" });

    expect(resposta).toEqual({ success: true });
    expect(prismaMock.bpmPipelineConhecimentoLink.delete).toHaveBeenCalledWith({ where: { id: "clxlink00000000000000000001" } });
  });

  it("retorna erro amigável ao excluir link inexistente", async () => {
    prismaMock.bpmPipelineConhecimentoLink.findUnique.mockResolvedValue(null);

    const resposta = await ExcluirConhecimentoLinkBpm({ id: "clxlink00000000000000000001" });

    expect(resposta).toEqual({ success: false, error: "Link não encontrado" });
  });
});
