import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPermissoesEfetivas: vi.fn(),
  getReceitaData: vi.fn(),
  findUniqueEmpresa: vi.fn(),
  findFirstEmpresa: vi.fn(),
  createEmpresa: vi.fn(),
  updateEmpresa: vi.fn(),
  findManyEmpresa: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  default: {
    empresaContratada: {
      findUnique: mocks.findUniqueEmpresa,
      findFirst: mocks.findFirstEmpresa,
      create: mocks.createEmpresa,
      update: mocks.updateEmpresa,
      findMany: mocks.findManyEmpresa,
    },
  },
}));

vi.mock("@/actions/PermissoesSetor", () => ({
  getPermissoesEfetivas: mocks.getPermissoesEfetivas,
}));

vi.mock("@/app/api/ReceitaFederal/route", () => ({
  getReceitaData: mocks.getReceitaData,
}));

import {
  CriarEmpresaContratada,
  ListarEmpresasContratadas,
  AtualizarEmpresaContratada,
  ConsultarCnpjParaQualificacao,
} from "@/actions/empresas-contratadas";

const PAYLOAD_VALIDO = {
  razaoSocial: "Empresa Teste LTDA",
  cnpj: "12345678000190",
};

describe("CriarEmpresaContratada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "10", role: "User" } });
    mocks.getPermissoesEfetivas.mockResolvedValue(["geradorDocumentos"]);
  });

  it("cria com sucesso quando o CNPJ é novo", async () => {
    mocks.findUniqueEmpresa.mockResolvedValue(null);
    mocks.createEmpresa.mockResolvedValue({ id: "empresa-1" });

    const resultado = await CriarEmpresaContratada(PAYLOAD_VALIDO);

    expect(resultado).toEqual({ success: true, empresaId: "empresa-1" });
    expect(mocks.createEmpresa).toHaveBeenCalledTimes(1);
  });

  it("rejeita CNPJ duplicado sem chamar create", async () => {
    mocks.findUniqueEmpresa.mockResolvedValue({ id: "empresa-existente" });

    const resultado = await CriarEmpresaContratada(PAYLOAD_VALIDO);

    expect(resultado).toEqual({ success: false, error: "CNPJ já cadastrado" });
    expect(mocks.createEmpresa).not.toHaveBeenCalled();
  });

  it("bloqueia usuário sem permissão do módulo, sem tocar no banco", async () => {
    mocks.getPermissoesEfetivas.mockResolvedValue(["outroModulo"]);

    const resultado = await CriarEmpresaContratada(PAYLOAD_VALIDO);

    expect(resultado.success).toBe(false);
    expect(mocks.findUniqueEmpresa).not.toHaveBeenCalled();
    expect(mocks.createEmpresa).not.toHaveBeenCalled();
  });

  it("bloqueia usuário não autenticado", async () => {
    mocks.auth.mockResolvedValue(null);

    const resultado = await CriarEmpresaContratada(PAYLOAD_VALIDO);

    expect(resultado.success).toBe(false);
    expect(mocks.createEmpresa).not.toHaveBeenCalled();
  });

  it("rejeita payload inválido (razão social vazia) antes de tocar no banco", async () => {
    const resultado = await CriarEmpresaContratada({ razaoSocial: "", cnpj: "12345678000190" });

    expect(resultado.success).toBe(false);
    expect(mocks.findUniqueEmpresa).not.toHaveBeenCalled();
  });
});

describe("ListarEmpresasContratadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "10", role: "User" } });
    mocks.getPermissoesEfetivas.mockResolvedValue(["geradorDocumentos"]);
  });

  it("lista apenas empresas ATIVO, sem expor representanteLegalCpf", async () => {
    mocks.findManyEmpresa.mockResolvedValue([
      { id: "e1", razaoSocial: "A", nomeFantasia: null, cnpj: "12345678000190" },
    ]);

    const resultado = await ListarEmpresasContratadas();

    expect(resultado.success).toBe(true);
    const chamada = mocks.findManyEmpresa.mock.calls[0][0];
    expect(chamada.where).toEqual({ status: "ATIVO" });
    expect(chamada.select).not.toHaveProperty("representanteLegalCpf");
  });
});

