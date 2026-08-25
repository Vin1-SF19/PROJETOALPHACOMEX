import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const mock = {
    pessoa: { upsert: vi.fn() },
    pessoaClienteVinculo: { upsert: vi.fn() },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation((cb: (tx: typeof mock) => unknown) => cb(mock));
  return mock;
});

const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { adicionarSocio } from "@/actions/Clientes";
import { gerarTelefonePendente, paraExibicaoTelefone } from "@/lib/validations/cs-nps";

describe("gerarTelefonePendente / paraExibicaoTelefone (placeholder de telefone do sócio, 2026-08-25)", () => {
  it("gera valores sempre prefixados e únicos entre chamadas", () => {
    const a = gerarTelefonePendente();
    const b = gerarTelefonePendente();

    expect(a).toMatch(/^SEM-TELEFONE-/);
    expect(b).toMatch(/^SEM-TELEFONE-/);
    expect(a).not.toBe(b);
  });

  it("normaliza um placeholder de volta para string vazia", () => {
    expect(paraExibicaoTelefone(gerarTelefonePendente())).toBe("");
  });

  it("normaliza null/undefined/vazio para string vazia", () => {
    expect(paraExibicaoTelefone(null)).toBe("");
    expect(paraExibicaoTelefone(undefined)).toBe("");
    expect(paraExibicaoTelefone("")).toBe("");
  });

  it("preserva um telefone real intacto", () => {
    expect(paraExibicaoTelefone("11987654321")).toBe("11987654321");
  });
});

describe("adicionarSocio — sócio sem telefone (Fase 3.6 do Cliente Master, placeholder 2026-08-25)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", nome: "Ana Responsável" } });
  });

  it("gera um placeholder único como celular quando telefone não é informado, e nunca o expõe no retorno", async () => {
    prismaMock.pessoa.upsert.mockResolvedValue({ id: 99, celular: "SEM-TELEFONE-mock", nome: "João" });
    prismaMock.pessoaClienteVinculo.upsert.mockResolvedValue({
      pessoaId: 99,
      clienteId: 501,
      vinculo: "Sócio Proprietário",
      pessoa: { id: 99, nome: "João", celular: "SEM-TELEFONE-mock", observacao: null, dataNascimento: null },
    });

    const resultado = await adicionarSocio(501, {
      nome: "João",
      telefone: "",
      vinculo: "Sócio Proprietário",
    });

    expect(resultado.success).toBe(true);
    if (!resultado.success || !resultado.data) throw new Error("esperado sucesso com data");
    // O celular passado pro Prisma tem que ser o placeholder, nunca string vazia
    // (celular="" colidiria com outro sócio sem telefone de um cliente diferente
    // via `Pessoa.celular @unique`).
    const chamada = prismaMock.pessoa.upsert.mock.calls[0][0];
    expect(chamada.where.celular).toMatch(/^SEM-TELEFONE-/);
    expect(chamada.create.celular).toMatch(/^SEM-TELEFONE-/);
    // O telefone devolvido pro client nunca pode ser o placeholder cru.
    expect(resultado.data.telefone).toBe("");
  });

  it("usa o telefone real informado, sem gerar placeholder", async () => {
    prismaMock.pessoa.upsert.mockResolvedValue({ id: 100, celular: "11987654321", nome: "Maria" });
    prismaMock.pessoaClienteVinculo.upsert.mockResolvedValue({
      pessoaId: 100,
      clienteId: 501,
      vinculo: "Sócio Oculto",
      pessoa: { id: 100, nome: "Maria", celular: "11987654321", observacao: null, dataNascimento: null },
    });

    const resultado = await adicionarSocio(501, {
      nome: "Maria",
      telefone: "11987654321",
      vinculo: "Sócio Oculto",
    });

    expect(resultado.success).toBe(true);
    if (!resultado.success || !resultado.data) throw new Error("esperado sucesso com data");
    const chamada = prismaMock.pessoa.upsert.mock.calls[0][0];
    expect(chamada.where.celular).toBe("11987654321");
    expect(resultado.data.telefone).toBe("11987654321");
  });

  it("dois sócios sem telefone, adicionados em chamadas separadas, recebem placeholders diferentes (não colidem)", async () => {
    prismaMock.pessoa.upsert.mockResolvedValue({ id: 1, celular: "x", nome: "A" });
    prismaMock.pessoaClienteVinculo.upsert.mockResolvedValue({
      pessoaId: 1,
      clienteId: 501,
      vinculo: "Sócio Proprietário",
      pessoa: { id: 1, nome: "A", celular: "x", observacao: null, dataNascimento: null },
    });

    await adicionarSocio(501, { nome: "Sócio A", telefone: "", vinculo: "Sócio Proprietário" });
    await adicionarSocio(502, { nome: "Sócio B", telefone: "", vinculo: "Sócio Proprietário" });

    const celularA = prismaMock.pessoa.upsert.mock.calls[0][0].where.celular;
    const celularB = prismaMock.pessoa.upsert.mock.calls[1][0].where.celular;
    expect(celularA).not.toBe(celularB);
  });
});
