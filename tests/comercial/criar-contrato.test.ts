import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  usuarios: { findUnique: vi.fn() },
  cliente: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  contratoComercial: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { trigger: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("./Clientes", () => ({ criarRegistroClienteAPartirDeContrato: vi.fn() }));

import { criarContrato, atualizarContrato, buscarClienteParaContrato, listarClientesEmConstituicao } from "@/actions/ContratoComercial";

const SESSION_COMERCIAL = { user: { id: "7", role: "COMERCIAL" } };

function payloadBase(overrides: Record<string, unknown> = {}) {
  return {
    cnpj: "12.345.678/0001-90",
    razaoSocial: "EMPRESA TESTE LTDA",
    valorContrato: 5000,
    formaPagamento: "A_VISTA_DESCONTO",
    servico: "Revisão de RADAR Ilimitado",
    canalAquisicao: "Prospecção Interna",
    closerNome: "Fulano",
    mes: 8,
    ano: 2026,
    ...overrides,
  };
}

describe("criarContrato — resolve OU cria Cliente por CNPJ (Fase 3.6 do Cliente Master)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(SESSION_COMERCIAL);
    prismaMock.usuarios.findUnique.mockResolvedValue({ role: "COMERCIAL" });
  });

  it("bloqueia sem sessão autenticada", async () => {
    authMock.mockResolvedValue(null);

    const resultado = await criarContrato(payloadBase());

    expect(resultado.success).toBe(false);
    expect(prismaMock.contratoComercial.create).not.toHaveBeenCalled();
  });

  it("bloqueia usuário sem permissão comercial", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({ role: "OPERACIONAL" });

    const resultado = await criarContrato(payloadBase());

    expect(resultado).toEqual({ success: false, error: "Sem permissão" });
  });

  it("vincula ao Cliente já existente quando o CNPJ já está cadastrado (NÃO cria de novo)", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 501 });
    prismaMock.contratoComercial.create.mockResolvedValue({ id: "contrato-1", clienteId: 501 });

    const resultado = await criarContrato(payloadBase());

    expect(prismaMock.cliente.findUnique).toHaveBeenCalledWith({
      where: { cnpj: "12345678000190" },
      select: { id: true },
    });
    expect(prismaMock.cliente.create).not.toHaveBeenCalled();
    expect(prismaMock.contratoComercial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clienteId: 501 }),
    });
    expect(resultado.success).toBe(true);
  });

  it("cria um Cliente novo quando o CNPJ não existe ainda (diferente de Extratos/Operacional: aqui NÃO bloqueia)", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue(null);
    prismaMock.cliente.create.mockResolvedValue({ id: 900 });
    prismaMock.contratoComercial.create.mockResolvedValue({ id: "contrato-2", clienteId: 900 });

    const resultado = await criarContrato(payloadBase());

    expect(prismaMock.cliente.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cnpj: "12345678000190", razaoSocial: "EMPRESA TESTE LTDA" }),
      select: { id: true },
    });
    expect(prismaMock.contratoComercial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ clienteId: 900 }),
    });
    expect(resultado.success).toBe(true);
  });

  it("resolve por clienteId direto (fluxo Empresa em Constituição) sem tocar CNPJ", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 42 });
    prismaMock.contratoComercial.create.mockResolvedValue({ id: "contrato-3", clienteId: 42 });

    const resultado = await criarContrato(payloadBase({ cnpj: undefined, razaoSocial: undefined, clienteId: 42 }));

    expect(prismaMock.cliente.findUnique).toHaveBeenCalledWith({ where: { id: 42 }, select: { id: true } });
    expect(prismaMock.cliente.create).not.toHaveBeenCalled();
    expect(resultado.success).toBe(true);
  });

  it("bloqueia quando clienteId (Empresa em Constituição) não existe", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue(null);

    const resultado = await criarContrato(payloadBase({ cnpj: undefined, razaoSocial: undefined, clienteId: 999 }));

    expect(resultado).toEqual({ success: false, error: "Empresa em constituição não encontrada" });
    expect(prismaMock.contratoComercial.create).not.toHaveBeenCalled();
  });

  it("cadastra empresa em constituição sem CNPJ ou cadastro prévio, junto ao contrato", async () => {
    prismaMock.contratoComercial.create.mockResolvedValue({ id: "contrato-novo" });

    const resultado = await criarContrato(payloadBase({
      cnpj: undefined, razaoSocial: undefined, empresaEmConstituicao: true,
    }));

    expect(resultado.success).toBe(true);
    expect(prismaMock.cliente.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.cliente.create).not.toHaveBeenCalled();
    expect(prismaMock.contratoComercial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cliente: { create: { cnpj: null, razaoSocial: "Em constituição" } },
        usuario: { connect: { id: 7 } },
      }),
    });
    expect(prismaMock.contratoComercial.create.mock.calls[0][0].data).not.toHaveProperty("clienteId");
  });

  it("não reaproveita uma empresa genérica entre dois cadastros sem CNPJ", async () => {
    prismaMock.contratoComercial.create.mockResolvedValue({ id: "contrato-novo" });
    const payload = payloadBase({ cnpj: undefined, razaoSocial: undefined, empresaEmConstituicao: true });
    await criarContrato(payload);
    await criarContrato(payload);

    expect(prismaMock.cliente.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.contratoComercial.create).toHaveBeenCalledTimes(2);
    for (const [args] of prismaMock.contratoComercial.create.mock.calls) {
      expect(args.data.cliente).toEqual({ create: { cnpj: null, razaoSocial: "Em constituição" } });
    }
  });

  it("trata falha na gravação conjunta sem criar empresa em uma operação separada", async () => {
    prismaMock.contratoComercial.create.mockRejectedValueOnce(new Error("falha simulada"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const resultado = await criarContrato(payloadBase({
        cnpj: undefined, razaoSocial: undefined, empresaEmConstituicao: true,
      }));
      expect(resultado).toEqual({ success: false, error: "Erro ao criar contrato" });
      expect(prismaMock.cliente.create).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it.each([undefined, false, "true"])("não aceita cadastro sem identificação com marcador %s", async (marcador) => {
    const resultado = await criarContrato(payloadBase({
      cnpj: undefined, razaoSocial: undefined, empresaEmConstituicao: marcador,
    }));
    expect(resultado.success).toBe(false);
    expect(prismaMock.contratoComercial.create).not.toHaveBeenCalled();
  });

  it("aplica permissões também ao cadastro em constituição", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({ role: "OPERACIONAL" });
    const resultado = await criarContrato(payloadBase({ empresaEmConstituicao: true }));
    expect(resultado).toEqual({ success: false, error: "Sem permissão" });
    expect(prismaMock.contratoComercial.create).not.toHaveBeenCalled();
  });

  it("preserva a empresa existente ao editar contrato sem CNPJ", async () => {
    const id = "cmuh4n69p00000agm844kax9s";
    prismaMock.contratoComercial.findUnique.mockResolvedValue({ id, clienteId: 42, usuarioId: 7 });
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 42 });
    prismaMock.contratoComercial.update.mockResolvedValue({ id, clienteId: 42 });

    const resultado = await atualizarContrato(payloadBase({
      id, cnpj: undefined, razaoSocial: undefined, clienteId: 42,
    }));

    expect(resultado.success).toBe(true);
    expect(prismaMock.contratoComercial.update).toHaveBeenCalledWith({
      where: { id }, data: expect.objectContaining({ clienteId: 42 }),
    });
    expect(prismaMock.contratoComercial.update.mock.calls[0][0].data).not.toHaveProperty("cliente");
    expect(prismaMock.cliente.create).not.toHaveBeenCalled();
  });

  it("permite trocar para empresa em constituição na edição sem alterar a empresa anterior", async () => {
    const id = "cmuh4n69p00000agm844kax9s";
    prismaMock.contratoComercial.findUnique.mockResolvedValue({ id, clienteId: 42, usuarioId: 7 });
    prismaMock.contratoComercial.update.mockResolvedValue({ id, clienteId: 99 });
    const resultado = await atualizarContrato(payloadBase({
      id, cnpj: undefined, razaoSocial: undefined, empresaEmConstituicao: true,
    }));
    expect(resultado.success).toBe(true);
    expect(prismaMock.contratoComercial.update).toHaveBeenCalledWith({
      where: { id }, data: expect.objectContaining({
        cliente: { create: { cnpj: null, razaoSocial: "Em constituição" } },
      }),
    });
    expect(prismaMock.cliente.create).not.toHaveBeenCalled();
    expect(prismaMock.cliente.findUnique).not.toHaveBeenCalled();
  });
});

