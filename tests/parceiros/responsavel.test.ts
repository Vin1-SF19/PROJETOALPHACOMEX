import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  parceiro: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  parceiroAcesso: {
    findUnique: vi.fn(),
  },
  contratoComercial: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  cliente: {
    findFirst: vi.fn(),
  },
  indicacao: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  pessoa: {
    upsert: vi.fn(),
  },
  pessoaParceiroVinculo: {
    findMany: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("bcryptjs", () => ({ hashSync: vi.fn(() => "senha-hash") }));
vi.mock("@vercel/blob", () => ({ put: vi.fn() }));

import { criarParceiro, editarParceiro } from "@/actions/parceiros";
import {
  criarFormularioResponsaveis,
  montarPayloadResponsaveis,
} from "@/components/Parceiros/responsaveis-form";

// Transação fake que expõe todos os models mockados ao callback — mesmo padrão de
// `db.$transaction(async (tx) => ...)` usado por criarParceiro/editarParceiro.
function txFake() {
  return {
    parceiro: { create: prismaMock.parceiro.create, update: prismaMock.parceiro.update },
    contratoComercial: { updateMany: prismaMock.contratoComercial.updateMany },
    cliente: { findFirst: prismaMock.cliente.findFirst },
    indicacao: { create: prismaMock.indicacao.create },
    pessoa: { upsert: prismaMock.pessoa.upsert },
    pessoaParceiroVinculo: {
      findMany: prismaMock.pessoaParceiroVinculo.findMany,
      delete: prismaMock.pessoaParceiroVinculo.delete,
      upsert: prismaMock.pessoaParceiroVinculo.upsert,
    },
  };
}

describe("responsável físico de parceiro PJ (Pessoa/PessoaParceiroVinculo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7" } });
    prismaMock.parceiro.findUnique.mockResolvedValue(null);
    prismaMock.parceiro.create.mockResolvedValue({
      id: 10,
      nome: "Empresa Parceira",
    });
    prismaMock.indicacao.findMany.mockResolvedValue([]);
    prismaMock.pessoaParceiroVinculo.findMany.mockResolvedValue([]);
    prismaMock.pessoa.upsert.mockResolvedValue({ id: 200, celular: "11999999999" });
    prismaMock.pessoaParceiroVinculo.upsert.mockResolvedValue({ id: 300 });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(txFake()));
  });

  it("exige WhatsApp de cada responsável (celular vira chave da Pessoa)", async () => {
    const resultado = await criarParceiro({
      tipo: "PJ",
      documento: "12345678000190",
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      // @ts-expect-error — telefone omitido de propósito para provar o bloqueio de schema
      responsaveis: [{ nome: "Maria Responsável" }],
    });

    expect(resultado.success).toBe(false);
    expect(prismaMock.parceiro.create).not.toHaveBeenCalled();
  });

  it("cria o parceiro e sincroniza o representante em Pessoa/PessoaParceiroVinculo", async () => {
    const resultado = await criarParceiro({
      tipo: "PJ",
      documento: "12345678000190",
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [{ nome: "Maria Responsável", telefone: "(11) 99999-9999" }],
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.parceiro.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ representantes: expect.anything() }),
    });
    expect(prismaMock.pessoa.upsert).toHaveBeenCalledWith({
      where: { celular: "11999999999" },
      create: expect.objectContaining({ celular: "11999999999", nome: "Maria Responsável" }),
      update: {},
    });
    expect(prismaMock.pessoaParceiroVinculo.upsert).toHaveBeenCalledWith({
      where: { pessoaId_parceiroId_papel: { pessoaId: 200, parceiroId: 10, papel: "REPRESENTANTE" } },
      create: expect.objectContaining({ pessoaId: 200, parceiroId: 10, papel: "REPRESENTANTE", tipoDocumento: "PF" }),
      update: expect.objectContaining({ ativo: true }),
    });
  });

  it("continua exigindo ao menos um responsável com nome para PJ", async () => {
    const resultado = await criarParceiro({
      tipo: "PJ",
      documento: "12345678000190",
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [{ nome: "  ", telefone: "(11) 99999-9999" }],
    });

    expect(resultado).toEqual({
      success: false,
      error: "Ao menos um responsável físico é obrigatório para Pessoa Jurídica",
    });
    expect(prismaMock.parceiro.create).not.toHaveBeenCalled();
  });

  it("cria e vincula atomicamente quando o cadastro veio de uma pendência do Metas", async () => {
    const origemContratoId = "clw1234567890abcdef";
    prismaMock.contratoComercial.findUnique.mockResolvedValue({
      canalAquisicao: "Indicação Parceiro",
      indicadoPorParceiroId: null,
      status: "ENVIADO",
      cnpj: "12345678000190",
      servico: "Revisão RADAR 150K",
      canalOutro: JSON.stringify({
        tipo: "PARCEIRO_NAO_CADASTRADO",
        versao: 1,
        nome: "Maria Responsável",
      }),
    });
    prismaMock.contratoComercial.updateMany.mockResolvedValue({ count: 1 });

    const resultado = await criarParceiro({
      tipo: "PJ",
      documento: "12345678000190",
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [{ nome: "Maria Responsável", telefone: "(11) 99999-9999" }],
      origemContratoId,
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.contratoComercial.updateMany).toHaveBeenCalledWith({
      where: {
        id: origemContratoId,
        canalAquisicao: "Indicação Parceiro",
        indicadoPorParceiroId: null,
      },
      data: { indicadoPorParceiroId: 10, canalOutro: null },
    });
  });

  it("cria a indicação retroativa (por CNPJ, em Cliente) quando o contrato já foi fechado", async () => {
    const origemContratoId = "clw1234567890abcdef";
    prismaMock.contratoComercial.findUnique.mockResolvedValue({
      canalAquisicao: "Indicação Parceiro",
      indicadoPorParceiroId: null,
      status: "FECHADO",
      cnpj: "12.345.678/0001-90",
      servico: "Revisão RADAR 150K",
      canalOutro: JSON.stringify({
        tipo: "PARCEIRO_NAO_CADASTRADO",
        versao: 1,
        nome: "Maria Responsável",
      }),
    });
    prismaMock.contratoComercial.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.cliente.findFirst.mockResolvedValue({ id: 55, indicacao: null });
    prismaMock.indicacao.create.mockResolvedValue({ id: 77 });

    const resultado = await criarParceiro({
      tipo: "PJ",
      documento: "12345678000190",
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [{ nome: "Maria Responsável", telefone: "(11) 99999-9999" }],
      origemContratoId,
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.cliente.findFirst).toHaveBeenCalledWith({
      where: { cnpj: "12345678000190" },
      select: { id: true, indicacao: { select: { parceiroId: true } } },
    });
    expect(prismaMock.indicacao.create).toHaveBeenCalledWith({
      data: { parceiroId: 10, clienteId: 55, criadoPorId: 7 },
    });
  });
});

