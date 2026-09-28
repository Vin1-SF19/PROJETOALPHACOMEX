import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  receita: vi.fn(),
  empresa: vi.fn(),
}));

vi.mock("@/lib/pre-analise/access", () => ({ requirePreAnaliseAccess: mocks.access }));
vi.mock("@/lib/cnpj/receita-federal", () => ({ getReceitaData: mocks.receita }));
vi.mock("@/lib/cnpj/empresa-aqui", () => ({ getEmpresaAquiData: mocks.empresa }));

import { GET as consultaReceita } from "@/app/api/ReceitaFederal/route";
import { GET as consultaEmpresa } from "@/app/api/EmpresaAqui/route";
import { GET as consultaFiscal } from "@/app/api/RadarFiscal/route";
import { GET as consultaRadar } from "@/app/api/ConsultaRadar/route";

const CNPJ = "33000167000101";
const routes = [
  ["ReceitaFederal", consultaReceita],
  ["EmpresaAqui", consultaEmpresa],
  ["RadarFiscal", consultaFiscal],
  ["ConsultaRadar", consultaRadar],
] as const;

function request(cnpj = CNPJ) {
  return new Request(`http://localhost/api/consulta?cnpj=${cnpj}`);
}

const cadastro = {
  cnpj: CNPJ,
  razaoSocial: "BANCO DO BRASIL S.A.",
  nomeFantasia: "BANCO DO BRASIL",
  optante_simples: false,
  optante_simei: false,
  regimeTributario: "Regime Normal",
  dataConstituicao: "12/10/1808",
  abertura_bruta: "12/10/1808",
  atividade_principal: [],
  atividades_secundarias: [],
  capitalSocial: 100,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue(null);
  mocks.receita.mockResolvedValue(cadastro);
  mocks.empresa.mockResolvedValue({ cnpj: CNPJ, regime_tributario: "ANO 2025 LUCRO REAL" });
  process.env.CONSULTA_RADAR_TOKEN = "segredo-de-teste";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CONSULTA_RADAR_TOKEN;
});

describe("controle de entrada das quatro consultas", () => {
  it.each(routes)("%s rejeita CNPJ curto antes do provedor", async (_name, handler) => {
    const response = await handler(request("123"));
    expect(response.status).toBe(400);
    expect(mocks.receita).not.toHaveBeenCalled();
    expect(mocks.empresa).not.toHaveBeenCalled();
  });

  it.each(routes)("%s bloqueia acesso anônimo antes do provedor", async (_name, handler) => {
    mocks.access.mockResolvedValue(NextResponse.json({ error: "Não autenticado" }, { status: 401 }));
    const response = await handler(request());
    expect(response.status).toBe(401);
    expect(mocks.receita).not.toHaveBeenCalled();
    expect(mocks.empresa).not.toHaveBeenCalled();
  });

  it.each(routes)("%s preserva bloqueio de permissão e limite", async (_name, handler) => {
    for (const status of [403, 429]) {
      mocks.access.mockResolvedValueOnce(NextResponse.json({ error: "Acesso negado" }, { status }));
      const response = await handler(request());
      expect(response.status).toBe(status);
    }
    expect(mocks.receita).not.toHaveBeenCalled();
    expect(mocks.empresa).not.toHaveBeenCalled();
  });
});

describe("respostas de ReceitaFederal e EmpresaAqui", () => {
  it("preserva estados desconhecidos de Simples e MEI", async () => {
    mocks.receita.mockResolvedValueOnce({ ...cadastro, optante_simples: null, optante_simei: null, regimeTributario: null });
    const response = await consultaReceita(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ optante_simples: null, optante_simei: null, regimeTributario: null });
  });

  it("devolve erro controlado quando EmpresaAqui falha", async () => {
    mocks.empresa.mockRejectedValueOnce(new Error("segredo-de-teste https://fornecedor.example/token"));
    const response = await consultaEmpresa(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toMatch(/segredo-de-teste|fornecedor\.example/);
  });
});

