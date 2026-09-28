import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, acessoPipeline, consultar, pipeline } = vi.hoisted(() => ({
  authMock: vi.fn(), acessoPipeline: vi.fn(), consultar: vi.fn(), pipeline: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ default: { bpmPipeline: { findUnique: pipeline } } }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmPipeline: acessoPipeline,
  exigirAcessoModuloBpm: vi.fn(),
  usuarioElegivelResponsavelBpm: vi.fn(),
}));
vi.mock("@/lib/bpm/consulta-cnpj-lead", () => ({ consultarEGuardarCnpjLead: consultar }));

import { ConsultarDadosCnpjNovoLeadBpm } from "@/actions/bpm/CardsConsultas";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "42" } });
  acessoPipeline.mockResolvedValue(undefined);
  pipeline.mockResolvedValue({ ativo: true, nome: "Revisão de Radar" });
  consultar.mockResolvedValue({ cadastro: null, falhas: [], radarSituacao: null });
});

describe("ConsultarDadosCnpjNovoLeadBpm", () => {
  it("nega sessão ausente sem consultar dados externos", async () => {
    authMock.mockResolvedValue(null);
    expect(await ConsultarDadosCnpjNovoLeadBpm("pipeline", "11222333000181"))
      .toMatchObject({ success: false, error: "Não autorizado" });
    expect(consultar).not.toHaveBeenCalled();
  });

  it("rejeita CNPJ inválido antes da consulta", async () => {
    expect(await ConsultarDadosCnpjNovoLeadBpm("pipeline", "123"))
      .toMatchObject({ success: false, error: "CNPJ inválido" });
    expect(acessoPipeline).not.toHaveBeenCalled();
    expect(consultar).not.toHaveBeenCalled();
  });

  it("nega pipeline sem acesso, inativo ou de outro módulo", async () => {
    acessoPipeline.mockRejectedValueOnce(new Error("Não autorizado"));
    expect((await ConsultarDadosCnpjNovoLeadBpm("pipeline", "11222333000181")).success).toBe(false);
    pipeline.mockResolvedValueOnce({ ativo: false, nome: "Revisão de Radar" });
    expect((await ConsultarDadosCnpjNovoLeadBpm("pipeline", "11222333000181")).success).toBe(false);
    pipeline.mockResolvedValueOnce({ ativo: true, nome: "Financeiro" });
    expect((await ConsultarDadosCnpjNovoLeadBpm("pipeline", "11222333000181")).success).toBe(false);
    expect(consultar).not.toHaveBeenCalled();
  });

  it("consulta apenas no pipeline Radar ativo e autorizado", async () => {
    const resultado = await ConsultarDadosCnpjNovoLeadBpm("pipeline", "11.222.333/0001-81");
    expect(resultado.success).toBe(true);
    expect(acessoPipeline).toHaveBeenCalledWith("pipeline", 42);
    expect(consultar).toHaveBeenCalledWith("11222333000181");
  });
});
