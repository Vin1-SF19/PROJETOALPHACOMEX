import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  cliente: { findUnique: vi.fn() },
  clienteOperacional: { findUnique: vi.fn(), create: vi.fn() },
  operacionalClientes: { create: vi.fn(), findMany: vi.fn() },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  buscarClienteParaVincularOperacional,
  vincularEmpresaAoCliente,
  cadastrarApenasCliente,
} from "@/actions/ClientesOperacional";

describe("buscarClienteParaVincularOperacional — pré-visualização (Fase 3.5 do Cliente Master)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita CNPJ incompleto sem consultar o banco", async () => {
    const resultado = await buscarClienteParaVincularOperacional("123");

    expect(resultado.success).toBe(false);
    expect(prismaMock.cliente.findUnique).not.toHaveBeenCalled();
  });

  it("bloqueia com mensagem clara quando o CNPJ não existe em Cliente (NUNCA cria)", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue(null);

    const resultado = await buscarClienteParaVincularOperacional("12.345.678/0001-90");

    expect(prismaMock.cliente.findUnique).toHaveBeenCalledWith({
      where: { cnpj: "12345678000190" },
      select: { cnpj: true, razaoSocial: true, nomeFantasia: true },
    });
    expect(resultado).toEqual({
      success: false,
      error: "Esta empresa ainda não está cadastrada no CRM — cadastre-a primeiro no Alpha CRM antes de vincular ao Operacional.",
    });
  });

  it("retorna os dados do Cliente já cadastrado", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({
      cnpj: "12345678000190",
      razaoSocial: "EMPRESA TESTE LTDA",
      nomeFantasia: "TESTE",
    });

    const resultado = await buscarClienteParaVincularOperacional("12345678000190");

    expect(resultado).toEqual({
      success: true,
      data: { cnpj: "12345678000190", razaoSocial: "EMPRESA TESTE LTDA", nomeFantasia: "TESTE" },
    });
  });
});

describe("vincularEmpresaAoCliente — vincular empresa já existente a um acesso do portal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita payload inválido antes de consultar o banco", async () => {
    const resultado = await vincularEmpresaAoCliente({ cnpj: "" });

    expect(resultado.success).toBe(false);
    expect(prismaMock.cliente.findUnique).not.toHaveBeenCalled();
  });

  it("bloqueia com mensagem clara quando o CNPJ não existe em Cliente (NUNCA cria)", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue(null);

    const resultado = await vincularEmpresaAoCliente({
      cnpj: "12.345.678/0001-90",
      clienteOperacionalId: "acesso-1",
    });

    expect(resultado).toEqual({
      success: false,
      error: "Esta empresa ainda não está cadastrada no CRM — cadastre-a primeiro no Alpha CRM antes de vincular ao Operacional.",
    });
    expect(prismaMock.operacionalClientes.create).not.toHaveBeenCalled();
  });

  it("bloqueia quando o acesso do cliente (login) não existe", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 501 });
    prismaMock.clienteOperacional.findUnique.mockResolvedValue(null);

    const resultado = await vincularEmpresaAoCliente({
      cnpj: "12345678000190",
      clienteOperacionalId: "acesso-inexistente",
    });

    expect(resultado).toEqual({ success: false, error: "Acesso de cliente não encontrado." });
    expect(prismaMock.operacionalClientes.create).not.toHaveBeenCalled();
  });

  it("vincula quando Cliente e acesso existem", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 501 });
    prismaMock.clienteOperacional.findUnique.mockResolvedValue({ id: "acesso-1" });
    prismaMock.operacionalClientes.create.mockResolvedValue({ id: "op-1" });

    const resultado = await vincularEmpresaAoCliente({
      cnpj: "12.345.678/0001-90",
      clienteOperacionalId: "acesso-1",
    });

    expect(prismaMock.operacionalClientes.create).toHaveBeenCalledWith({
      data: {
        clienteId: 501,
        clienteOperacionalId: "acesso-1",
        embasamento: "",
        status: "ATIVO",
      },
    });
    expect(resultado).toEqual({ success: true });
  });
});

describe("cadastrarApenasCliente — criação de acesso do portal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita e-mail já cadastrado", async () => {
    prismaMock.clienteOperacional.findUnique.mockResolvedValue({ id: "existente" });

    const resultado = await cadastrarApenasCliente({
      nome: "Fulano",
      email: "fulano@teste.com",
      senha: "123456",
    });

    expect(resultado).toEqual({ success: false, error: "Este e-mail já está cadastrado em outro acesso." });
    expect(prismaMock.clienteOperacional.create).not.toHaveBeenCalled();
  });

  it("cria acesso novo quando o e-mail não existe", async () => {
    prismaMock.clienteOperacional.findUnique.mockResolvedValue(null);
    prismaMock.clienteOperacional.create.mockResolvedValue({ id: "novo-acesso" });

    const resultado = await cadastrarApenasCliente({
      nome: "Fulano",
      email: "fulano@teste.com",
      senha: "123456",
    });

    expect(resultado).toEqual({ success: true, id: "novo-acesso" });
  });
});