describe("formulário de responsáveis no detalhe do parceiro", () => {
  it("reconstrói todos os responsáveis persistidos ao cancelar a edição", () => {
    const persistidos = [
      {
        tipo: "PF",
        documento: "12345678901",
        nome: "Maria Responsável",
        dataNascimento: "1990-05-10",
        cargo: "Sócia",
        email: "maria@example.com",
        telefone: "(11) 99999-9999",
      },
      {
        tipo: "PF",
        documento: "",
        nome: "João Diretor",
        dataNascimento: null,
        cargo: null,
        email: null,
        telefone: "(11) 98888-8888",
      },
    ];
    const formularioAlterado = criarFormularioResponsaveis(persistidos);
    formularioAlterado[0].nome = "Alteração não salva";
    formularioAlterado.pop();

    const formularioRestaurado = criarFormularioResponsaveis(persistidos);

    expect(formularioRestaurado).toHaveLength(2);
    expect(formularioRestaurado[0]).toMatchObject({
      nome: "Maria Responsável",
      cpf: "123.456.789-01",
      cargo: "Sócia",
    });
    expect(formularioRestaurado[1].nome).toBe("João Diretor");
  });

  it("normaliza responsáveis e exige nome + WhatsApp como obrigatórios", () => {
    const payload = montarPayloadResponsaveis([
      {
        nome: "  Maria Responsável  ",
        cpf: "123.456.789-01",
        dataNascimento: "1990-05-10",
        cargo: " Sócia ",
        email: " maria@example.com ",
        whatsapp: " (11) 99999-9999 ",
      },
      {
        // Sem WhatsApp — deve ser filtrado, não vira Pessoa sem celular.
        nome: "João Diretor",
        cpf: "",
        dataNascimento: "",
        cargo: "",
        email: "",
        whatsapp: "",
      },
    ]);

    expect(payload).toEqual([
      {
        nome: "Maria Responsável",
        telefone: "(11) 99999-9999",
        cpf: "12345678901",
        dataNascimento: "1990-05-10",
        cargo: "Sócia",
        email: "maria@example.com",
      },
    ]);
  });
});

