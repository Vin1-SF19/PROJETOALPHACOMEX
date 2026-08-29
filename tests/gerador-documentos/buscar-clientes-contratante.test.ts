import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPermissoesEfetivas: vi.fn(),
  findManyCliente: vi.fn(),
  extractTextFromBuffer: vi.fn(),
  put: vi.fn(),
  identificarVariaveisEClasulasViaIA: vi.fn(),
  getUserOnyxToken: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: mocks.transaction,
    cliente: { findMany: mocks.findManyCliente },
    documentoTemplate: { create: vi.fn() },
    documentoClasula: { createMany: vi.fn() },
  },
}));

vi.mock("@/actions/PermissoesSetor", () => ({
  getPermissoesEfetivas: mocks.getPermissoesEfetivas,
}));

vi.mock("@/lib/bibble/tika", () => ({ extractTextFromBuffer: mocks.extractTextFromBuffer }));
vi.mock("@vercel/blob", () => ({ put: mocks.put }));
vi.mock("@/lib/onyx/user-token", () => ({ getUserOnyxToken: mocks.getUserOnyxToken }));
vi.mock("@/lib/gerador-documentos/onyx", () => ({
  identificarVariaveisEClasulasViaIA: mocks.identificarVariaveisEClasulasViaIA,
  reescreverClasulaViaIA: vi.fn(),
}));

import { BuscarClientesParaContratante } from "@/actions/gerador-documentos";

describe("BuscarClientesParaContratante", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "10", role: "User" } });
    mocks.getPermissoesEfetivas.mockResolvedValue(["geradorDocumentos"]);
  });

  it("retorna vazio para termo com menos de 2 caracteres, sem consultar o banco", async () => {
    const resultado = await BuscarClientesParaContratante("a");

    expect(resultado).toEqual({ success: true, data: [] });
    expect(mocks.findManyCliente).not.toHaveBeenCalled();
  });

  it("retorna vazio para termo vazio, sem consultar o banco", async () => {
    const resultado = await BuscarClientesParaContratante("   ");

    expect(resultado).toEqual({ success: true, data: [] });
    expect(mocks.findManyCliente).not.toHaveBeenCalled();
  });

  it("busca no banco quando o termo tem 2+ caracteres", async () => {
    mocks.findManyCliente.mockResolvedValue([
      { id: 1, razaoSocial: "Empresa Alpha", nomeFantasia: "Alpha", cnpj: "12345678000190" },
    ]);

    const resultado = await BuscarClientesParaContratante("alpha");

    expect(resultado.success).toBe(true);
    expect(mocks.findManyCliente).toHaveBeenCalledTimes(1);
    if (resultado.success) {
      expect(resultado.data).toHaveLength(1);
    }
  });

  it("bloqueia usuário não autenticado sem consultar o banco", async () => {
    mocks.auth.mockResolvedValue(null);

    const resultado = await BuscarClientesParaContratante("alpha");

    expect(resultado.success).toBe(false);
    expect(mocks.findManyCliente).not.toHaveBeenCalled();
  });

  it("bloqueia usuário sem permissão do módulo", async () => {
    mocks.getPermissoesEfetivas.mockResolvedValue(["outroModulo"]);

    const resultado = await BuscarClientesParaContratante("alpha");

    expect(resultado.success).toBe(false);
    expect(mocks.findManyCliente).not.toHaveBeenCalled();
  });
});
