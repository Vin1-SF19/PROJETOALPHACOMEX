import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const acessoMock = vi.hoisted(() => vi.fn());
const historicoMock = vi.hoisted(() => vi.fn());
const notificarMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  bpmTarefa: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  bpmTarefaPreset: { findUnique: vi.fn() },
  bpmCard: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: acessoMock,
  checarAcessoConfigPipeline: vi.fn(),
  exigirAcessoBpmPipeline: vi.fn(),
  exigirAcessoConfigPipeline: vi.fn(),
  exigirAcessoModuloBpm: vi.fn(),
}));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: historicoMock }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: notificarMock }));

import { AplicarPresetTarefaBpm, CriarTarefaBpm } from "@/actions/bpm/Tarefas";
import { executarAlertasTarefasBpm } from "@/lib/bpm/alertas-tarefas";

const CARD_ID = "clw0000000000000card";
const PRESET_ID = "clw0000000000000pres";

describe("BPM - ações de tarefas por tipo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    acessoMock.mockResolvedValue(undefined);
    historicoMock.mockResolvedValue(undefined);
    notificarMock.mockResolvedValue(undefined);
    prismaMock.bpmTarefa.create.mockResolvedValue({ id: "clw0000000000000task" });
    prismaMock.bpmTarefa.findMany.mockResolvedValue([]);
    prismaMock.bpmTarefa.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
  });

  it("persiste tipo, prazo e alerta na mesma transação e só então emite realtime", async () => {
    const prazo = new Date("2026-08-21T15:00:00.000Z");
    const alertaEm = new Date("2026-08-21T14:00:00.000Z");

    const resultado = await CriarTarefaBpm({
      cardId: CARD_ID,
      tipo: "WHATSAPP",
      contato: "Maria",
      mensagem: "Posso retomar a proposta?",
      responsavelId: 7,
      prazo,
      alertaEm,
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.bpmTarefa.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: CARD_ID,
        tipo: "WHATSAPP",
        prazo,
        alertaEm,
        titulo: "WhatsApp: Maria",
      }),
    });
    expect(historicoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: CARD_ID,
        acao: "TAREFA_CRIADA",
        valorNovoJson: expect.stringContaining("alertaConfigurado"),
      }),
      prismaMock,
    );
    expect(notificarMock).toHaveBeenCalledAfter(historicoMock);
  });

  it("recusa preset legado que contornaria prazo e alerta", async () => {
    prismaMock.bpmTarefaPreset.findUnique.mockResolvedValue({
      id: PRESET_ID,
      pipelineId: null,
      templateJson: JSON.stringify([{ titulo: "Tarefa legada", prioridade: "NORMAL" }]),
    });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ pipelineId: "clw0000000000000pipe" });

    const resultado = await AplicarPresetTarefaBpm({ cardId: CARD_ID, presetId: PRESET_ID });

    expect(resultado).toEqual({
      success: false,
      error: "Este preset não possui prazo e alerta válidos para todas as tarefas.",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.bpmTarefa.create).not.toHaveBeenCalled();
  });

  it("dispara o alerta interno uma vez com CAS e realtime após o commit", async () => {
    const agora = new Date("2026-08-21T14:00:00.000Z");
    prismaMock.bpmTarefa.findMany.mockResolvedValue([{
      id: "clw0000000000000task",
      cardId: CARD_ID,
      card: { pipelineId: "clw0000000000000pipe" },
    }]);

    await expect(executarAlertasTarefasBpm(agora)).resolves.toEqual({ examinadas: 1, disparados: 1 });
    expect(prismaMock.bpmTarefa.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "clw0000000000000task", alertaDisparadoEm: null }),
      data: { alertaDisparadoEm: agora },
    });
    expect(historicoMock).toHaveBeenCalledWith(expect.objectContaining({ acao: "TAREFA_ALERTA_DISPARADO" }), prismaMock);
    expect(notificarMock).toHaveBeenCalledAfter(historicoMock);
  });
});
