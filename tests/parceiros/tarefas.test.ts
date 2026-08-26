import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  parceiro: { findUnique: vi.fn() },
  parceiroTarefa: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createMany: vi.fn(),
  },
  parceiroHistorico: { create: vi.fn() },
  $transaction: vi.fn(),
}));

const revalidatePathMock = vi.hoisted(() => vi.fn());
const getCtxMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/actions/parceiros", () => ({ getCtx: getCtxMock }));

import { CriarTarefaParceiro, ListarTarefasParceiro, ConcluirTarefaParceiro, ExcluirTarefaParceiro } from "@/actions/parceiros-tarefas";

const CTX_ADMIN = { userId: 1, role: "Admin", isAdmin: true, podeEditar: true, podeExcluir: true, podeAprovar: true };
const CTX_EDITOR = { userId: 2, role: "User", isAdmin: false, podeEditar: true, podeExcluir: false, podeAprovar: false };
const CTX_LEITOR = { userId: 3, role: "User", isAdmin: false, podeEditar: false, podeExcluir: false, podeAprovar: false };

describe("CriarTarefaParceiro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
  });

  it("rejeita usuário sem permissão de edição", async () => {
    getCtxMock.mockResolvedValue(CTX_LEITOR);
    const r = await CriarTarefaParceiro({ parceiroId: 1, titulo: "Ligar" });
    expect(r.success).toBe(false);
    expect(prismaMock.parceiroTarefa.create).not.toHaveBeenCalled();
  });

  it("rejeita sem sessão", async () => {
    getCtxMock.mockResolvedValue(null);
    const r = await CriarTarefaParceiro({ parceiroId: 1, titulo: "Ligar" });
    expect(r.success).toBe(false);
  });

  it("rejeita título vazio (Zod)", async () => {
    getCtxMock.mockResolvedValue(CTX_ADMIN);
    const r = await CriarTarefaParceiro({ parceiroId: 1, titulo: "" });
    expect(r.success).toBe(false);
    expect(prismaMock.parceiro.findUnique).not.toHaveBeenCalled();
  });

  it("rejeita parceiro inexistente", async () => {
    getCtxMock.mockResolvedValue(CTX_EDITOR);
    prismaMock.parceiro.findUnique.mockResolvedValue(null);
    const r = await CriarTarefaParceiro({ parceiroId: 999, titulo: "Ligar" });
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("cria tarefa e registra histórico (editor não-admin)", async () => {
    getCtxMock.mockResolvedValue(CTX_EDITOR);
    prismaMock.parceiro.findUnique.mockResolvedValue({ id: 1 });
    prismaMock.parceiroTarefa.create.mockResolvedValue({ id: "t1", parceiroId: 1, titulo: "Ligar", status: "PENDENTE" });
    prismaMock.parceiroHistorico.create.mockResolvedValue({});
    const r = await CriarTarefaParceiro({ parceiroId: 1, titulo: "Ligar" });
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

describe("ListarTarefasParceiro", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita sem sessão", async () => {
    getCtxMock.mockResolvedValue(null);
    const r = await ListarTarefasParceiro(1);
    expect(r.success).toBe(false);
    expect(r.tarefas).toEqual([]);
  });

  it("permite leitor sem podeEditar (mesmo padrão de ListarFilaFollowUpParceiros)", async () => {
    getCtxMock.mockResolvedValue(CTX_LEITOR);
    prismaMock.parceiroTarefa.findMany.mockResolvedValue([{ id: "t1" }]);
    const r = await ListarTarefasParceiro(1);
    expect(r.success).toBe(true);
    expect(r.tarefas).toHaveLength(1);
  });
});

describe("ConcluirTarefaParceiro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
  });

  it("rejeita leitor sem podeEditar", async () => {
    getCtxMock.mockResolvedValue(CTX_LEITOR);
    const r = await ConcluirTarefaParceiro("t1");
    expect(r.success).toBe(false);
    expect(prismaMock.parceiroTarefa.findUnique).not.toHaveBeenCalled();
  });

  it("rejeita tarefa inexistente", async () => {
    getCtxMock.mockResolvedValue(CTX_ADMIN);
    prismaMock.parceiroTarefa.findUnique.mockResolvedValue(null);
    const r = await ConcluirTarefaParceiro("inexistente");
    expect(r.success).toBe(false);
  });

  it("é idempotente — concluir tarefa já concluída não gera novo histórico", async () => {
    getCtxMock.mockResolvedValue(CTX_ADMIN);
    prismaMock.parceiroTarefa.findUnique.mockResolvedValue({ parceiroId: 1, titulo: "Ligar", status: "CONCLUIDA" });
    const r = await ConcluirTarefaParceiro("t1");
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("conclui tarefa pendente e registra histórico", async () => {
    getCtxMock.mockResolvedValue(CTX_EDITOR);
    prismaMock.parceiroTarefa.findUnique.mockResolvedValue({ parceiroId: 1, titulo: "Ligar", status: "PENDENTE" });
    const r = await ConcluirTarefaParceiro("t1");
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

describe("ExcluirTarefaParceiro", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita editor sem podeExcluir (RBAC distinto de podeEditar)", async () => {
    getCtxMock.mockResolvedValue(CTX_EDITOR);
    const r = await ExcluirTarefaParceiro("t1");
    expect(r.success).toBe(false);
    expect(prismaMock.parceiroTarefa.delete).not.toHaveBeenCalled();
  });

  it("admin exclui normalmente", async () => {
    getCtxMock.mockResolvedValue(CTX_ADMIN);
    prismaMock.parceiroTarefa.findUnique.mockResolvedValue({ id: "t1" });
    prismaMock.parceiroTarefa.delete.mockResolvedValue({});
    const r = await ExcluirTarefaParceiro("t1");
    expect(r.success).toBe(true);
  });
});
