import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  operacionalClientes: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  pastaChecklist: { findUnique: vi.fn() },
  checklist: { findUnique: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { getEmpresasChecklist, getEmpresaChecklist, atualizarEmpresaChecklist } from "@/actions/checklist";

describe("getEmpresasChecklist — achata Cliente master (Fase 3.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7" } });
  });

  it("achata os campos cadastrais de Cliente no shape esperado pela UI", async () => {
    prismaMock.operacionalClientes.findMany.mockResolvedValue([
      {
        id: "op-1",
        status: "ATIVO",
        embasamento: "RECEITA_BRUTA_DAS",
        tipo: null,
        progresso: 40,
        mesProtocolo: "08/2026",
        linkGrupo: null,
        cliente: {
          cnpj: "12345678000190",
          razaoSocial: "EMPRESA TESTE LTDA",
          nomeFantasia: "TESTE",
          municipio: "São Paulo",
          uf: "SP",
          regimeTributario: "Simples Nacional",
          capitalSocial: "10000",
          dataConstituicao: "2020-01-01",
        },
        clienteOperacional: { nome: "Fulano" },
        pastaChecklist: null,
        checklists: [],
      },
    ]);

    const resultado = await getEmpresasChecklist();

    expect(resultado.data).toEqual([
      expect.objectContaining({
        id: "op-1",
        cnpj: "12345678000190",
        razaoSocial: "EMPRESA TESTE LTDA",
        nomeFantasia: "TESTE",
        municipio: "São Paulo",
        uf: "SP",
        regimeTributario: "Simples Nacional",
        capitalSocial: "10000",
        dataConstituicao: "2020-01-01",
        clienteNome: "Fulano",
      }),
    ]);
  });

  it("bloqueia sem sessão autenticada", async () => {
    authMock.mockResolvedValue(null);

    const resultado = await getEmpresasChecklist();

    expect(resultado.error).toBeDefined();
    expect(prismaMock.operacionalClientes.findMany).not.toHaveBeenCalled();
  });
});

describe("getEmpresaChecklist — achata Cliente e renomeia clienteOperacional (Fase 3.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7" } });
  });

  it("retorna 'cliente' como a conta de login (clienteOperacional), não o Cliente master", async () => {
    prismaMock.operacionalClientes.findUnique.mockResolvedValue({
      id: "op-1",
      status: "ATIVO",
      cliente: {
        cnpj: "12345678000190",
        razaoSocial: "EMPRESA TESTE LTDA",
        nomeFantasia: null,
        municipio: null,
        uf: null,
        regimeTributario: null,
        capitalSocial: null,
        dataConstituicao: null,
      },
      clienteOperacional: { nome: "Fulano", email: "fulano@teste.com" },
      checklists: [],
    });

    const resultado = await getEmpresaChecklist("op-1");

    expect(resultado.data).toMatchObject({
      cnpj: "12345678000190",
      razaoSocial: "EMPRESA TESTE LTDA",
      cliente: { nome: "Fulano", email: "fulano@teste.com" },
    });
  });

  it("retorna erro quando a empresa não existe", async () => {
    prismaMock.operacionalClientes.findUnique.mockResolvedValue(null);

    const resultado = await getEmpresaChecklist("inexistente");

    expect(resultado.error).toBe("Empresa não encontrada");
  });
});

describe("atualizarEmpresaChecklist — não grava mais campos cadastrais (Fase 3.5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7" } });
    prismaMock.$transaction.mockImplementation(async (fn) =>
      fn({
        operacionalClientes: prismaMock.operacionalClientes,
        checklist: prismaMock.checklist,
      })
    );
  });

  it("atualiza apenas os campos de negócio permitidos, sem razaoSocial/cnpj/uf/etc", async () => {
    prismaMock.operacionalClientes.findUnique.mockResolvedValue({ tipo: null });
    prismaMock.operacionalClientes.update.mockResolvedValue({});

    const resultado = await atualizarEmpresaChecklist({
      empresaId: "op-1",
      status: "ATIVO",
      embasamento: "RECEITA_BRUTA_DAS",
      tipo: null,
      pastaChecklistId: null,
      mesProtocolo: "08/2026",
      linkGrupo: null,
    });

    expect(prismaMock.operacionalClientes.update).toHaveBeenCalledWith({
      where: { id: "op-1" },
      data: {
        status: "ATIVO",
        embasamento: "RECEITA_BRUTA_DAS",
        tipo: null,
        pastaChecklistId: null,
        mesProtocolo: "08/2026",
        linkGrupo: null,
      },
    });
    expect(resultado).toEqual({ success: true });
  });

  it("rejeita payload que ainda tente mandar razaoSocial (schema não aceita mais)", async () => {
    const resultado = await atualizarEmpresaChecklist({
      empresaId: "op-1",
      status: "ATIVO",
      embasamento: "",
      tipo: null,
      pastaChecklistId: null,
      mesProtocolo: null,
      linkGrupo: null,
      // @ts-expect-error — campo removido do schema, não deve mais ser aceito
      razaoSocial: "TENTATIVA DE BURLAR",
    });

    expect(prismaMock.operacionalClientes.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ razaoSocial: expect.anything() }),
      })
    );
    expect(resultado.error).toBeUndefined();
  });
});
