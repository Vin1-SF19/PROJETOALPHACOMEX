import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const exigirAcessoConfigPipelineMock = vi.hoisted(() => vi.fn());
const txMock = vi.hoisted(() => ({
  bpmRegra: { create: vi.fn(), update: vi.fn() },
  bpmRegraVersao: { create: vi.fn() },
  bpmPipelineConfigAuditoria: { create: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({
  bpmPipeline: { findUnique: vi.fn() },
  bpmRegra: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoConfigPipeline: exigirAcessoConfigPipelineMock,
}));

import { AlternarAtivacaoRegraBpm, CriarRegraBpm } from "@/actions/bpm/Regras";

const condicao = {
  operador: "AND" as const,
  condicoes: [{ tipo: "condicao" as const, campo: { fonte: "card" as const, campo: "status" as const }, operador: "igual" as const, valor: "ATIVO" }],
};
const resultado = { tipo: "bloqueio_movimentacao" as const, mensagem: "Bloqueado" };

describe("Regras.ts — Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
    exigirAcessoConfigPipelineMock.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(txMock));
  });

  it("rejeita sem sessão", async () => {
    authMock.mockResolvedValue(null);

    const resposta = await CriarRegraBpm({ nome: "X", condicao, resultado });

    expect(resposta).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita quando o usuário não é admin de pipeline", async () => {
    exigirAcessoConfigPipelineMock.mockRejectedValue(new Error("Não autorizado — apenas administradores configuram pipelines"));

    const resposta = await CriarRegraBpm({ nome: "X", condicao, resultado });

    expect(resposta.success).toBe(false);
    if (!resposta.success) expect(resposta.error).toMatch(/apenas administradores/);
  });

  it("rejeita payload com condição/resultado inválidos", async () => {
    const resposta = await CriarRegraBpm({ nome: "X", condicao: { operador: "XOR", condicoes: [] }, resultado });

    expect(resposta.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("cria a regra com a versão 1 e audita a criação quando há pipelineId", async () => {
    prismaMock.bpmPipeline.findUnique.mockResolvedValue({ id: "clxpipeline0000000000000001" });
    txMock.bpmRegra.create.mockResolvedValue({ id: "clxregra00000000000000000001" });

    const resposta = await CriarRegraBpm({
      nome: "Bloquear sem status ativo",
      pipelineId: "clxpipeline0000000000000001",
      condicao,
      resultado,
    });

    expect(resposta).toEqual({ success: true, data: { id: "clxregra00000000000000000001" } });
    expect(txMock.bpmRegra.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nome: "Bloquear sem status ativo", criadoPorId: 1, versaoAtualNum: 1 }),
      }),
    );
    expect(txMock.bpmPipelineConfigAuditoria.create).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/PainelAlpha/AlphaCRM/admin/regras");
  });

  it("rejeita pipelineId inexistente", async () => {
    prismaMock.bpmPipeline.findUnique.mockResolvedValue(null);

    const resposta = await CriarRegraBpm({ nome: "X", pipelineId: "clxpipeline0000000000000099", condicao, resultado });

    expect(resposta).toEqual({ success: false, error: "Pipeline inválido" });
  });

  it("ativa/desativa uma regra existente", async () => {
    prismaMock.bpmRegra.findUnique.mockResolvedValue({ id: "clxregra00000000000000000001" });
    prismaMock.bpmRegra.update.mockResolvedValue({});

    const resposta = await AlternarAtivacaoRegraBpm({ id: "clxregra00000000000000000001", ativa: false });

    expect(resposta).toEqual({ success: true });
    expect(prismaMock.bpmRegra.update).toHaveBeenCalledWith({ where: { id: "clxregra00000000000000000001" }, data: { ativa: false } });
  });

  it("retorna erro amigável para regra inexistente ao alternar ativação", async () => {
    prismaMock.bpmRegra.findUnique.mockResolvedValue(null);

    const resposta = await AlternarAtivacaoRegraBpm({ id: "clxregra00000000000000000099", ativa: false });

    expect(resposta).toEqual({ success: false, error: "Regra não encontrada" });
  });
});
