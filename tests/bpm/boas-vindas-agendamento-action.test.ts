import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const acessoMock = vi.hoisted(() => vi.fn());
const elegivelMock = vi.hoisted(() => vi.fn());
const criarEventoMock = vi.hoisted(() => vi.fn());
const compensarMock = vi.hoisted(() => vi.fn());
const historicoMock = vi.hoisted(() => vi.fn());
const eventoMock = vi.hoisted(() => vi.fn());
const tx = vi.hoisted(() => ({
  bpmCard: { updateMany: vi.fn() },
  bpmCardMembro: { upsert: vi.fn(), deleteMany: vi.fn() },
  bpmCardReuniao: { upsert: vi.fn() },
  bpmTarefa: { create: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn() },
  usuarios: { findUnique: vi.fn(), findMany: vi.fn() },
  googleCalendarSelecionado: { findMany: vi.fn() },
  googleCalendarEventoCache: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: acessoMock,
  usuarioElegivelResponsavelBpm: elegivelMock,
}));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: historicoMock }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({ publicarEventoBpm: eventoMock }));
vi.mock("@/lib/bpm/automacoes/orquestrador", () => ({ executarAutomacoesCentraisDoCardAgora: vi.fn() }));
vi.mock("@/lib/bpm/google-meet-compensacao", () => ({
  cancelarCriacaoSemVinculo: compensarMock,
  registrarCompensacaoGooglePendente: vi.fn(),
  reverterReagendamentoSemPersistencia: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/actions/google-calendar-eventos", () => ({ criarEventoNoCalendario: criarEventoMock }));
vi.mock("@/lib/google-calendar/client", () => ({
  atualizarEventoParcial: vi.fn(), cancelarEvento: vi.fn(), obterEvento: vi.fn(),
}));
vi.mock("@/lib/google-calendar/usuario-google", () => ({
  obterUsuarioGoogleAtivo: vi.fn(), obterUsuarioGoogleAtivoPorCalendario: vi.fn(),
}));
vi.mock("@/lib/google-calendar/cache-eventos", () => ({ dadosCacheDeEvento: vi.fn() }));
vi.mock("@/lib/google-calendar/errors", () => ({ GoogleCalendarError: class extends Error {} }));

import { IniciarBoasVindasOperacionalBpm } from "@/actions/bpm/GoogleMeet";

const CARD = "card-operacional";
const PIPELINE = "cmuih4tnh000409gm5z34jvss";
const ETAPA = "draft-stage-802def27-91ae-4231-b3f4-a251951c954a";
const DATA = "2026-10-02T13:00:00.000Z";
const VERSAO = new Date("2026-09-29T12:00:00.000Z");

describe("início de Boas-vindas com Google Meet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T12:30:00.000Z"));
    authMock.mockResolvedValue({ user: { id: "10", role: "OPERACIONAL" } });
    acessoMock.mockResolvedValue(undefined);
    elegivelMock.mockResolvedValue(true);
    prismaMock.bpmCard.findUnique
      .mockResolvedValueOnce({ pipelineId: PIPELINE, etapaId: ETAPA, updatedAt: VERSAO,
        responsavelId: 10, googleEventId: null, etapa: { nome: "Boas vindas" },
        empresa: { razaoSocial: "Cliente Teste", nomeFantasia: null } })
      .mockResolvedValueOnce({ etapaId: ETAPA, updatedAt: VERSAO, googleEventId: null });
    prismaMock.usuarios.findUnique.mockImplementation(({ where }: { where: { id: number } }) =>
      where.id === 23
        ? { id: 23, nome: "Analista", email: "analista@example.com", role: "OPERACIONAL", cargo: "Analista Operacional", status: "ATIVO" }
        : { email: "vitor@example.com" });
    prismaMock.googleCalendarSelecionado.findMany.mockResolvedValue([{ id: "cal-1",
      googleCalendarId: "primary", timezone: "America/Sao_Paulo" }]);
    criarEventoMock.mockResolvedValue({ success: true, data: { googleEventId: "evento-1" } });
    prismaMock.googleCalendarEventoCache.findUnique.mockResolvedValue({
      linkMeet: "https://meet.google.com/abc-defg-hij",
    });
    tx.bpmCard.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
  });
  afterEach(() => vi.useRealTimers());

  it("cria um evento com analista e contato e só depois transfere o card", async () => {
    const resultado = await IniciarBoasVindasOperacionalBpm({ cardId: CARD, analistaId: 23,
      dataHora: DATA, emailCliente: "cliente@example.com" });
    expect(resultado).toMatchObject({ success: true });
    expect(criarEventoMock).toHaveBeenCalledWith(expect.objectContaining({
      participantes: ["cliente@example.com", "analista@example.com"], criarMeet: true,
      lembretesMinutos: [30],
    }));
    expect(tx.bpmCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ responsavelId: 23, googleEventId: "evento-1" }),
    }));
    expect(tx.bpmCardMembro.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { cardId: CARD, userId: 23, role: "RESPONSAVEL" },
    }));
    expect(tx.bpmTarefa.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cardId: CARD, responsavelId: 23,
        prazo: new Date(DATA), alertaEm: new Date("2026-10-02T12:30:00.000Z") }),
    }));
    expect(historicoMock).toHaveBeenCalledOnce();
    expect(eventoMock).toHaveBeenCalledOnce();
    expect(compensarMock).not.toHaveBeenCalled();
  });

  it("recusa outro operador antes de chamar o Google", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "OPERACIONAL" } });
    expect((await IniciarBoasVindasOperacionalBpm({ cardId: CARD, analistaId: 23,
      dataHora: DATA, emailCliente: "cliente@example.com" })).success).toBe(false);
    expect(criarEventoMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("compensa o evento quando o card muda antes da atribuição", async () => {
    tx.bpmCard.updateMany.mockResolvedValue({ count: 0 });
    expect((await IniciarBoasVindasOperacionalBpm({ cardId: CARD, analistaId: 23,
      dataHora: DATA, emailCliente: "cliente@example.com" })).success).toBe(false);
    expect(compensarMock).toHaveBeenCalledOnce();
    expect(tx.bpmCardMembro.upsert).not.toHaveBeenCalled();
  });
});
