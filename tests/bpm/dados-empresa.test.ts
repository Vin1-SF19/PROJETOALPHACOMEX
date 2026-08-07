import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  normalizarDadosEmpresaBpm,
  type ClienteEmpresaFonte,
  type DadosEmpresaFontes,
} from "@/lib/bpm/dados-empresa";

const clienteBase: ClienteEmpresaFonte = {
  id: 17,
  status: "Em Andamento",
  cnpj: "12.345.678/0001-90",
  razaoSocial: "Empresa Teste Ltda",
  nomeFantasia: "Empresa Teste",
  dataConstituicao: "01/02/2010",
  uf: "SP",
  municipio: "São Paulo",
  regimeTributario: "Lucro Presumido",
  servicos: "Radar",
  analistaResponsavel: "Analista Alpha",
  closerNome: "Closer Alpha",
  formaPagamento: "Mensal",
  valorContrato: 12000,
  dataContratacao: "01/08/2026",
  dataExito: null,
  origemLead: "Indicação",
  canalAquisicao: "Parceiro",
  canalOutro: null,
  socios: [{ id: 1, nome: "Ana Silva", telefone: "(11) 99999-0000", vinculo: "Sócia" }],
};

function criarFontes(): DadosEmpresaFontes {
  return {
    empresaPrincipal: clienteBase,
    registrosCs: [clienteBase],
    pessoasVinculadas: [{ id: 1, nome: "Ana Silva", telefone: "(11) 99999-0000", vinculo: "Sócia" }],
    preAnalise: {
      regimeEA: "LUCRO REAL",
      qualificacao: "PREMIUM",
      submodalidade: "LIMITADO",
      capitalSocial: 500000,
      nomeResponsavel: "Maria Cliente",
      telefoneContato: "(11) 98888-0000",
      observacoes: null,
      updatedAt: "2026-08-07T12:00:00.000Z",
      dadosBrutos: {
        rfb: {
          dados: {
            cnpj: "12345678000190",
            razaoSocial: "EMPRESA TESTE LTDA",
            nomeFantasia: "EMPRESA TESTE",
            situacao: "ATIVA",
            dataConstituicao: "01/02/2010",
            porte: "DEMAIS",
            natureza_juridica: "Sociedade Empresária Limitada",
            capitalSocial: 500000,
            email: "contato@empresa.com.br",
            telefone: "(11) 3333-4444",
            logradouro: "Rua das Empresas",
            numero: "100",
            bairro: "Centro",
            municipio: "São Paulo",
            uf: "SP",
            cep: "01000-000",
            optante_simples: false,
            optante_simei: false,
            atividade_principal: [{ code: "62.01-5-01", text: "Desenvolvimento de programas" }],
            atividades_secundarias: [{ code: "62.02-3-00", text: "Consultoria em TI" }],
            qsa: [
              { nome: "Ana Silva", qual: "Sócio-Administrador" },
              { nome: "Bruno Souza", qual: "Sócio" },
            ],
          },
        },
        empresaqui: {
          dados: {
            regimeEA: "LUCRO REAL",
            regimeReceita: "REGIME NORMAL",
            qualificacao: "PREMIUM",
            perse: "SIM",
            perse_anexo: "ANEXO 1",
            divida_tributaria: 1250.5,
            historicoRegime: [{ ano: "2025", regime: "LUCRO REAL" }],
          },
        },
        radar: {
          dados: { situacao: "HABILITADO", submodalidade: "LIMITADO" },
          consultadoEm: "2026-08-06T10:00:00.000Z",
        },
      },
    },
    radarFiscal: null,
    responsaveisBpm: [
      { nome: "Responsável CRM", papel: "Responsável do card" },
      { nome: "Responsável CRM", papel: "Responsável do card" },
    ],
  };
}

