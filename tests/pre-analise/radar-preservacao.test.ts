import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), find: vi.fn(), update: vi.fn() }));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/pre-analise/access", () => ({ canAccessPreAnalise: mocks.access }));
vi.mock("@/lib/prisma", () => ({ default: { consultaPreAnalise: { findUnique: mocks.find, update: mocks.update } } }));
import { atualizarRadar } from "@/actions/PreAnalise";

beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "1" } }); mocks.access.mockResolvedValue(true);
  mocks.find.mockResolvedValue({ submodalidade: "ILIMITADA", dadosBrutos: { radar: {
    dados: { situacao: "HABILITADA", submodalidade: "ILIMITADA" }, consultadoEm: "2026-10-01T12:00:00Z",
  }, rfb: { dados: { razaoSocial: "Empresa de teste" } } } });
  mocks.update.mockResolvedValue({});
});

describe("preservação do snapshot RADAR na Pré-Análise", () => {
  it.each([
    { situacao: "NÃO CONSTA NO ARQUIVO CONSULTADO", submodalidade: "" },
    { error: "Não encontrado", code: "NOT_FOUND" },
    { error: "Indisponível", code: "UPSTREAM_UNAVAILABLE" },
    { situacao: "HABILITADA", submodalidade: "LIMITADA", fonteHistorica: "legado" },
    { situacao: "HABILITADA", submodalidade: "LIMITADA", consultadoEmHistorico: "2026-09-01T12:00:00Z" },
    {},
  ])("não grava consulta inconclusiva ou histórico: %j", async dados => {
    expect(await atualizarRadar("33000167000101", dados)).toEqual({ success: true, preservado: true });
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.find).not.toHaveBeenCalled();
  });
  it.each(["HABILITADA", "NÃO HABILITADA"])("persiste situação confirmada %s e mantém outras fontes", async situacao => {
    expect(await atualizarRadar("33000167000101", { situacao, submodalidade: "LIMITADA" })).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: {
      submodalidade: "LIMITADA", dadosBrutos: expect.objectContaining({ rfb: { dados: { razaoSocial: "Empresa de teste" } },
        radar: { dados: { situacao, submodalidade: "LIMITADA" }, consultadoEm: expect.any(String) } }),
    } }));
  });
  it("mantém a autorização antes do guard de preservação", async () => {
    mocks.access.mockResolvedValue(false);
    expect(await atualizarRadar("33000167000101", { code: "NOT_FOUND" })).toEqual({ error: "Não autorizado" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
