import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const exigirAcessoConfigPipelineMock = vi.hoisted(() => vi.fn());
const notificarPipelineBpmMock = vi.hoisted(() => vi.fn());
const etapaFindUniqueMock = vi.hoisted(() => vi.fn());
const etapaUpdateMock = vi.hoisted(() => vi.fn());
const auditoriaCreateMock = vi.hoisted(() => vi.fn());
const transactionMock = vi.hoisted(() => vi.fn(async (callback) => callback({
  bpmEtapa: { update: etapaUpdateMock },
  bpmPipelineConfigAuditoria: { create: auditoriaCreateMock },
})));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: transactionMock,
    bpmEtapa: { findUnique: etapaFindUniqueMock },
  },
}));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: exigirAcessoConfigPipelineMock }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: notificarPipelineBpmMock }));

import { SalvarScriptEtapaBpm } from "@/actions/bpm/Conhecimento";
import { serializarScriptEtapa } from "@/lib/bpm/script-etapa";

const PIPELINE_ID = "clxpipeline0000000000000001";
const OUTRO_PIPELINE_ID = "clxpipeline0000000000000002";
const ETAPA_ID = "clxetapa000000000000000001";
const SCRIPT = serializarScriptEtapa(
  { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Olá" }] }] },
  "Olá",
);

describe("Conhecimento.ts — gerenciador de scripts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
    exigirAcessoConfigPipelineMock.mockResolvedValue(undefined);
    etapaFindUniqueMock.mockResolvedValue({ id: ETAPA_ID, pipelineId: PIPELINE_ID, script: null });
    etapaUpdateMock.mockResolvedValue({ id: ETAPA_ID });
    auditoriaCreateMock.mockResolvedValue({ id: "auditoria-1" });
    notificarPipelineBpmMock.mockResolvedValue(undefined);
  });

  it("rejeita escrita sem sessão antes de consultar a etapa", async () => {
    authMock.mockResolvedValue(null);

    const resposta = await SalvarScriptEtapaBpm({ pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, script: SCRIPT });

    expect(resposta).toEqual({ success: false, error: "Não autorizado" });
    expect(etapaFindUniqueMock).not.toHaveBeenCalled();
  });

  it("exige permissão de configuração antes de consultar a etapa", async () => {
    exigirAcessoConfigPipelineMock.mockRejectedValue(
      new Error("Não autorizado — apenas administradores configuram pipelines"),
    );

    const resposta = await SalvarScriptEtapaBpm({ pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, script: SCRIPT });

    expect(resposta.success).toBe(false);
    expect(exigirAcessoConfigPipelineMock).toHaveBeenCalledWith(1, "configurarEtapas");
    expect(etapaFindUniqueMock).not.toHaveBeenCalled();
  });

  it("bloqueia etapa que não pertence ao pipeline informado", async () => {
    etapaFindUniqueMock.mockResolvedValue({ id: ETAPA_ID, pipelineId: OUTRO_PIPELINE_ID, script: null });

    const resposta = await SalvarScriptEtapaBpm({ pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, script: SCRIPT });

    expect(resposta).toEqual({ success: false, error: "Etapa não encontrada neste pipeline" });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejeita conteúdo fora do formato estruturado", async () => {
    const resposta = await SalvarScriptEtapaBpm({ pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, script: "<script>alert(1)</script>" });

    expect(resposta).toEqual({ success: false, error: "Revise o conteúdo informado." });
    expect(etapaFindUniqueMock).not.toHaveBeenCalled();
  });

  it("salva, audita, revalida e notifica o script da etapa", async () => {
    const resposta = await SalvarScriptEtapaBpm({ pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, script: SCRIPT });

    expect(resposta).toEqual({ success: true });
    expect(etapaUpdateMock).toHaveBeenCalledWith({ where: { id: ETAPA_ID }, data: { script: SCRIPT } });
    expect(auditoriaCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pipelineId: PIPELINE_ID,
        adminId: 1,
        campoAlterado: "script_etapa_atualizado",
      }),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/PainelAlpha/AlphaCRM/admin/conhecimento");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/PainelAlpha/AlphaCRM/pipeline/${PIPELINE_ID}`);
    expect(notificarPipelineBpmMock).toHaveBeenCalledWith({ pipelineId: PIPELINE_ID, tipo: "ETAPA_ALTERADA" });
  });

  it("permite limpar o script", async () => {
    const resposta = await SalvarScriptEtapaBpm({ pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, script: null });

    expect(resposta).toEqual({ success: true });
    expect(etapaUpdateMock).toHaveBeenCalledWith({ where: { id: ETAPA_ID }, data: { script: null } });
  });
});
