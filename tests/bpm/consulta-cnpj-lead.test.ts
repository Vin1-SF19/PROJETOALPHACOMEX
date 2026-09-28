import { beforeEach, describe, expect, it, vi } from "vitest";

const { receita, empresaAqui, radar, findConsulta, upsertConsulta, findCliente } = vi.hoisted(() => ({
  receita: vi.fn(), empresaAqui: vi.fn(), radar: vi.fn(), findConsulta: vi.fn(),
  upsertConsulta: vi.fn(), findCliente: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/cnpj/receita-federal", () => ({ getReceitaData: receita }));
vi.mock("@/lib/cnpj/empresa-aqui", () => ({ getEmpresaAquiData: empresaAqui }));
vi.mock("@/lib/radar/consulta", () => ({
  consultarRadar: radar,
  ErroConsultaRadar: class ErroConsultaRadar extends Error {
    constructor(public status: number) { super("Erro Radar"); }
  },
}));
vi.mock("@/lib/prisma", () => ({ default: {
  consultaPreAnalise: { findUnique: findConsulta, upsert: upsertConsulta },
  cliente: { findUnique: findCliente },
} }));

import { consultarEGuardarCnpjLead } from "@/lib/bpm/consulta-cnpj-lead";
import { ErroConsultaRadar } from "@/lib/radar/consulta";

const cnpj = "11222333000181";
const dadosReceita = { razaoSocial: "EMPRESA", nomeFantasia: "MARCA", uf: "SP", municipio: "SÃO PAULO",
  situacao: "ATIVA", regimeTributario: "Regime Normal", optante_simples: false,
  dataConstituicao: "01/01/2010", capitalSocial: "150.000,00" };
const dadosRadar = { situacao: "HABILITADA", modalidade: "ILIMITADA", submodalidade: "ILIMITADA",
  dataSituacao: "2026-09-01", baseLegal: "Base", tipoDesabilitacao: "", operacoesAutorizadas: "Importação",
  razaoSocial: "EMPRESA" };

beforeEach(() => {
  vi.clearAllMocks();
  receita.mockResolvedValue(dadosReceita);
  empresaAqui.mockResolvedValue({ cnpj, razao: "EMPRESA", regime_tributario: "Lucro Real", faturamento: "5000000" });
  radar.mockResolvedValue(dadosRadar);
  findConsulta.mockResolvedValue(null);
  findCliente.mockResolvedValue(null);
  upsertConsulta.mockResolvedValue({});
});

describe("consultarEGuardarCnpjLead", () => {
  it("não chama fornecedores nem banco para CNPJ inválido", async () => {
    await expect(consultarEGuardarCnpjLead("123")).rejects.toThrow("CNPJ inválido");
    expect(receita).not.toHaveBeenCalled();
    expect(upsertConsulta).not.toHaveBeenCalled();
  });

  it("guarda as três fontes por CNPJ em um registro existente da gaveta", async () => {
    findCliente.mockResolvedValue({ id: 7, razaoSocial: "EMPRESA" });
    const resultado = await consultarEGuardarCnpjLead(cnpj);
    expect(resultado.falhas).toEqual([]);
    expect(receita).toHaveBeenCalledWith(cnpj);
    expect(empresaAqui).toHaveBeenCalledWith(cnpj);
    expect(radar).toHaveBeenCalledWith(cnpj, 15_000);
    expect(upsertConsulta).toHaveBeenCalledWith(expect.objectContaining({
      where: { cnpj }, create: expect.objectContaining({ cnpj, clienteId: 7, capitalSocial: 150000 }),
    }));
    const update = upsertConsulta.mock.calls[0][0].update;
    expect(update.dadosBrutos).toMatchObject({
      rfb: { dados: dadosReceita },
      empresaqui: { dados: { faturamento: "5000000" } },
      radar: { dados: { situacao: "HABILITADA", modalidade: "ILIMITADA" } },
      consultaCrm: { falhas: [] },
    });
  });

  it("preserva snapshots anteriores quando um fornecedor falha", async () => {
    receita.mockRejectedValue(new Error("indisponível"));
    findConsulta.mockResolvedValue({ razaoSocial: "ANTERIOR", dadosBrutos: { rfb: { dados: { razaoSocial: "ANTERIOR" } } } });
    const resultado = await consultarEGuardarCnpjLead(cnpj);
    expect(resultado.falhas).toEqual(["Receita Federal"]);
    expect(upsertConsulta.mock.calls[0][0].update.dadosBrutos.rfb.dados.razaoSocial).toBe("ANTERIOR");
  });

  it("distingue ausência real no Radar de falha técnica", async () => {
    radar.mockRejectedValueOnce(new ErroConsultaRadar(404, "NOT_FOUND", "Não encontrado"));
    let resultado = await consultarEGuardarCnpjLead(cnpj);
    expect(resultado.falhas).toEqual([]);
    expect(resultado.radarSituacao).toBe("NÃO HABILITADA");
    expect(upsertConsulta.mock.calls[0][0].update.dadosBrutos.radar.dados).toEqual({ situacao: "NÃO HABILITADA" });

    radar.mockRejectedValueOnce(new ErroConsultaRadar(502, "UPSTREAM_UNAVAILABLE", "Indisponível"));
    findConsulta.mockResolvedValue({ razaoSocial: "EMPRESA", dadosBrutos: { radar: { dados: dadosRadar } } });
    resultado = await consultarEGuardarCnpjLead(cnpj);
    expect(resultado.falhas).toContain("Radar");
    expect(upsertConsulta.mock.calls[1][0].update.dadosBrutos.radar.dados).toEqual(dadosRadar);
  });

  it("persiste resposta fiscal mesmo se Receita e Radar falharem", async () => {
    receita.mockRejectedValue(new Error("indisponível"));
    radar.mockRejectedValue(new Error("indisponível"));
    const resultado = await consultarEGuardarCnpjLead(cnpj);
    expect(resultado.falhas).toEqual(["Receita Federal", "Radar"]);
    expect(upsertConsulta.mock.calls[0][0].create.razaoSocial).toBe("EMPRESA");
  });
});
