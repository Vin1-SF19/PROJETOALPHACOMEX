import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ receita: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), acesso: vi.fn() }));
vi.mock("@/lib/cnpj/receita-federal", () => ({ getReceitaData: mocks.receita }));
vi.mock("@/lib/pre-analise/access", () => ({ requirePreAnaliseAccess: mocks.acesso }));
vi.mock("@/lib/prisma", () => ({ default: { consultas_radar: { findUnique: mocks.findUnique, upsert: mocks.upsert } } }));

import { GET } from "@/app/api/ConsultaCompleta/route";

const cnpj = "33000167000101";
const request = () => new Request(`http://localhost/api/ConsultaCompleta?cnpj=${cnpj}&forcar=true`);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.acesso.mockResolvedValue(null);
  process.env.CONSULTA_RADAR_TOKEN = "token-de-teste";
  mocks.receita.mockResolvedValue({ razaoSocial: "PETROBRAS", nomeFantasia: "", municipio: "RIO", uf: "RJ" });
  mocks.findUnique.mockResolvedValue(null);
  mocks.upsert.mockImplementation(async ({ create }) => create);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CONSULTA_RADAR_TOKEN;
});

describe("ConsultaCompleta com API RADAR do ialpha", () => {
  it('não consulta nem grava sem autorização', async () => {
    mocks.acesso.mockResolvedValue(new Response(null, { status: 401 }));
    expect((await GET(request())).status).toBe(401);
    expect(mocks.receita).not.toHaveBeenCalled(); expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('Radar só começa depois de Receita responder', async () => {
    let liberar!: (value: object) => void;
    mocks.receita.mockImplementationOnce(() => new Promise(resolve => { liberar = resolve; }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { situacao: "Habilitada", razaoSocial: "Banco", modalidade: "LIMITADA", dataAtualizacaoPublicada: "08/10/2026 16h13" } }) }); vi.stubGlobal('fetch', fetchMock);
    const job = GET(request()); await Promise.resolve(); await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    liberar({ razaoSocial: 'Banco' }); expect((await job).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("grava modalidade e data publicada no JSON preservando o shape persistido", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { situacao: "HABILITADA", razaoSocial: "PETROLEO BRASILEIRO", modalidade: "ILIMITADA", dataAtualizacaoPublicada: "08/10/2026 16h13", consultadoEm: "2026-10-22T12:00:00.000Z" } }) }));
    const response = await GET(request());
    expect(response.status).toBe(200);
    const salvo = mocks.upsert.mock.calls[0][0].create;
    expect(salvo).toMatchObject({ cnpj, situacao_radar: "HABILITADA", submodalidade: "ILIMITADA", contribuinte: "PETROLEO BRASILEIRO" });
    expect(salvo.data_situacao).toBeNull();
    expect(JSON.parse(salvo.json_completo).radar.dataAtualizacaoPublicada).toBe("08/10/2026 16h13");
  });

  it("não trata ausência no arquivo como desabilitação definitiva", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { found: false, situacao: "NÃO CONSTA NO ARQUIVO CONSULTADO", dataAtualizacaoPublicada: "08/10/2026 16h13" } }) }));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mocks.upsert.mock.calls[0][0].create.situacao_radar).toBe("NÃO CONSTA NO ARQUIVO CONSULTADO");
  });

  it("atualiza a leitura CSV mesmo quando a consulta cadastral já está no banco", async () => {
    mocks.findUnique.mockResolvedValue({ cnpj, razao_social: "PETROBRAS", situacao_radar: "ANTIGA", submodalidade: "ANTIGA", nome_fantasia: "", data_consulta: new Date() });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { situacao: "HABILITADA", modalidade: "ILIMITADA", dataAtualizacaoPublicada: "08/10/2026 16h13" } }) }));
    const response = await GET(new Request(`http://localhost/api/ConsultaCompleta?cnpj=${cnpj}`));
    const body = await response.json();
    expect(body).toMatchObject({ situacao: "HABILITADA", submodalidade: "ILIMITADA", dataAtualizacaoPublicada: "08/10/2026 16h13", fonte: "Banco Local + API RADAR ialpha" });
  });

  it.each([200, 404])("reconsulta forçada com ausência %s preserva histórico e não grava", async status => {
    const dataOriginal = "2026-10-01T12:00:00Z";
    mocks.findUnique.mockResolvedValue({ cnpj, razao_social: "EMPRESA SALVA", situacao_radar: "HABILITADA", submodalidade: "ILIMITADA", data_consulta: dataOriginal });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status === 200, status,
      json: async () => ({ success: true, data: { found: false } }) }));
    const response = await GET(request()); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ situacao: "HABILITADA", submodalidade: "ILIMITADA", dataConsulta: dataOriginal, fonte: "Banco Local", radarAviso: expect.stringContaining("sem alterar") });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it.each([200, 404])("leitura de cadastro salvo com ausência %s mantém situação e submodalidade", async status => {
    mocks.findUnique.mockResolvedValue({ cnpj, razao_social: "EMPRESA SALVA", situacao_radar: "HABILITADA", submodalidade: "ILIMITADA", data_consulta: "2026-10-01T12:00:00Z" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status === 200, status,
      json: async () => ({ success: true, data: { found: false } }) }));
    const response = await GET(new Request(`http://localhost/api/ConsultaCompleta?cnpj=${cnpj}`));
    expect(await response.json()).toMatchObject({ situacao: "HABILITADA", submodalidade: "ILIMITADA", fonte: "Banco Local", radarAviso: expect.stringContaining("registro local anterior") });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
