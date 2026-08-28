import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  cliente: { upsert: vi.fn() },
  extratos: { upsert: vi.fn(), findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { ExtratosClientes } from "@/actions/Extratos";

const empresa = {
  cnpj: "12.345.678/0001-90",
  razaoSocial: "EMPRESA TESTE LTDA",
  nomeFantasia: "EMPRESA TESTE",
  dataConstituicao: "01/01/2020",
  municipio: "SÃO PAULO",
  uf: "SP",
  regimeTributario: "Simples Nacional",
};

describe("ExtratosClientes — cadastro e vínculo de empresa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", nome: "Analista Alpha" } });
  });

  it("bloqueia sem sessão autenticada", async () => {
    authMock.mockResolvedValue(null);

    const resultado = await ExtratosClientes(empresa);

    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.cliente.upsert).not.toHaveBeenCalled();
  });

  it("rejeita CNPJ inválido antes de consultar o banco", async () => {
    const resultado = await ExtratosClientes({ ...empresa, cnpj: "123" });

    expect(resultado.success).toBe(false);
    expect(prismaMock.cliente.upsert).not.toHaveBeenCalled();
  });

  it("rejeita CNPJ com menos de 14 dígitos antes de qualquer escrita", async () => {
    const resultado = await ExtratosClientes({ ...empresa, cnpj: "12.345.678/0001" });

    expect(resultado.success).toBe(false);
    expect(prismaMock.cliente.upsert).not.toHaveBeenCalled();
    expect(prismaMock.extratos.upsert).not.toHaveBeenCalled();
  });

  it("cria o Cliente master quando a empresa ainda não existe no CRM", async () => {
    prismaMock.cliente.upsert.mockResolvedValue({ id: 501 });
    prismaMock.extratos.upsert.mockResolvedValue({ id: 1, clienteId: 501 });

    const resultado = await ExtratosClientes(empresa);

    expect(prismaMock.cliente.upsert).toHaveBeenCalledWith({
      where: { cnpj: "12345678000190" },
      update: {},
      create: {
        cnpj: "12345678000190",
        razaoSocial: "EMPRESA TESTE LTDA",
        nomeFantasia: "EMPRESA TESTE",
        dataConstituicao: "01/01/2020",
        municipio: "SÃO PAULO",
        uf: "SP",
        regimeTributario: "Simples Nacional",
      },
      select: { id: true },
    });
    expect(resultado).toEqual({ success: true });
  });

  it("vincula (upsert por clienteId) quando o Cliente já existe", async () => {
    prismaMock.cliente.upsert.mockResolvedValue({ id: 501 });
    prismaMock.extratos.upsert.mockResolvedValue({ id: 1, clienteId: 501 });

    const resultado = await ExtratosClientes(empresa);

    expect(prismaMock.extratos.upsert).toHaveBeenCalledWith({
      where: { clienteId: 501 },
      update: {},
      create: { clienteId: 501, criadoPorNome: "Analista Alpha" },
    });
    expect(resultado).toEqual({ success: true });
  });

  it("é idempotente — vincular a mesma empresa 2x não duplica nem falha", async () => {
    prismaMock.cliente.upsert.mockResolvedValue({ id: 501 });
    prismaMock.extratos.upsert.mockResolvedValue({ id: 1, clienteId: 501 });

    const primeira = await ExtratosClientes(empresa);
    const segunda = await ExtratosClientes({ ...empresa, cnpj: "12345678000190" });

    expect(primeira.success).toBe(true);
    expect(segunda.success).toBe(true);
    expect(prismaMock.extratos.upsert).toHaveBeenCalledTimes(2);
  });
});