describe("normalizarDadosEmpresaBpm", () => {
  it("consolida as fontes e remove pessoas e responsáveis idênticos", () => {
    const dados = normalizarDadosEmpresaBpm(criarFontes());

    expect(dados.empresa).toMatchObject({
      razaoSocial: "EMPRESA TESTE LTDA",
      situacao: "ATIVA",
      porte: "DEMAIS",
      capitalSocial: 500000,
    });
    expect(dados.pessoas).toHaveLength(2);
    expect(dados.pessoas.find((pessoa) => pessoa.nome === "Ana Silva")).toMatchObject({
      telefone: "(11) 99999-0000",
      fontes: ["CS&NPS/BPM", "Cartão CNPJ"],
    });
    expect(dados.contatos).toEqual(expect.arrayContaining([
      expect.objectContaining({ tipo: "E-mail", valor: "contato@empresa.com.br" }),
      expect.objectContaining({ tipo: "Telefone", valor: "(11) 3333-4444" }),
      expect.objectContaining({ tipo: "Telefone", valor: "(11) 98888-0000", titular: "Maria Cliente" }),
    ]));
    expect(dados.responsaveis.filter((item) => item.nome === "Responsável CRM")).toHaveLength(1);
    expect(dados.cnaes).toHaveLength(2);
    expect(dados.regimeTributario.atual).toBe("LUCRO REAL");
    expect(dados.radar).toMatchObject({
      situacao: "HABILITADO",
      submodalidade: "LIMITADO",
      qualificacao: "PREMIUM",
      perse: "SIM",
      anexoPerse: "ANEXO 1",
      dividaTributaria: 1250.5,
    });
  });

  it("usa CS&NPS e Radar Fiscal como fallback sem inventar campos", () => {
    const dados = normalizarDadosEmpresaBpm({
      ...criarFontes(),
      preAnalise: null,
      radarFiscal: {
        regime_ea: "LUCRO PRESUMIDO",
        regime_receita: "REGIME NORMAL",
        cnaes: JSON.stringify({ principal: [{ codigo: "46.90-0-00", descricao: "Comércio atacadista" }] }),
        qsa: JSON.stringify([{ nome: "Carlos Lima", qualificacao: "Sócio" }]),
        situacao_cadastral: "ATIVA",
      },
    });

    expect(dados.fonteCartaoCnpj).toBe("CS&NPS");
    expect(dados.empresa.porte).toBeNull();
    expect(dados.regimeTributario.atual).toBe("LUCRO PRESUMIDO");
    expect(dados.cnaes).toEqual([
      { codigo: "46.90-0-00", descricao: "Comércio atacadista", tipo: "Principal" },
    ]);
    expect(dados.pessoas.some((pessoa) => pessoa.nome === "Carlos Lima")).toBe(true);
  });
});

const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn(), findMany: vi.fn() },
  clientes: { findMany: vi.fn(), findUnique: vi.fn() },
  socios: { findMany: vi.fn() },
  consultaPreAnalise: { findUnique: vi.fn() },
  radar_fiscal: { findFirst: vi.fn() },
  bpmCardHistorico: { findMany: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: exigirAcessoMock }));

import { ObterDadosEmpresaCardBpm } from "@/actions/bpm/Empresas";

describe("ObterDadosEmpresaCardBpm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não consulta dados empresariais sem sessão", async () => {
    authMock.mockResolvedValue(null);

    const resultado = await ObterDadosEmpresaCardBpm("card-1");

    expect(resultado).toEqual({ success: false, error: "Não autorizado", data: null });
    expect(exigirAcessoMock).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.findUnique).not.toHaveBeenCalled();
  });

  it("valida ownership antes de ler a empresa", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "User" } });
    exigirAcessoMock.mockRejectedValue(new Error("Não autorizado"));

    const resultado = await ObterDadosEmpresaCardBpm("card-1");

    expect(exigirAcessoMock).toHaveBeenCalledWith("card-1", 42, "User", "visualizar");
    expect(resultado).toEqual({ success: false, error: "Não autorizado", data: null });
    expect(prismaMock.bpmCard.findUnique).not.toHaveBeenCalled();
  });
});
