import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  parceiro: { findUnique: vi.fn(), update: vi.fn() },
  parceiroHistorico: { create: vi.fn() },
  indicacao: { count: vi.fn() },
}));

const getCtxMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/actions/parceiros", () => ({ getCtx: getCtxMock }));

import {
  AtualizarPotencialRecorrenciaParceiro,
  ReativarParceiro,
} from "@/actions/parceiros-desenvolvimento";

const CTX_EDITOR = { userId: 7, role: "User", isAdmin: false, podeEditar: true, podeExcluir: false, podeAprovar: false };
const CTX_SEM_PERMISSAO = { ...CTX_EDITOR, podeEditar: false };

describe("AtualizarPotencialRecorrenciaParceiro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX_EDITOR);
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
    prismaMock.parceiro.findUnique.mockResolvedValue({ potencialRecorrencia: null });
  });

  it("rejeita sem permissão", async () => {
    getCtxMock.mockResolvedValue(CTX_SEM_PERMISSAO);
    const r = await AtualizarPotencialRecorrenciaParceiro({ parceiroId: 1, potencialRecorrencia: 3 });
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("aceita valores no range 0-5", async () => {
    const r = await AtualizarPotencialRecorrenciaParceiro({ parceiroId: 1, potencialRecorrencia: 5 });
    expect(r.success).toBe(true);
  });

  it("rejeita valor negativo ou acima de 5", async () => {
    const rNeg = await AtualizarPotencialRecorrenciaParceiro({ parceiroId: 1, potencialRecorrencia: -1 });
    expect(rNeg.success).toBe(false);
    const rAlto = await AtualizarPotencialRecorrenciaParceiro({ parceiroId: 1, potencialRecorrencia: 6 });
    expect(rAlto.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("ReativarParceiro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX_EDITOR);
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
  });

  it("rejeita reativar um parceiro que não está INATIVO", async () => {
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "ATIVO", onboardingCompleto: true });
    const r = await ReativarParceiro(1);
    expect(r.success).toBe(false);
  });

  it("reativa para ATIVO quando já possui indicações reais", async () => {
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "INATIVO", onboardingCompleto: true });
    prismaMock.indicacao.count.mockResolvedValue(3);
    const r = await ReativarParceiro(1);
    expect(r.success).toBe(true);
    if (r.success) expect(r.estagio).toBe("ATIVO");
  });

  it("reativa para ATIVADO_SEM_INDICACAO quando onboarding já concluído mas nunca indicou", async () => {
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "INATIVO", onboardingCompleto: true });
    prismaMock.indicacao.count.mockResolvedValue(0);
    const r = await ReativarParceiro(1);
    expect(r.success).toBe(true);
    if (r.success) expect(r.estagio).toBe("ATIVADO_SEM_INDICACAO");
  });

  it("reativa para EM_ATIVACAO quando onboarding nunca foi concluído", async () => {
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "INATIVO", onboardingCompleto: false });
    prismaMock.indicacao.count.mockResolvedValue(0);
    const r = await ReativarParceiro(1);
    expect(r.success).toBe(true);
    if (r.success) expect(r.estagio).toBe("EM_ATIVACAO");
  });
});
