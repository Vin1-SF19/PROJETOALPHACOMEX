import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const acessoMock = vi.hoisted(() => vi.fn());
const historicoMock = vi.hoisted(() => vi.fn());
const notificarMock = vi.hoisted(() => vi.fn());
const pusherTriggerMock = vi.hoisted(() => vi.fn());
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
vi.mock("@/lib/pusher-server.ts", () => ({ pusherServer: { trigger: pusherTriggerMock } }));

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
    pusherTriggerMock.mockResolvedValue(undefined);
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

  it("rejeita datas obrigatórias fora do contrato antes de ownership e persistência", async () => {
    for (const prazo of [null, "", "2026-08-21", "21/08/2026 15:00", "0", false]) {
      const resultado = await CriarTarefaBpm({
        cardId: CARD_ID,
        tipo: "TAREFA",
        titulo: "Retornar",
        prazo,
        alertaEm: new Date("2026-08-21T14:00:00.000Z"),
      });
      expect(resultado.success).toBe(false);
    }
    expect(acessoMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("exige sessão e propaga recusa de ownership antes da persistência", async () => {
    authMock.mockResolvedValueOnce(null);
    await expect(CriarTarefaBpm({})).resolves.toEqual({ success: false, error: "Não autorizado" });
    expect(acessoMock).not.toHaveBeenCalled();

    acessoMock.mockRejectedValueOnce(new Error("Não autorizado"));
    const resultado = await CriarTarefaBpm({
      cardId: CARD_ID,
      tipo: "TAREFA",
      titulo: "Retornar",
      prazo: new Date("2026-08-21T15:00:00.000Z"),
      alertaEm: new Date("2026-08-21T14:00:00.000Z"),
    });
    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
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
    expect(historicoMock).toHaveBeenCalledWith(expect.objectContaining({ acao: "TAREFA_ALERTA_DISPARADO" }));
    expect(notificarMock).toHaveBeenCalledAfter(historicoMock);
  });

  it("envia o Próximo Contato ao sino da Agenda Alpha do responsável", async () => {
    const prazo = new Date("2026-09-30T15:00:00Z");
    prismaMock.bpmTarefa.findMany.mockResolvedValue([{
      id: "crm-proximo-contato:card-1", cardId: CARD_ID,
      tipo: "CRM_PROXIMO_CONTATO", titulo: "Próximo contato — Empresa Teste",
      prazo, responsavelId: 7, card: { pipelineId: "pipeline" },
    }]);
    await executarAlertasTarefasBpm(new Date("2026-09-30T14:50:00Z"));
    expect(pusherTriggerMock).toHaveBeenCalledWith(
      "private-calendario-alpha-usuario-7",
      "calendario-alpha-compromisso",
      expect.objectContaining({ titulo: "Próximo contato — Empresa Teste", inicioEm: prazo.toISOString() }),
    );
  });

  it("reverte a marcação para retentar quando o sino não recebe o alerta", async () => {
    const agora = new Date("2026-09-30T14:50:00Z");
    const prazo = new Date("2026-09-30T15:00:00Z");
    prismaMock.bpmTarefa.findMany.mockResolvedValue([{
      id: "crm-proximo-contato:card-1", cardId: CARD_ID,
      tipo: "CRM_PROXIMO_CONTATO", titulo: "Próximo contato",
      prazo, responsavelId: 7, card: { pipelineId: "pipeline" },
    }]);
    pusherTriggerMock.mockRejectedValueOnce(new Error("Pusher indisponível"));

    await expect(executarAlertasTarefasBpm(agora)).resolves.toEqual({ examinadas: 1, disparados: 0 });
    expect(prismaMock.bpmTarefa.updateMany).toHaveBeenLastCalledWith({
      where: expect.objectContaining({ id: "crm-proximo-contato:card-1", alertaDisparadoEm: agora }),
      data: { alertaDisparadoEm: null },
    });
    expect(historicoMock).not.toHaveBeenCalled();
  });

  it("não repete o alerta quando a tarefa foi reagendada após a leitura", async () => {
    const agora = new Date("2026-09-30T14:50:00Z");
    prismaMock.bpmTarefa.findMany.mockResolvedValue([{
      id: "crm-proximo-contato:card-1", cardId: CARD_ID,
      tipo: "CRM_PROXIMO_CONTATO", prazo: new Date("2026-09-30T15:00:00Z"),
      responsavelId: 7, card: { pipelineId: "pipeline" },
    }]);
    prismaMock.bpmTarefa.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(executarAlertasTarefasBpm(agora)).resolves.toEqual({ examinadas: 1, disparados: 0 });
    expect(pusherTriggerMock).not.toHaveBeenCalled();
    expect(historicoMock).not.toHaveBeenCalled();
  });
});
