import { beforeEach, describe, expect, it, vi } from "vitest";

const listarRegistrosMock = vi.hoisted(() => vi.fn());
const carregarArtefatoMock = vi.hoisted(() => vi.fn());
const obterUsuarioGoogleMock = vi.hoisted(() => vi.fn());
const obterEventoGoogleMock = vi.hoisted(() => vi.fn());
const notificarPipelineMock = vi.hoisted(() => vi.fn());
const cardFindUniqueMock = vi.hoisted(() => vi.fn());
const cacheFindManyMock = vi.hoisted(() => vi.fn());
const updateManyMock = vi.hoisted(() => vi.fn());
const historicoCreateMock = vi.hoisted(() => vi.fn());
const transactionMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/google-meet/client", () => ({
  GoogleMeetIntegracaoError: class GoogleMeetIntegracaoError extends Error {
    constructor(message: string, readonly recuperavel = false) {
      super(message);
    }
  },
  listarRegistrosConferenciaMeet: listarRegistrosMock,
  carregarArtefatoTranscricaoMeet: carregarArtefatoMock,
}));
vi.mock("@/lib/google-calendar/usuario-google", () => ({
  obterUsuarioGoogleAtivoPorCalendario: obterUsuarioGoogleMock,
}));
vi.mock("@/lib/google-calendar/client", () => ({
  obterEvento: obterEventoGoogleMock,
}));
vi.mock("@/lib/bpm/realtime-server", () => ({
  notificarPipelineBpm: notificarPipelineMock,
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmCard: { findUnique: cardFindUniqueMock, findMany: vi.fn() },
    googleCalendarEventoCache: { findMany: cacheFindManyMock },
    $transaction: transactionMock,
  },
}));

import {
  executarComPrazoGoogleMeet,
  sincronizarTranscricaoCardBpm,
} from "@/lib/bpm/transcricao-reuniao-server";

const cardBase = {
  id: "card-1",
  pipelineId: "pipeline-1",
  status: "ATIVO",
  dataReuniao: new Date("2026-08-12T12:00:00.000Z"),
  googleEventId: "evento-1",
  googleCalendarId: "primary",
  googleMeetLink: "https://meet.google.com/abc-defg-hij",
  transcricaoReuniao: null,
};

describe("sincronizarTranscricaoCardBpm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T18:00:00.000Z"));
    cardFindUniqueMock.mockResolvedValue(cardBase);
    cacheFindManyMock.mockResolvedValue([{ calendarioId: "calendario-local-1" }]);
    obterUsuarioGoogleMock.mockResolvedValue({ ok: true, emailUsuario: "organizador@example.com" });
    obterEventoGoogleMock.mockResolvedValue({ descricao: null });
    listarRegistrosMock.mockResolvedValue([{
      name: "conferenceRecords/1",
      startTime: "2026-08-12T12:02:00.000Z",
      endTime: "2026-08-12T13:00:00.000Z",
    }]);
    carregarArtefatoMock.mockResolvedValue({
      transcriptsEncontrados: 1,
      entradas: [{
        name: "conferenceRecords/1/transcripts/1/entries/1",
        participant: "participants/1",
        text: "Conteúdo da reunião",
        startTime: "2026-08-12T12:05:00.000Z",
      }],
      participantes: new Map([["participants/1", "Ana"]]),
    });
    updateManyMock.mockResolvedValue({ count: 1 });
    historicoCreateMock.mockResolvedValue({});
    transactionMock.mockImplementation(async (callback) => callback({
      bpmCard: { updateMany: updateManyMock },
      bpmCardHistorico: { create: historicoCreateMock },
    }));
    notificarPipelineMock.mockResolvedValue(undefined);
  });

  it("persiste, audita e publica realtime somente depois de receber conteúdo válido", async () => {
    const resultado = await sincronizarTranscricaoCardBpm("card-1", "automatica");

    expect(resultado).toEqual({ status: "RECEBIDA", atualizada: true, caracteres: 35 });
    expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "card-1",
        googleEventId: "evento-1",
        googleMeetLink: "https://meet.google.com/abc-defg-hij",
        transcricaoReuniao: null,
      }),
    }));
    expect(historicoCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: "card-1",
        acao: "TRANSCRICAO_REUNIAO_RECEBIDA",
        automacaoOrigem: "google_meet_polling",
      }),
    });
    expect(notificarPipelineMock).toHaveBeenCalledWith({
      pipelineId: "pipeline-1",
      cardId: "card-1",
      tipo: "REUNIAO_ALTERADA",
    });
  });

  it("não duplica histórico nem realtime quando o conteúdo já está persistido", async () => {
    const transcricao = "[12:05:00] Ana: Conteúdo da reunião";
    cardFindUniqueMock.mockResolvedValue({ ...cardBase, transcricaoReuniao: transcricao });

    const resultado = await sincronizarTranscricaoCardBpm("card-1", "manual");

    expect(resultado).toEqual({
      status: "RECEBIDA",
      atualizada: false,
      caracteres: transcricao.length,
    });
    expect(transactionMock).not.toHaveBeenCalled();
    expect(notificarPipelineMock).not.toHaveBeenCalled();
  });

  it("não chama Google quando a reunião ainda está no futuro", async () => {
    cardFindUniqueMock.mockResolvedValue({
      ...cardBase,
      dataReuniao: new Date("2026-08-13T12:00:00.000Z"),
    });

    await expect(sincronizarTranscricaoCardBpm("card-1", "manual")).resolves.toEqual({
      status: "PENDENTE",
      motivo: "A reunião ainda não ocorreu.",
    });
    expect(cacheFindManyMock).not.toHaveBeenCalled();
    expect(listarRegistrosMock).not.toHaveBeenCalled();
  });

  it("usa a descrição do Calendar como resumo parcial quando a API Meet falha", async () => {
    listarRegistrosMock.mockRejectedValue(new Error("falha transitória"));
    obterEventoGoogleMock.mockResolvedValue({ descricao: "<p>Decisão: enviar proposta.</p>" });

    const resultado = await sincronizarTranscricaoCardBpm("card-1", "automatica");

    expect(resultado).toEqual(expect.objectContaining({ status: "RECEBIDA", atualizada: true }));
    expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      data: { transcricaoReuniao: "Resumo parcial do evento (Google Calendar):\nDecisão: enviar proposta." },
    }));
    expect(historicoCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        valorNovoJson: expect.stringContaining('"fonte":"google_calendar_fallback"'),
      }),
    });
  });

  it("encerra uma integração pendurada antes de 30 segundos", async () => {
    const consulta = executarComPrazoGoogleMeet(
      () => new Promise<never>(() => undefined),
      25_000,
    );
    const assercao = expect(consulta).rejects.toThrow("excedeu o tempo limite");

    await vi.advanceTimersByTimeAsync(25_000);
    await assercao;
  });
});
