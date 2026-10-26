import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), acesso: vi.fn(), endpoint: vi.fn(), listar: vi.fn() }));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: { bpmWebhookEndpoint: { findUnique: mocks.endpoint } } }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: mocks.acesso }));
vi.mock("@/lib/bpm/webhook-campos-server", () => ({ listarCamposObrigatoriosWebhook: mocks.listar }));

import { ListarCamposObrigatoriosWebhookBpm } from "@/actions/bpm/WebhookCampos";

const endpointId = "cmuijhi6i00000agmrwfktmht";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "7" } });
  mocks.acesso.mockResolvedValue(undefined);
  mocks.endpoint.mockResolvedValue({ pipelineId: "radar", pipeline: { nome: "Revisão de Radar" } });
  mocks.listar.mockResolvedValue([]);
});

describe("consulta administrativa dos campos de webhook", () => {
  it("exige sessão antes de consultar o endpoint", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(await ListarCamposObrigatoriosWebhookBpm(endpointId)).toMatchObject({ success: false });
    expect(mocks.endpoint).not.toHaveBeenCalled();
  });
  it("bloqueia usuário sem permissão administrativa antes de consultar o catálogo", async () => {
    mocks.acesso.mockRejectedValue(new Error("Sem permissão"));
    expect(await ListarCamposObrigatoriosWebhookBpm(endpointId)).toMatchObject({ success: false });
    expect(mocks.endpoint).not.toHaveBeenCalled();
    expect(mocks.listar).not.toHaveBeenCalled();
  });
  it("resolve o pipeline do endpoint sem consultar segredos", async () => {
    expect(await ListarCamposObrigatoriosWebhookBpm(endpointId)).toEqual({ success: true, data: [] });
    expect(mocks.acesso).toHaveBeenCalledWith(7, "configurarEtapas");
    expect(mocks.listar).toHaveBeenCalledWith("radar");
    expect(mocks.endpoint).toHaveBeenCalledWith({ where: { id: endpointId }, select: { pipelineId: true, pipeline: { select: { nome: true } } } });
  });
  it("explica quando o webhook não suporta a API de cards", async () => {
    mocks.endpoint.mockResolvedValue({ pipelineId: "outro", pipeline: { nome: "Financeiro" } });
    expect(await ListarCamposObrigatoriosWebhookBpm(endpointId)).toMatchObject({ success: false });
    expect(mocks.listar).not.toHaveBeenCalled();
  });
});