describe("composição RadarFiscal", () => {
  it("marca falha da EmpresaAqui como parcial e não qualifica", async () => {
    mocks.empresa.mockRejectedValueOnce(new Error("timeout"));
    const response = await consultaFiscal(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ consultaStatus: "parcial", fontes: { empresaAqui: "indisponivel" }, qualificacao: null, regimeEA: null });
  });

  it("não qualifica quando Simples é desconhecido", async () => {
    mocks.receita.mockResolvedValueOnce({ ...cadastro, optante_simples: null, optante_simei: null, regimeTributario: null });
    const response = await consultaFiscal(request());
    const body = await response.json();
    expect(body).toMatchObject({ consultaStatus: "parcial", qualificacao: null, perse: "NÃO INFORMADO" });
  });

  it("mantém PERSE indeterminado quando houve opção pelo Simples sem data de exclusão", async () => {
    mocks.receita.mockResolvedValueOnce({
      ...cadastro,
      data_opcao: "01/01/2020",
      data_exclusaoSimples: null,
      atividade_principal: [{ code: "55.10-8-01", text: "Hospedagem" }],
    });
    const response = await consultaFiscal(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ perse: "NÃO INFORMADO" });
  });

  it("trata marcador de regime não informado como resposta insuficiente", async () => {
    mocks.empresa.mockResolvedValueOnce({ cnpj: CNPJ, regime_tributario: "NÃO INFORMADO" });
    const response = await consultaFiscal(request());
    expect(await response.json()).toMatchObject({
      consultaStatus: "parcial",
      fontes: { empresaAqui: "insuficiente" },
      regimeEA: null,
      qualificacao: null,
    });
  });

  it("retorna falha cadastral controlada sem consultar EmpresaAqui", async () => {
    mocks.receita.mockRejectedValueOnce(new Error("Fonte fora do ar"));
    const response = await consultaFiscal(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ consultaStatus: "erro", fontes: { receita: "indisponivel", empresaAqui: "nao_consultada" } });
    expect(mocks.empresa).not.toHaveBeenCalled();
  });
});

describe("ConsultaRadar externa", () => {
  it.each([
    [{ success: false, data: { situacao: "Habilitada" } }, 502],
    [{ success: true, data: null }, 502],
    [{ success: true, data: {} }, 502],
  ])("rejeita erro lógico ou resultado vazio: %j", async (payload, status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }));
    const response = await consultaRadar(request());
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("segredo-de-teste");
  });

  it("rejeita HTTP externo não 2xx e JSON inválido", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new SyntaxError("JSON inválido"); } });
    vi.stubGlobal("fetch", fetchMock);
    expect((await consultaRadar(request())).status).toBe(502);
    expect((await consultaRadar(request())).status).toBe(502);
  });

  it("retorna somente campos públicos após sucesso", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { situacao: "Habilitada", razaoSocial: "EMPRESA TESTE", modalidade: "Ilimitada", dataSituacao: "09/12/2021 10:36:07", token: "segredo-de-teste" }, raw: "Resultado Siscomex" }) });
    vi.stubGlobal("fetch", fetchMock);
    const response = await consultaRadar(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ cnpj: "33000167", contribuinte: "EMPRESA TESTE", situacao: "Habilitada", modalidade: "Ilimitada", submodalidade: "Ilimitada", dataSituacao: "09/12/2021 10:36:07", raw: "Resultado Siscomex" });
    expect(JSON.stringify(body)).not.toContain("segredo-de-teste");
    expect(fetchMock.mock.calls[0][0]).toBe("https://consulta-radar.alpha-comex.com/consultar/33000167");
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer segredo-de-teste" });
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it.each([
    [404, {}, "NOT_FOUND", 404],
    [400, {}, "UPSTREAM_BAD_REQUEST", 502],
    [401, {}, "UPSTREAM_UNAUTHORIZED", 502],
    [502, { code: "BLOCKED_BY_CAPTCHA" }, "BLOCKED_BY_CAPTCHA", 502],
  ])("mapeia HTTP %s da API externa", async (upstream, payload, code, status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: upstream, json: async () => payload }));
    const response = await consultaRadar(request());
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code });
  });

  it("trata timeout sem vazar detalhes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("segredo-de-teste")));
    const response = await consultaRadar(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("segredo-de-teste");
  });
});
