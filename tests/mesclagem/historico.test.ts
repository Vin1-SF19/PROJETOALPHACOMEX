import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usuario: vi.fn(),
  listar: vi.fn(),
  obter: vi.fn(),
  criar: vi.fn(),
  armazenar: vi.fn(),
  excluir: vi.fn(),
  baixar: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    usuarios: { findUnique: mocks.usuario },
    mesclagemHistorico: { findMany: mocks.listar, findUnique: mocks.obter, create: mocks.criar },
  },
}));
vi.mock("@/lib/mesclagem/storage", () => ({
  armazenarArquivosMesclagem: mocks.armazenar,
  excluirArquivosMesclagem: mocks.excluir,
  baixarArquivoMesclagem: mocks.baixar,
}));

import {
  listarHistoricoMesclagem,
  obterArquivoHistoricoMesclagem,
  obterHistoricoMesclagem,
  registrarHistoricoMesclagem,
} from "@/lib/mesclagem/historico";

const registro = {
  id: "hist-1",
  criadoPorId: 7,
  principalNome: "principal.xlsx",
  principalStorageKey: "chave-principal",
  principalTamanhoBytes: 10,
  complementarNome: "complementar.xlsx",
  complementarStorageKey: "chave-complementar",
  complementarTamanhoBytes: 20,
  resultadoNome: "resultado.xlsx",
  resultadoStorageKey: "chave-resultado",
  resultadoTamanhoBytes: 30,
  criadoPor: { nome: "Usuário" },
};

describe("Histórico da Mesclagem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listar.mockResolvedValue([]);
    mocks.obter.mockResolvedValue(registro);
    mocks.usuario.mockResolvedValue({ role: "Comercial" });
    mocks.armazenar.mockResolvedValue({ principal: "p", complementar: "c", resultado: "r" });
    mocks.criar.mockResolvedValue({ id: "hist-1" });
    mocks.excluir.mockResolvedValue(undefined);
  });

  it("limita a listagem do usuário comum às próprias mesclagens", async () => {
    await listarHistoricoMesclagem(7);
    expect(mocks.listar).toHaveBeenCalledWith(expect.objectContaining({ where: { criadoPorId: 7 }, take: 50 }));
  });

  it("permite que administrador liste o histórico global", async () => {
    mocks.usuario.mockResolvedValue({ role: "Admin" });
    await listarHistoricoMesclagem(1);
    expect(mocks.listar).toHaveBeenCalledWith(expect.objectContaining({ where: undefined, take: 50 }));
  });

  it("não revela registro nem arquivo de outro usuário", async () => {
    await expect(obterHistoricoMesclagem(8, "hist-1")).resolves.toBeNull();
    await expect(obterArquivoHistoricoMesclagem(8, "hist-1", "resultado")).resolves.toBeNull();
    expect(mocks.baixar).not.toHaveBeenCalled();
  });

  it("permite download administrativo do arquivo autorizado", async () => {
    mocks.usuario.mockResolvedValue({ role: "TI" });
    mocks.baixar.mockResolvedValue({ async *[Symbol.asyncIterator]() { yield new Uint8Array([1]); } });
    const arquivo = await obterArquivoHistoricoMesclagem(8, "hist-1", "resultado");
    expect(arquivo).toMatchObject({ nome: "resultado.xlsx", tamanho: 30 });
    expect(mocks.baixar).toHaveBeenCalledWith("chave-resultado");
  });

  it("registra somente metadados e remove objetos se o banco falhar", async () => {
    mocks.criar.mockRejectedValue(new Error("banco indisponível"));
    const principal = new File(["a"], "principal.csv", { type: "text/csv" });
    const complementar = new File(["b"], "complementar.csv", { type: "text/csv" });
    await expect(registrarHistoricoMesclagem({
      userId: 7,
      principal,
      complementar,
      resultado: Buffer.from("xlsx"),
      resultadoNome: "resultado.xlsx",
      resumo: {
        totalLinhas: 1,
        comMatch: 1,
        semMatch: 0,
        linhasComplementares: 1,
        cnpj: { status: "valido", total: 1, validos: 1, invalidos: 0, vazios: 0, duplicados: 0, exemplosInvalidos: [] },
      },
    })).rejects.toThrow("banco indisponível");
    expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ criadoPorId: 7, linhasResultado: 1 }),
    }));
    expect(mocks.excluir).toHaveBeenCalledWith(["p", "c", "r"]);
  });
});
