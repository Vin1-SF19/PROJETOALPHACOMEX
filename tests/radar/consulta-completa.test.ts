import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ receita: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/cnpj/receita-federal", () => ({ getReceitaData: mocks.receita }));
vi.mock("@/lib/prisma", () => ({ default: { consultas_radar: { findUnique: mocks.findUnique, upsert: mocks.upsert } } }));

import { GET } from "@/app/api/ConsultaCompleta/route";

const cnpj = "33000167000101";
const request = () => new Request(`http://localhost/api/ConsultaCompleta?cnpj=${cnpj}&forcar=true`);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CONSULTA_RADAR_TOKEN = "token-de-teste";
  mocks.receita.mockResolvedValue({ razaoSocial: "PETROBRAS", nomeFantasia: "", municipio: "RIO", uf: "RJ" });
  mocks.findUnique.mockResolvedValue(null);
  mocks.upsert.mockImplementation(async ({ create }) => create);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CONSULTA_RADAR_TOKEN;
});

describe("ConsultaCompleta com API Radar Alpha", () => {
  it("grava modalidade, data brasileira e raw sem enviar CNPJ completo ao provedor", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      success: true, cnpj: "33000167", data: { cnpj: "33000167", razaoSocial: "PETROLEO BRASILEIRO", situacao: "Habilitada", modalidade: "Ilimitada", dataSituacao: "09/12/2021 10:36:07" }, raw: "resultado integral",
    }) });
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request());
    expect(response.status).toBe(200);
    const salvo = mocks.upsert.mock.calls[0][0].create;
    expect(salvo).toMatchObject({ cnpj, situacao_radar: "HABILITADA", submodalidade: "Ilimitada", contribuinte: "PETROLEO BRASILEIRO" });
    expect(salvo.data_situacao).toContain("2021-12-09");
    expect(JSON.parse(salvo.json_completo).radar.raw).toBe("resultado integral");
    expect(fetchMock.mock.calls[0][0]).toBe("https://consulta-radar.alpha-comex.com/consultar/33000167");
  });

  it("interpreta 404 como não habilitada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.upsert.mock.calls[0][0].create.situacao_radar).toBe("NÃO HABILITADA");
  });

  it("preserva registro existente quando captcha bloqueia a consulta", async () => {
    mocks.findUnique.mockResolvedValue({ razao_social: "PETROBRAS" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({ code: "BLOCKED_BY_CAPTCHA" }) }));
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "BLOCKED_BY_CAPTCHA" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
