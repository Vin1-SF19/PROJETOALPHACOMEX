import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  cliente: { findUnique: vi.fn() },
  extratos: { upsert: vi.fn(), findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { ExtratosClientes } from "@/actions/Extratos";

describe("ExtratosClientes — vincular empresa já existente (Fase 3.3 do Cliente Master)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", nome: "Analista Alpha" } });
  });

  it("bloqueia sem sessão autenticada", async () => {
    authMock.mockResolvedValue(null);

    const resultado = await ExtratosClientes({ cnpj: "12.345.678/0001-90" });

    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.cliente.findUnique).not.toHaveBeenCalled();
  });

  it("rejeita CNPJ inválido antes de consultar o banco", async () => {
    const resultado = await ExtratosClientes({ cnpj: "123" });

    expect(resultado.success).toBe(false);
    expect(prismaMock.cliente.findUnique).not.toHaveBeenCalled();
  });

  it("bloqueia com mensagem clara quando o CNPJ não existe em Cliente (NUNCA cria)", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue(null);

    const resultado = await ExtratosClientes({ cnpj: "12.345.678/0001-90" });

    expect(prismaMock.cliente.findUnique).toHaveBeenCalledWith({
      where: { cnpj: "12345678000190" },
      select: { id: true },
    });
    expect(resultado).toEqual({
      success: false,
      error: "Esta empresa ainda não está cadastrada no CRM — cadastre-a primeiro no Alpha CRM antes de vincular ao Extratos.",
    });
    expect(prismaMock.extratos.upsert).not.toHaveBeenCalled();
  });

  it("vincula (upsert por clienteId) quando o Cliente já existe", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 501 });
    prismaMock.extratos.upsert.mockResolvedValue({ id: 1, clienteId: 501 });

    const resultado = await ExtratosClientes({ cnpj: "12.345.678/0001-90" });

    expect(prismaMock.extratos.upsert).toHaveBeenCalledWith({
      where: { clienteId: 501 },
      update: {},
      create: { clienteId: 501, criadoPorNome: "Analista Alpha" },
    });
    expect(resultado).toEqual({ success: true });
  });

  it("é idempotente — vincular a mesma empresa 2x não duplica nem falha", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 501 });
    prismaMock.extratos.upsert.mockResolvedValue({ id: 1, clienteId: 501 });

    const primeira = await ExtratosClientes({ cnpj: "12.345.678/0001-90" });
    const segunda = await ExtratosClientes({ cnpj: "12345678000190" });

    expect(primeira.success).toBe(true);
    expect(segunda.success).toBe(true);
    expect(prismaMock.extratos.upsert).toHaveBeenCalledTimes(2);
  });
});
