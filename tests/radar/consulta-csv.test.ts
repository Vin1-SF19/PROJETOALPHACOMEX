import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ access: vi.fn(), radar: vi.fn() }));
vi.mock("@/lib/pre-analise/access", () => ({ requirePreAnaliseAccess: mocks.access }));
vi.mock("@/lib/radar/consulta", () => ({
  consultarRadar: mocks.radar,
  ErroConsultaRadar: class ErroConsultaRadar extends Error {
    constructor(public status: number, public code: string, message: string) { super(message); }
  },
}));

import { GET } from "@/app/api/ConsultaRadarCsv/route";

const radar = {
  cnpj: "33000167", razaoSocial: "EMPRESA TESTE LTDA", contribuinte: "EMPRESA TESTE LTDA",
  situacao: "HABILITADA", modalidade: "ILIMITADA", submodalidade: "ILIMITADA", dataSituacao: "",
  baseLegal: "", tipoDesabilitacao: "", operacoesAutorizadas: "", raw: "",
  dataAtualizacaoPublicada: "08/10/2026 16h13", consultadoEm: "2026-10-22T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue(null);
  mocks.radar.mockResolvedValue(radar);
});

describe("proxy protegido da consulta RADAR CSV", () => {
  it("usa o cliente server-side da API ialpha e devolve o formato de consulta CSV", async () => {
    const response = await GET(new Request("http://localhost/api/ConsultaRadarCsv?cnpj=33000167000101"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ found: true, cnpjBase: "33000167", razaoSocial: "EMPRESA TESTE LTDA", modalidade: "ILIMITADA", dataAtualizacaoPublicada: "08/10/2026 16h13" });
    expect(mocks.radar).toHaveBeenCalledWith("33000167000101");
  });

  it("comunica ausência sem classificar como desabilitação", async () => {
    mocks.radar.mockResolvedValueOnce({ ...radar, razaoSocial: "", contribuinte: "", situacao: "NÃO CONSTA NO ARQUIVO CONSULTADO" });
    const response = await GET(new Request("http://localhost/api/ConsultaRadarCsv?cnpj=33000167"));
    expect(await response.json()).toMatchObject({ found: false, mensagem: "não consta no arquivo consultado" });
  });

  it("reutiliza o bloqueio de acesso existente", async () => {
    mocks.access.mockResolvedValueOnce(NextResponse.json({ error: "Não autenticado" }, { status: 401 }));
    expect((await GET(new Request("http://localhost/api/ConsultaRadarCsv?cnpj=33000167"))).status).toBe(401);
    expect(mocks.radar).not.toHaveBeenCalled();
  });
});
