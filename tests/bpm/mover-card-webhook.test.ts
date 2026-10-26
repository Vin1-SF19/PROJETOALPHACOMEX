import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ card: vi.fn(), etapas: vi.fn(), executar: vi.fn(), notificar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmCard: { findFirst: mocks.card }, bpmEtapa: { findMany: mocks.etapas },
} }));
vi.mock("@/lib/bpm/transicao-command", () => ({ executarTransicaoBpm: mocks.executar }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.notificar }));

import { moverCardViaWebhook, moverCardWebhookSchema } from "@/lib/bpm/mover-card-webhook-server";

const params = { endpointId: "endpoint", pipelineId: "radar", cardId: "card", idempotencyKey: "movimento-1" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.card.mockResolvedValue({ id: "card", versao: 2 });
  mocks.etapas.mockResolvedValue([
    { id: "novo", nome: "Novo Lead" }, { id: "agendar", nome: "Agendar reunião" },
    { id: "agendada", nome: "Reunião Agendada" },
  ]);
  mocks.executar.mockResolvedValue({ success: true, data: { cardId: "card", idempotente: false } });
});

describe("movimentação por webhook", () => {
  it.each([
    ["AGENDAR_REUNIAO", "novo", "agendar"], ["REUNIAO_AGENDADA", "agendar", "agendada"],
  ])("resolve origem e destino sem aceitar IDs de etapa do cliente: %s", async (etapaDestino, origem, destino) => {
    const dados = moverCardWebhookSchema.parse({
      etapaDestino, camposValores: { campo: "preenchido" },
      ...(etapaDestino === "REUNIAO_AGENDADA" ? { dataReuniao: "2026-11-10T14:30:00-03:00" } : {}),
    });
    await moverCardViaWebhook({ ...params, dados });
    expect(mocks.executar).toHaveBeenCalledWith(expect.objectContaining({
      cardId: "card", etapaOrigemEsperadaId: origem, etapaDestinoId: destino, versaoEsperada: 2,
      ator: { tipo: "INTEGRACAO" }, camposValores: { campo: "preenchido" },
      idempotencyKey: "webhook-etapa:endpoint:card:movimento-1",
    }));
    if (etapaDestino === "REUNIAO_AGENDADA") {
      expect(mocks.executar.mock.calls[0][0].dataReuniao).toEqual(new Date("2026-11-10T17:30:00Z"));
    }
  });

  it("restringe o card ao pipeline do endpoint", async () => {
    mocks.card.mockResolvedValue(null);
    await expect(moverCardViaWebhook({ ...params, dados: { etapaDestino: "AGENDAR_REUNIAO", camposValores: {} } }))
      .rejects.toMatchObject({ status: 404 });
    expect(mocks.card).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "card", pipelineId: "radar" } }));
    expect(mocks.executar).not.toHaveBeenCalled();
  });

  it("devolve pendências canônicas e não publica atualização quando há requisitos faltantes", async () => {
    const falha = { success: false, code: "REQUIREMENTS_PENDING", error: "Preencha", pendencias: ["Radar pretendido"] };
    mocks.executar.mockResolvedValue(falha);
    expect(await moverCardViaWebhook({ ...params, dados: { etapaDestino: "AGENDAR_REUNIAO", camposValores: {} } })).toEqual(falha);
    expect(mocks.notificar).not.toHaveBeenCalled();
  });

  it("preserva a chave em retries e não repete notificações do movimento original", async () => {
    mocks.executar.mockResolvedValue({ success: true, data: { cardId: "card", idempotente: true } });
    await moverCardViaWebhook({ ...params, dados: { etapaDestino: "AGENDAR_REUNIAO", camposValores: {} } });
    expect(mocks.notificar).not.toHaveBeenCalled();
  });

  it("recusa etapas ambíguas sem mover o card", async () => {
    mocks.etapas.mockResolvedValue([{ id: "novo", nome: "Novo Lead" }]);
    await expect(moverCardViaWebhook({ ...params, dados: { etapaDestino: "AGENDAR_REUNIAO", camposValores: {} } }))
      .rejects.toMatchObject({ status: 409, codigo: "ETAPAS_NAO_CONFIGURADAS" });
    expect(mocks.executar).not.toHaveBeenCalled();
  });

  it.each([undefined, "2026-11-10T14:30:00", "data inválida"])("exige data válida com fuso para Reunião Agendada: %s", (dataReuniao) => {
    expect(moverCardWebhookSchema.safeParse({ etapaDestino: "REUNIAO_AGENDADA", camposValores: {}, dataReuniao }).success).toBe(false);
  });

  it("recusa responsável, pipeline e destino arbitrários no payload", () => {
    expect(moverCardWebhookSchema.safeParse({ etapaDestino: "FECHADO", camposValores: {} }).success).toBe(false);
    expect(moverCardWebhookSchema.safeParse({ etapaDestino: "AGENDAR_REUNIAO", camposValores: {}, responsavelId: 1 }).success).toBe(false);
  });
});