describe("buscarClienteParaContrato — pré-visualização, nunca bloqueia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(SESSION_COMERCIAL);
  });

  it("retorna cliente: null quando não encontrado (não é erro)", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue(null);

    const resultado = await buscarClienteParaContrato("12345678000190");

    expect(resultado).toEqual({ success: true, cliente: null });
  });

  it("retorna os dados do Cliente quando encontrado", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({
      cnpj: "12345678000190", razaoSocial: "EMPRESA TESTE LTDA", nomeFantasia: null,
      dataConstituicao: null, regimeTributario: null, uf: null,
    });

    const resultado = await buscarClienteParaContrato("12.345.678/0001-90");

    expect(resultado.success).toBe(true);
    expect(resultado).toMatchObject({ cliente: { razaoSocial: "EMPRESA TESTE LTDA" } });
  });
});

describe("listarClientesEmConstituicao — só Clientes com cnpj null", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(SESSION_COMERCIAL);
  });

  it("filtra por cnpj: null", async () => {
    prismaMock.cliente.findMany.mockResolvedValue([{ id: 1, razaoSocial: "EM CONSTITUIÇÃO LTDA" }]);

    const resultado = await listarClientesEmConstituicao();

    expect(prismaMock.cliente.findMany).toHaveBeenCalledWith({
      where: { cnpj: null },
      select: { id: true, razaoSocial: true },
      orderBy: { razaoSocial: "asc" },
    });
    expect(resultado.success).toBe(true);
  });
});
