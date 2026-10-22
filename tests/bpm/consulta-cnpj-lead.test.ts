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

import { consultarEGuardarCnpjLead, consultarFontesCnpjLead } from "@/lib/bpm/consulta-cnpj-lead";
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
  it("lupa de edição usa as mesmas APIs sem ler ou gravar cadastro/snapshot", async () => {
    const r = await consultarFontesCnpjLead(cnpj);
    expect(r.receita).toEqual(dadosReceita); expect(r.dadosRadar?.situacao).toBe("HABILITADA");
    expect(receita).toHaveBeenCalledWith(cnpj); expect(empresaAqui).toHaveBeenCalledWith(cnpj); expect(radar).toHaveBeenCalledWith(cnpj, 15000);
    expect(findConsulta).not.toHaveBeenCalled(); expect(findCliente).not.toHaveBeenCalled(); expect(upsertConsulta).not.toHaveBeenCalled();
  });
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

  it.each(["404", "ausência no CSV com 200", "502"])("preserva Radar confirmado quando a consulta devolve %s", async (caso) => {
    if (caso === "ausência no CSV com 200") radar.mockResolvedValue({ ...dadosRadar, situacao: "NÃO CONSTA NO ARQUIVO CONSULTADO" });
    else radar.mockRejectedValue(new ErroConsultaRadar(caso === "404" ? 404 : 502, "NOT_FOUND", "Não encontrado"));
    const previa = await consultarFontesCnpjLead(cnpj);
    expect(previa.dadosRadar).toBeNull(); expect(previa.falhas).toContain("Radar");
    expect(findConsulta).not.toHaveBeenCalled(); expect(upsertConsulta).not.toHaveBeenCalled();
    findConsulta.mockResolvedValue({ razaoSocial: "EMPRESA", submodalidade: "ILIMITADA", dadosBrutos: { radar: { dados: dadosRadar } } });
    const resultado = await consultarEGuardarCnpjLead(cnpj);
    expect(resultado.falhas).toContain("Radar");
    expect(resultado.radarSituacao).toBeNull();
    expect(upsertConsulta.mock.calls[0][0].update.dadosBrutos.radar.dados).toEqual(dadosRadar);
    expect(upsertConsulta.mock.calls[0][0].update.submodalidade).toBe("ILIMITADA");
  });

  it("não grava ausência do CSV quando nenhuma fonte retornou dados", async () => {
    receita.mockRejectedValue(new Error("indisponível")); empresaAqui.mockRejectedValue(new Error("indisponível"));
    radar.mockRejectedValue(new ErroConsultaRadar(404, "NOT_FOUND", "Não consta no arquivo"));
    const resultado = await consultarEGuardarCnpjLead(cnpj);
    expect(resultado.falhas).toEqual(["Receita Federal", "EmpresaAqui", "Radar"]);
    expect(upsertConsulta).not.toHaveBeenCalled();
  });

  it("conserva situação negativa explicitamente fornecida e metadados do Radar", async () => {
    radar.mockResolvedValue({ ...dadosRadar, situacao: "NÃO HABILITADA", modalidade: "", submodalidade: "",
      dataAtualizacaoPublicada: "2026-10-21", consultadoEm: "2026-10-22T16:00:00Z", aviso: "Dados do arquivo publicado" });
    const resultado = await consultarEGuardarCnpjLead(cnpj);
    expect(resultado.radarSituacao).toBe("NÃO HABILITADA"); expect(resultado.falhas).toEqual([]);
    expect(upsertConsulta.mock.calls[0][0].update.dadosBrutos.radar.dados).toMatchObject({ situacao: "NÃO HABILITADA",
      dataAtualizacaoPublicada: "2026-10-21", consultadoEm: "2026-10-22T16:00:00Z", aviso: "Dados do arquivo publicado" });
  });

  it("persiste resposta fiscal mesmo se Receita e Radar falharem", async () => {
    receita.mockRejectedValue(new Error("indisponível"));
    radar.mockRejectedValue(new Error("indisponível"));
    const resultado = await consultarEGuardarCnpjLead(cnpj);
    expect(resultado.falhas).toEqual(["Receita Federal", "Radar"]);
    expect(upsertConsulta.mock.calls[0][0].create.razaoSocial).toBe("EMPRESA");
  });
});
