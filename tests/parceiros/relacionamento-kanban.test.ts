import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  parceiro: { findUnique: vi.fn(), update: vi.fn() },
  parceiroHistorico: { create: vi.fn() },
  $transaction: vi.fn(),
}));

const getCtxMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/actions/parceiros", () => ({ getCtx: getCtxMock }));

import { podeMoverEstagioParceiro } from "@/lib/parceiros/desenvolvimento";
import { MoverEstagioParceiro, RegistrarProximaAcaoParceiro } from "@/actions/parceiros-desenvolvimento";

const CTX_EDITOR = { userId: 7, role: "User", isAdmin: false, podeEditar: true, podeExcluir: false, podeAprovar: false };
const CTX_LEITOR = { ...CTX_EDITOR, podeEditar: false };

// RM-2026-2C7A4B: máquina de estados nova (8 estágios: 6 produtivos em sequência linear +
// INATIVO + EM_REATIVACAO como estados especiais).
describe("podeMoverEstagioParceiro — máquina de estados", () => {
  it("permite avançar 1 posição na sequência produtiva", () => {
    expect(podeMoverEstagioParceiro("NOVO", "EM_ATIVACAO")).toBe(true);
    expect(podeMoverEstagioParceiro("EM_ATIVACAO", "ATIVADO_SEM_INDICACAO")).toBe(true);
    expect(podeMoverEstagioParceiro("ATIVO", "RECORRENTE")).toBe(true);
  });

  it("rejeita pular mais de 1 posição para frente (não pode saltar direto para RECORRENTE)", () => {
    expect(podeMoverEstagioParceiro("NOVO", "RECORRENTE")).toBe(false);
    expect(podeMoverEstagioParceiro("EM_ATIVACAO", "ATIVO")).toBe(false);
  });

  it("permite corrigir livremente para trás na sequência", () => {
    expect(podeMoverEstagioParceiro("RECORRENTE", "NOVO")).toBe(true);
    expect(podeMoverEstagioParceiro("ATIVO", "EM_ATIVACAO")).toBe(true);
  });

  it("rejeita mover manualmente para INATIVO (reservado ao job automático)", () => {
    expect(podeMoverEstagioParceiro("ATIVO", "INATIVO")).toBe(false);
    expect(podeMoverEstagioParceiro("NOVO", "INATIVO")).toBe(false);
  });

  it("a partir de INATIVO, só permite ir para EM_REATIVACAO", () => {
    expect(podeMoverEstagioParceiro("INATIVO", "EM_REATIVACAO")).toBe(true);
    expect(podeMoverEstagioParceiro("INATIVO", "ATIVO")).toBe(false);
    expect(podeMoverEstagioParceiro("INATIVO", "NOVO")).toBe(false);
  });

  it("a partir de EM_REATIVACAO, permite reingresso livre em qualquer estágio produtivo", () => {
    expect(podeMoverEstagioParceiro("EM_REATIVACAO", "ATIVO")).toBe(true);
    expect(podeMoverEstagioParceiro("EM_REATIVACAO", "NOVO")).toBe(true);
    expect(podeMoverEstagioParceiro("EM_REATIVACAO", "RECORRENTE")).toBe(true);
  });

  it("rejeita mover para EM_REATIVACAO a partir de qualquer estágio que não seja INATIVO", () => {
    expect(podeMoverEstagioParceiro("ATIVO", "EM_REATIVACAO")).toBe(false);
    expect(podeMoverEstagioParceiro("NOVO", "EM_REATIVACAO")).toBe(false);
  });

  it("rejeita mover para o mesmo estágio (no-op)", () => {
    expect(podeMoverEstagioParceiro("ATIVO", "ATIVO")).toBe(false);
    expect(podeMoverEstagioParceiro("INATIVO", "INATIVO")).toBe(false);
  });
});

describe("MoverEstagioParceiro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX_EDITOR);
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
  });

  it("rejeita sem permissão de edição", async () => {
    getCtxMock.mockResolvedValue(CTX_LEITOR);
    const r = await MoverEstagioParceiro({ parceiroId: 1, estagioDestino: "ATIVO" });
    expect(r.success).toBe(false);
    expect(prismaMock.parceiro.findUnique).not.toHaveBeenCalled();
  });

  it("rejeita estagioDestino fora do enum válido (Zod)", async () => {
    const r = await MoverEstagioParceiro({ parceiroId: 1, estagioDestino: "ESTADO_INVENTADO" as never });
    expect(r.success).toBe(false);
    expect(prismaMock.parceiro.findUnique).not.toHaveBeenCalled();
  });

  it("rejeita transição inválida mesmo com usuário autorizado (backend não confia só na UI)", async () => {
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "NOVO" });
    const r = await MoverEstagioParceiro({ parceiroId: 1, estagioDestino: "RECORRENTE" });
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("aceita transição válida e persiste", async () => {
    prismaMock.parceiro.findUnique.mockResolvedValue({ estagioDesenvolvimento: "NOVO" });
    const r = await MoverEstagioParceiro({ parceiroId: 1, estagioDestino: "EM_ATIVACAO" });
    expect(r.success).toBe(true);
  });

  it("rejeita parceiro inexistente", async () => {
    prismaMock.parceiro.findUnique.mockResolvedValue(null);
    const r = await MoverEstagioParceiro({ parceiroId: 999, estagioDestino: "ATIVO" });
    expect(r.success).toBe(false);
  });
});

describe("RegistrarProximaAcaoParceiro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX_EDITOR);
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
    prismaMock.parceiro.findUnique.mockResolvedValue({ id: 1 });
  });

  it("rejeita sem permissão de edição", async () => {
    getCtxMock.mockResolvedValue(CTX_LEITOR);
    const r = await RegistrarProximaAcaoParceiro({ parceiroId: 1, proximaAcaoEm: "2026-09-01", proximaAcaoDescricao: "Ligar" });
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita descrição vazia", async () => {
    const r = await RegistrarProximaAcaoParceiro({ parceiroId: 1, proximaAcaoEm: "2026-09-01", proximaAcaoDescricao: "" });
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("aceita e persiste com data válida", async () => {
    const r = await RegistrarProximaAcaoParceiro({ parceiroId: 1, proximaAcaoEm: "2026-09-01", proximaAcaoDescricao: "Ligar para follow-up" });
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("rejeita parceiro inexistente", async () => {
    prismaMock.parceiro.findUnique.mockResolvedValue(null);
    const r = await RegistrarProximaAcaoParceiro({ parceiroId: 999, proximaAcaoEm: "2026-09-01", proximaAcaoDescricao: "Ligar" });
    expect(r.success).toBe(false);
  });
});
