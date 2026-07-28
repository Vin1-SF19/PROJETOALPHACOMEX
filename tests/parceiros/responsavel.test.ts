import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  parceiro: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  parceiroAcesso: {
    findUnique: vi.fn(),
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

describe("responsável físico de parceiro PJ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7" } });
    prismaMock.parceiro.findUnique.mockResolvedValue(null);
    prismaMock.parceiro.create.mockResolvedValue({
      id: 10,
      nome: "Empresa Parceira",
    });
  });

  it("permite cadastrar o responsável informando somente o nome", async () => {
    const resultado = await criarParceiro({
      tipo: "PJ",
      documento: "12345678000190",
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [{ nome: "Maria Responsável" }],
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.parceiro.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        representantes: {
          create: [{
            tipo: "PF",
            documento: "",
            nome: "Maria Responsável",
            dataNascimento: null,
            cargo: null,
            email: null,
            telefone: null,
          }],
        },
      }),
    });
  });

  it("continua exigindo ao menos um responsável com nome para PJ", async () => {
    const resultado = await criarParceiro({
      tipo: "PJ",
      documento: "12345678000190",
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [{ nome: "  " }],
    });

    expect(resultado).toEqual({
      success: false,
      error: "Ao menos um responsável físico é obrigatório para Pessoa Jurídica",
    });
    expect(prismaMock.parceiro.create).not.toHaveBeenCalled();
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
        telefone: null,
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

  it("normaliza responsáveis adicionados e preserva somente o nome como obrigatório", () => {
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
        cpf: "12345678901",
        dataNascimento: "1990-05-10",
        cargo: "Sócia",
        email: "maria@example.com",
        telefone: "(11) 99999-9999",
      },
      {
        nome: "João Diretor",
        cpf: undefined,
        dataNascimento: undefined,
        cargo: undefined,
        email: undefined,
        telefone: undefined,
      },
    ]);
  });
});

describe("edição dos responsáveis do parceiro", () => {
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
  });

  it("substitui atomicamente um conjunto com múltiplos responsáveis", async () => {
    const resultado = await editarParceiro(10, {
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [
        { nome: "Maria Sócia", cpf: "123.456.789-01", cargo: "Sócia" },
        { nome: "João Diretor", telefone: "(11) 99999-9999" },
      ],
    });

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.parceiro.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        representantes: {
          deleteMany: {},
          create: [
            {
              tipo: "PF",
              documento: "12345678901",
              nome: "Maria Sócia",
              dataNascimento: null,
              cargo: "Sócia",
              email: null,
              telefone: null,
            },
            {
              tipo: "PF",
              documento: "",
              nome: "João Diretor",
              dataNascimento: null,
              cargo: null,
              email: null,
              telefone: "(11) 99999-9999",
            },
          ],
        },
      }),
    });
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
    const chamada = prismaMock.parceiro.update.mock.calls[0][0];
    expect(chamada.data).not.toHaveProperty("representantes");
  });

  it("nega a edição direta para usuário sem permissão", async () => {
    authMock.mockResolvedValue({ user: { id: "8", role: "Comercial" } });

    const resultado = await editarParceiro(10, {
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [{ nome: "Maria Sócia" }],
    });

    expect(resultado).toEqual({ success: false, error: "Sem permissão para editar" });
    expect(prismaMock.parceiro.update).not.toHaveBeenCalled();
  });

  it("não executa uma segunda mutação quando o nested write falha", async () => {
    prismaMock.parceiro.update.mockRejectedValue(new Error("falha no nested write"));

    const resultado = await editarParceiro(10, {
      nome: "Empresa Parceira",
      email: "parceiro@example.com",
      responsaveis: [{ nome: "Maria Sócia" }],
    });

    expect(resultado).toEqual({ success: false, error: "Erro ao salvar alterações" });
    expect(prismaMock.parceiro.update).toHaveBeenCalledTimes(1);
  });
});
