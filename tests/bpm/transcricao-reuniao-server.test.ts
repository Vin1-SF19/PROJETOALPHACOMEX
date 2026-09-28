import { beforeEach, describe, expect, it, vi } from "vitest";

const listarRegistrosMock = vi.hoisted(() => vi.fn());
const carregarArtefatoMock = vi.hoisted(() => vi.fn());
const listarResumosMock = vi.hoisted(() => vi.fn());
const listarGravacoesMock = vi.hoisted(() => vi.fn());
const obterUsuarioGoogleMock = vi.hoisted(() => vi.fn());
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
  listarResumosMeet: listarResumosMock,
  listarGravacoesMeet: listarGravacoesMock,
}));
vi.mock("@/lib/google-calendar/usuario-google", () => ({
  obterUsuarioGoogleAtivoPorCalendario: obterUsuarioGoogleMock,
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
  obterLinksArtefatosMeetCardBpm,
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
    listarResumosMock.mockResolvedValue([]);
    listarGravacoesMock.mockResolvedValue([]);
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

  it("ignora sessões curtas sem transcrição do mesmo Meet e importa a sessão da reunião reagendada", async () => {
    cardFindUniqueMock.mockResolvedValue({ ...cardBase, dataReuniao: new Date("2026-08-12T14:00:00.000Z") });
    listarRegistrosMock.mockResolvedValue([
      { name: "conferenceRecords/antiga", startTime: "2026-08-10T14:00:00.000Z", endTime: "2026-08-10T14:30:00.000Z" },
      { name: "conferenceRecords/curta", startTime: "2026-08-12T14:01:00.000Z", endTime: "2026-08-12T14:01:03.000Z" },
      { name: "conferenceRecords/reagendada", startTime: "2026-08-12T14:01:15.000Z", endTime: "2026-08-12T14:30:00.000Z" },
      { name: "conferenceRecords/outra-reuniao", startTime: "2026-08-12T18:00:00.000Z", endTime: "2026-08-12T18:30:00.000Z" },
    ]);
    carregarArtefatoMock.mockImplementation(async (_email, name) => name === "conferenceRecords/curta"
      ? { transcriptsEncontrados: 0, entradas: [], participantes: new Map() }
      : { transcriptsEncontrados: 1, entradas: [{ name: "entrada", participant: null, text: "Reunião reagendada", startTime: "2026-08-12T14:02:00.000Z" }], participantes: new Map() });

    const resultado = await sincronizarTranscricaoCardBpm("card-1", "manual");

    expect(resultado).toMatchObject({ status: "RECEBIDA", atualizada: true });
    expect(carregarArtefatoMock.mock.calls.map(([, name]) => name)).toEqual([
      "conferenceRecords/curta", "conferenceRecords/reagendada",
    ]);
    expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      data: { transcricaoReuniao: "[14:02:00] Participante: Reunião reagendada" },
    }));
  });

  it("busca links de resumo na sessão que gerou artefatos", async () => {
    listarRegistrosMock.mockResolvedValue([
      { name: "conferenceRecords/curta", startTime: "2026-08-12T12:01:00.000Z", endTime: "2026-08-12T12:01:03.000Z" },
      { name: "conferenceRecords/principal", startTime: "2026-08-12T12:01:15.000Z", endTime: "2026-08-12T12:30:00.000Z" },
    ]);
    listarResumosMock.mockImplementation(async (_email, name) => name === "conferenceRecords/principal"
      ? [{ nome: "Resumo 1", url: "https://docs.google.com/document/d/exemplo/view" }] : []);
    listarGravacoesMock.mockImplementation(async (_email, name) => name === "conferenceRecords/curta"
      ? [{ nome: "Gravação 1", url: "https://drive.google.com/file/d/exemplo/view" }] : []);

    const resultado = await obterLinksArtefatosMeetCardBpm("card-1");

    expect(resultado.resumos).toHaveLength(1);
    expect(resultado.gravacoes).toHaveLength(1);
    expect(listarResumosMock.mock.calls.map(([, name]) => name)).toEqual([
      "conferenceRecords/curta", "conferenceRecords/principal",
    ]);
  });

  it("reúne entradas de sessões próximas sem importar a transcrição de outra reunião", async () => {
    listarRegistrosMock.mockResolvedValue([
      { name: "conferenceRecords/curta", startTime: "2026-08-12T12:01:00.000Z", endTime: "2026-08-12T12:01:03.000Z" },
      { name: "conferenceRecords/principal", startTime: "2026-08-12T12:01:15.000Z", endTime: "2026-08-12T12:30:00.000Z" },
      { name: "conferenceRecords/outra", startTime: "2026-08-12T18:00:00.000Z", endTime: "2026-08-12T18:30:00.000Z" },
    ]);
    carregarArtefatoMock.mockImplementation(async (_email, name) => ({
      transcriptsEncontrados: 1,
      entradas: [{
        name: `${name}/entry`, participant: null,
        text: name === "conferenceRecords/curta" ? "Início" : name === "conferenceRecords/principal" ? "Conteúdo principal" : "Outra empresa",
        startTime: name === "conferenceRecords/curta" ? "2026-08-12T12:01:02.000Z" : "2026-08-12T12:05:00.000Z",
      }],
      participantes: new Map(),
    }));

    const resultado = await sincronizarTranscricaoCardBpm("card-1", "manual");

    expect(resultado.status).toBe("RECEBIDA");
    expect(carregarArtefatoMock.mock.calls.map(([, name]) => name)).toEqual([
      "conferenceRecords/curta", "conferenceRecords/principal",
    ]);
    expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      data: { transcricaoReuniao: "[12:01:02] Participante: Início\n[12:05:00] Participante: Conteúdo principal" },
    }));
  });

  it("mantém pendente quando só outra reunião distante tem transcrição no mesmo link", async () => {
    listarRegistrosMock.mockResolvedValue([
      { name: "conferenceRecords/proxima", startTime: "2026-08-12T12:01:00.000Z", endTime: "2026-08-12T12:01:03.000Z" },
      { name: "conferenceRecords/outra", startTime: "2026-08-12T18:00:00.000Z", endTime: "2026-08-12T18:30:00.000Z" },
    ]);
    carregarArtefatoMock.mockImplementation(async (_email, name) => name === "conferenceRecords/proxima"
      ? { transcriptsEncontrados: 0, entradas: [], participantes: new Map() }
      : { transcriptsEncontrados: 1, entradas: [{ name: "outra/entry", participant: null, text: "Outra reunião", startTime: "2026-08-12T18:02:00.000Z" }], participantes: new Map() });

    const resultado = await sincronizarTranscricaoCardBpm("card-1", "manual");

    expect(resultado.status).toBe("PENDENTE");
    expect(carregarArtefatoMock.mock.calls.map(([, name]) => name)).toEqual(["conferenceRecords/proxima"]);
    expect(updateManyMock).not.toHaveBeenCalled();
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

  it("não usa a descrição do Calendar como transcrição quando a API Meet falha", async () => {
    listarRegistrosMock.mockRejectedValue(new Error("falha transitória"));

    const resultado = await sincronizarTranscricaoCardBpm("card-1", "automatica");

    expect(resultado.status).toBe("ERRO");
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(historicoCreateMock).not.toHaveBeenCalled();
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