describe("edição dos responsáveis do parceiro (Pessoa/PessoaParceiroVinculo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    prismaMock.parceiro.findUnique.mockResolvedValue({
      tipo: "PJ",
      chavePix: null,
      tipoChavePix: null,
      nomeBanco: null,
      agencia: null,
      conta: null,
    });
    prismaMock.parceiro.update.mockResolvedValue({ id: 10 });
    prismaMock.parceiroAcesso.findUnique.mockResolvedValue(null);
    prismaMock.pessoaParceiroVinculo.findMany.mockResolvedValue([]);
    prismaMock.pessoa.upsert.mockImplementation(async ({ where }: { where: { celular: string } }) => ({
      id: where.celular === "11999999999" ? 201 : 202,
      celular: where.celular,
    }));
    prismaMock.pessoaParceiroVinculo.upsert.mockResolvedValue({ id: 301 });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(txFake()));
  });

  it("sincroniza (upsert) um conjunto com múltiplos responsáveis sem apagar Pessoas", async () => {
    const resultado = await editarParceiro(10, {
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [
        { nome: "Maria Sócia", cpf: "123.456.789-01", cargo: "Sócia", telefone: "(11) 99999-9999" },
        { nome: "João Diretor", telefone: "(11) 98888-8888" },
      ],
    });

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.parceiro.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.not.objectContaining({ representantes: expect.anything() }),
    });
    // 2 responsáveis válidos -> 2 upserts de Pessoa + 2 upserts de vínculo.
    expect(prismaMock.pessoa.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.pessoaParceiroVinculo.upsert).toHaveBeenCalledTimes(2);
  });

  it("desvincula (sem apagar a Pessoa) quem saiu do payload", async () => {
    prismaMock.pessoaParceiroVinculo.findMany.mockResolvedValue([
      { id: 999, pessoaId: 500, pessoa: { celular: "11977777777" } }, // não está mais no payload
    ]);

    await editarParceiro(10, {
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [{ nome: "Maria Sócia", telefone: "(11) 99999-9999" }],
    });

    expect(prismaMock.pessoaParceiroVinculo.delete).toHaveBeenCalledWith({ where: { id: 999 } });
  });

  it("impede remover o último responsável de um parceiro PJ", async () => {
    const resultado = await editarParceiro(10, {
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [],
    });

    expect(resultado).toEqual({
      success: false,
      error: "Ao menos um responsável físico é obrigatório para Pessoa Jurídica",
    });
    expect(prismaMock.parceiro.update).not.toHaveBeenCalled();
  });

  it("não altera representantes de parceiro PF quando o payload os omite", async () => {
    prismaMock.parceiro.findUnique.mockResolvedValue({
      tipo: "PF",
      chavePix: null,
      tipoChavePix: null,
      nomeBanco: null,
      agencia: null,
      conta: null,
    });

    const resultado = await editarParceiro(10, {
      nome: "Parceiro Pessoa Física",
      email: "pf@example.com",
    });

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.pessoaParceiroVinculo.findMany).not.toHaveBeenCalled();
    expect(prismaMock.pessoa.upsert).not.toHaveBeenCalled();
  });

  it("nega a edição direta para usuário sem permissão", async () => {
    authMock.mockResolvedValue({ user: { id: "8", role: "Comercial" } });

    const resultado = await editarParceiro(10, {
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [{ nome: "Maria Sócia", telefone: "(11) 99999-9999" }],
    });

    expect(resultado).toEqual({ success: false, error: "Sem permissão para editar" });
    expect(prismaMock.parceiro.update).not.toHaveBeenCalled();
  });

  it("não sincroniza representantes quando a atualização do parceiro falha", async () => {
    prismaMock.parceiro.update.mockRejectedValue(new Error("falha no update"));

    const resultado = await editarParceiro(10, {
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [{ nome: "Maria Sócia", telefone: "(11) 99999-9999" }],
    });

    expect(resultado).toEqual({ success: false, error: "Erro ao salvar alterações" });
    expect(prismaMock.parceiro.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.pessoa.upsert).not.toHaveBeenCalled();
  });
});
