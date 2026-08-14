import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmCardMock = vi.hoisted(() => vi.fn());
const listarUsuariosVinculaveisBpmMock = vi.hoisted(() => vi.fn());
const notificarPipelineBpmMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn(), updateMany: vi.fn() },
  bpmCardMembro: { findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  bpmCardHistorico: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: exigirAcessoBpmCardMock,
  listarUsuariosVinculaveisBpm: listarUsuariosVinculaveisBpmMock,
}));
vi.mock("@/lib/bpm/realtime-server", () => ({
  notificarPipelineBpm: notificarPipelineBpmMock,
}));

import {
  AtualizarMembrosCardBpm,
  ListarUsuariosVinculaveisCardBpm,
} from "@/actions/bpm/Membros";
import { MAX_MEMBROS_CARD_BPM } from "@/lib/validations/bpm";

const CARD_ID = "clw0000000000000card";
const PIPELINE_ID = "clw0000000000000pipe";
const UPDATED_AT = new Date("2026-08-14T12:00:00.000Z");

const cardAtual = {
  pipelineId: PIPELINE_ID,
  responsavelId: 7,
  updatedAt: UPDATED_AT,
};

describe("CRM - membros vinculados ao card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    exigirAcessoBpmCardMock.mockResolvedValue({ autorizado: true, role: "RESPONSAVEL" });
    listarUsuariosVinculaveisBpmMock.mockResolvedValue([
      { id: 7, nome: "Responsável", imagemUrl: "/responsavel.webp" },
      { id: 9, nome: "Participante", imagemUrl: null },
      { id: 12, nome: "Admin do card", imagemUrl: "/admin.webp" },
    ]);
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardAtual);
    prismaMock.bpmCard.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.bpmCardMembro.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.bpmCardMembro.upsert.mockResolvedValue({});
    prismaMock.bpmCardHistorico.create.mockResolvedValue({});
    notificarPipelineBpmMock.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
  });

  it("lista apenas candidatos já filtrados pela regra de conta ativa + CRM efetivo", async () => {
    const resultado = await ListarUsuariosVinculaveisCardBpm({ cardId: CARD_ID });

    expect(resultado).toEqual({
      success: true,
      data: [
        { id: 7, nome: "Responsável", imagemUrl: "/responsavel.webp" },
        { id: 9, nome: "Participante", imagemUrl: null },
        { id: 12, nome: "Admin do card", imagemUrl: "/admin.webp" },
      ],
    });
    expect(exigirAcessoBpmCardMock).toHaveBeenCalledWith(
      CARD_ID,
      7,
      "COMERCIAL",
      "adicionarParticipantes",
    );
  });

  it("revalida a gestão na transação, preserva o responsável e só audita IDs", async () => {
    prismaMock.bpmCardMembro.findMany
      .mockResolvedValueOnce([
        { userId: 7, role: "RESPONSAVEL" },
        { userId: 12, role: "ADMINISTRADOR" },
      ])
      .mockResolvedValueOnce([
        { userId: 7, role: "RESPONSAVEL", usuario: { id: 7, nome: "Responsável", imagemUrl: "/responsavel.webp" } },
        { userId: 9, role: "PARTICIPANTE", usuario: { id: 9, nome: "Participante", imagemUrl: null } },
        { userId: 12, role: "ADMINISTRADOR", usuario: { id: 12, nome: "Admin do card", imagemUrl: "/admin.webp" } },
      ]);

    const resultado = await AtualizarMembrosCardBpm({ cardId: CARD_ID, userIds: [9, 12] });

    expect(resultado).toEqual(expect.objectContaining({ success: true }));
    expect(exigirAcessoBpmCardMock).toHaveBeenNthCalledWith(
      1,
      CARD_ID,
      7,
      "COMERCIAL",
      "adicionarParticipantes",
    );
    expect(exigirAcessoBpmCardMock).toHaveBeenNthCalledWith(
      2,
      CARD_ID,
      7,
      "COMERCIAL",
      "adicionarParticipantes",
      prismaMock,
    );
    expect(prismaMock.bpmCard.updateMany).toHaveBeenCalledWith({
      where: { id: CARD_ID, updatedAt: UPDATED_AT },
      data: { updatedAt: expect.any(Date) },
    });
    expect(prismaMock.bpmCardMembro.deleteMany).toHaveBeenCalledWith({
      where: { cardId: CARD_ID, userId: { notIn: [7, 9, 12] } },
    });
    expect(prismaMock.bpmCardMembro.upsert).toHaveBeenCalledWith({
      where: { cardId_userId: { cardId: CARD_ID, userId: 7 } },
      create: { cardId: CARD_ID, userId: 7, role: "RESPONSAVEL" },
      update: { role: "RESPONSAVEL" },
    });
    expect(prismaMock.bpmCardMembro.upsert).toHaveBeenCalledWith({
      where: { cardId_userId: { cardId: CARD_ID, userId: 9 } },
      create: { cardId: CARD_ID, userId: 9, role: "PARTICIPANTE" },
      update: { role: "PARTICIPANTE" },
    });
    expect(prismaMock.bpmCardMembro.upsert).toHaveBeenCalledWith({
      where: { cardId_userId: { cardId: CARD_ID, userId: 12 } },
      create: { cardId: CARD_ID, userId: 12, role: "ADMINISTRADOR" },
      update: { role: "ADMINISTRADOR" },
    });

    const historico = prismaMock.bpmCardHistorico.create.mock.calls[0][0].data;
    expect(historico).toMatchObject({ cardId: CARD_ID, acao: "MEMBROS_ATUALIZADOS", usuarioId: 7 });
    expect(historico.valorAnteriorJson).toBe(JSON.stringify({ membrosIds: [7, 12] }));
    expect(historico.valorNovoJson).toBe(JSON.stringify({ membrosIds: [7, 9, 12] }));
    expect(historico.valorAnteriorJson).not.toContain("Responsável");
    expect(notificarPipelineBpmMock).toHaveBeenCalledWith({
      pipelineId: PIPELINE_ID,
      cardId: CARD_ID,
      tipo: "CARD_ATUALIZADO",
    });
    expect(notificarPipelineBpmMock).toHaveBeenCalledAfter(prismaMock.bpmCardHistorico.create);
  });

  it("recusa pessoas inelegíveis e não cria vínculo parcial", async () => {
    listarUsuariosVinculaveisBpmMock.mockResolvedValue([
      { id: 7, nome: "Responsável", imagemUrl: null },
    ]);

    const resultado = await AtualizarMembrosCardBpm({ cardId: CARD_ID, userIds: [9] });

    expect(resultado).toEqual({
      success: false,
      error: "Uma ou mais pessoas não estão ativas ou não possuem acesso ao CRM.",
    });
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardMembro.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });

  it("não aceita duplicatas nem mais pessoas que o limite", async () => {
    const duplicado = await AtualizarMembrosCardBpm({ cardId: CARD_ID, userIds: [9, 9] });
    const excesso = await AtualizarMembrosCardBpm({
      cardId: CARD_ID,
      userIds: Array.from({ length: MAX_MEMBROS_CARD_BPM + 1 }, (_, index) => index + 1),
    });

    expect(duplicado).toEqual(expect.objectContaining({ success: false }));
    expect(excesso).toEqual(expect.objectContaining({ success: false }));
    expect(exigirAcessoBpmCardMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