describe("AtualizarEmpresaContratada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "10", role: "User" } });
    mocks.getPermissoesEfetivas.mockResolvedValue(["geradorDocumentos"]);
  });

  it("retorna erro se a empresa não existe", async () => {
    mocks.findUniqueEmpresa.mockResolvedValue(null);

    const resultado = await AtualizarEmpresaContratada({ empresaId: "clx0000000000000000000000", razaoSocial: "Nova" });

    expect(resultado).toEqual({ success: false, error: "Empresa não encontrada" });
    expect(mocks.updateEmpresa).not.toHaveBeenCalled();
  });

  it("rejeita quando o novo CNPJ colide com outra empresa", async () => {
    mocks.findUniqueEmpresa.mockResolvedValue({ id: "clx0000000000000000000000" });
    mocks.findFirstEmpresa.mockResolvedValue({ id: "outra-empresa" });

    const resultado = await AtualizarEmpresaContratada({
      empresaId: "clx0000000000000000000000",
      cnpj: "99999999000199",
    });

    expect(resultado).toEqual({ success: false, error: "CNPJ já cadastrado" });
    expect(mocks.updateEmpresa).not.toHaveBeenCalled();
  });

  it("permite manter o mesmo CNPJ da própria empresa (findFirst exclui o próprio id)", async () => {
    mocks.findUniqueEmpresa.mockResolvedValue({ id: "clx0000000000000000000000" });
    mocks.findFirstEmpresa.mockResolvedValue(null); // nenhuma OUTRA empresa tem esse CNPJ
    mocks.updateEmpresa.mockResolvedValue({ id: "clx0000000000000000000000" });

    const resultado = await AtualizarEmpresaContratada({
      empresaId: "clx0000000000000000000000",
      cnpj: "12345678000190",
    });

    expect(resultado).toEqual({ success: true });
    expect(mocks.findFirstEmpresa).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: "clx0000000000000000000000" } }) }),
    );
    expect(mocks.updateEmpresa).toHaveBeenCalledTimes(1);
  });
});

describe("ConsultarCnpjParaQualificacao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "10", role: "User" } });
    mocks.getPermissoesEfetivas.mockResolvedValue(["geradorDocumentos"]);
  });

  it("rejeita CNPJ com menos de 14 dígitos sem chamar getReceitaData", async () => {
    const resultado = await ConsultarCnpjParaQualificacao("123456789");

    expect(resultado.success).toBe(false);
    expect(mocks.getReceitaData).not.toHaveBeenCalled();
  });

  it("mapeia 'SEM NOME FANTASIA' para string vazia", async () => {
    mocks.getReceitaData.mockResolvedValue({
      razaoSocial: "Empresa X",
      nomeFantasia: "SEM NOME FANTASIA",
      cnpj: "12345678000190",
      logradouro: "Rua X",
      numero: "1",
      bairro: "Centro",
      municipio: "SP",
      uf: "SP",
      cep: "01000000",
      natureza_juridica: "LTDA",
    });

    const resultado = await ConsultarCnpjParaQualificacao("12345678000190");

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.nomeFantasia).toBe("");
    }
  });

  it("preserva nomeFantasia real quando existe", async () => {
    mocks.getReceitaData.mockResolvedValue({
      razaoSocial: "Empresa X",
      nomeFantasia: "NOME FANTASIA REAL",
      cnpj: "12345678000190",
      logradouro: "Rua X",
      numero: "1",
      bairro: "Centro",
      municipio: "SP",
      uf: "SP",
      cep: "01000000",
      natureza_juridica: "LTDA",
    });

    const resultado = await ConsultarCnpjParaQualificacao("12345678000190");

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.nomeFantasia).toBe("NOME FANTASIA REAL");
    }
  });

  it("propaga erro amigável quando getReceitaData falha", async () => {
    mocks.getReceitaData.mockRejectedValue(new Error("CNPJ não encontrado na Receita Federal"));

    const resultado = await ConsultarCnpjParaQualificacao("12345678000190");

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error).toBe("CNPJ não encontrado na Receita Federal");
    }
  });
});
