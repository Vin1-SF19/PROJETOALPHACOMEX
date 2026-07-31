import { beforeEach, describe, expect, it, vi } from "vitest";

const acessoMock = vi.hoisted(() => vi.fn());
const usuarioGoogleMock = vi.hoisted(() => vi.fn());
const clientMock = vi.hoisted(() => ({
  atualizarEventoParcial: vi.fn(),
  cancelarEvento: vi.fn(),
  consultarFreeBusy: vi.fn(),
  criarEvento: vi.fn(),
  listarCalendarios: vi.fn(),
  obterEvento: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  googleCalendarSelecionado: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  googleCalendarEventoCache: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/google-calendar/autorizacao", () => ({
  verificarAcessoCalendarioAlpha: acessoMock,
}));
vi.mock("@/lib/google-calendar/usuario-google", () => ({
  obterUsuarioGoogleAtivo: usuarioGoogleMock,
}));
vi.mock("@/lib/google-calendar/client", () => clientMock);
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  atualizarEventoNoCalendario,
  carregarDetalhesEventoParaEdicao,
  listarEventosCache,
} from "@/actions/google-calendar-eventos";

const calendarioOwned = {
  id: "cal-local-1",
  googleCalendarId: "primary",
  timezone: "America/Sao_Paulo",
  gravavel: true,
  syncToken: "sync-1",
  ultimaSincronizacaoEm: new Date("2026-07-30T12:00:00Z"),
  conexao: { userId: 7 },
};

describe("Agenda Alpha cache-first actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acessoMock.mockResolvedValue({ autorizado: true, userId: 7 });
    usuarioGoogleMock.mockResolvedValue({
      ok: true,
      emailUsuario: "sessao@alpha.com",
      conexaoId: "conexao-1",
    });
    prismaMock.googleCalendarSelecionado.findUnique.mockResolvedValue(calendarioOwned);
    prismaMock.googleCalendarSelecionado.findFirst.mockResolvedValue({
      id: "cal-local-1",
      googleCalendarId: "primary",
      timezone: "America/Sao_Paulo",
      gravavel: true,
    });
    prismaMock.googleCalendarEventoCache.findUnique.mockResolvedValue({
      etag: '"v2"',
    });
    prismaMock.googleCalendarEventoCache.findMany.mockResolvedValue([
      {
        id: "cache-1",
        calendarioId: "cal-local-1",
        googleEventId: "evt-1",
        inicioEm: new Date("2026-07-30T13:00:00Z"),
        fimEm: new Date("2026-07-30T14:00:00Z"),
      },
    ]);
  });

  it("reads only the owned local cache and never calls Google", async () => {
    const resultado = await listarEventosCache({
      calendarioId: "cal-local-1",
      inicioISO: "2026-07-30T00:00:00.000Z",
      fimISO: "2026-07-31T00:00:00.000Z",
    });

    expect(resultado).toMatchObject({
      success: true,
      ultimaSincronizacaoEm: "2026-07-30T12:00:00.000Z",
    });
    expect(prismaMock.googleCalendarEventoCache.findMany).toHaveBeenCalledTimes(1);
    expect(usuarioGoogleMock).not.toHaveBeenCalled();
    expect(clientMock.listarCalendarios).not.toHaveBeenCalled();
    expect(clientMock.obterEvento).not.toHaveBeenCalled();
  });

  it("blocks cache reads when the local calendar belongs to another user", async () => {
    prismaMock.googleCalendarSelecionado.findUnique.mockResolvedValue({
      ...calendarioOwned,
      conexao: { userId: 99 },
    });

    const resultado = await listarEventosCache({
      calendarioId: "cal-local-1",
      inicioISO: "2026-07-30T00:00:00.000Z",
      fimISO: "2026-07-31T00:00:00.000Z",
    });

    expect(resultado).toEqual({
      success: false,
      error: "Calendário não encontrado.",
    });
    expect(prismaMock.googleCalendarEventoCache.findMany).not.toHaveBeenCalled();
  });

  it("hydrates details using the session email and the owned Google calendar id", async () => {
    clientMock.obterEvento.mockResolvedValue({
      googleEventId: "evt-1",
      status: "confirmed",
      titulo: "Planejamento",
      descricao: "Completa",
      localizacao: null,
      inicio: { dataHora: "2026-07-30T13:00:00Z" },
      fim: { dataHora: "2026-07-30T14:00:00Z" },
      diaInteiro: false,
      recorrenciaRegras: null,
      eventoRecorrenteIdOrigem: null,
      participantes: [],
      linkMeet: null,
      etag: '"v2"',
      atualizadoEm: "2026-07-30T12:30:00Z",
      visibilidade: "default",
    });

    const resultado = await carregarDetalhesEventoParaEdicao({
      calendarioId: "cal-local-1",
      googleEventId: "evt-1",
    });

    expect(resultado).toMatchObject({
      success: true,
      data: { googleEventId: "evt-1", etag: '"v2"' },
    });
    expect(clientMock.obterEvento).toHaveBeenCalledWith({
      emailUsuario: "sessao@alpha.com",
      calendarId: "primary",
      googleEventId: "evt-1",
    });
    expect(prismaMock.googleCalendarEventoCache.upsert).toHaveBeenCalledTimes(1);
  });

  it("edição envia PATCH com ETag e omite detalhes vazios para não apagar participantes/Meet", async () => {
    clientMock.atualizarEventoParcial.mockResolvedValue({
      googleEventId: "evt-1",
      status: "confirmed",
      titulo: "Novo título",
      descricao: "Descrição preservada",
      localizacao: null,
      inicio: { dataHora: "2026-07-30T13:00:00Z" },
      fim: { dataHora: "2026-07-30T14:00:00Z" },
      diaInteiro: false,
      recorrenciaRegras: null,
      eventoRecorrenteIdOrigem: null,
      participantes: [{ email: "pessoa@alpha.com", status: "accepted", organizador: false }],
      linkMeet: "https://meet.google.com/preservado",
      etag: '"v3"',
      atualizadoEm: "2026-07-30T12:30:00Z",
      visibilidade: "default",
    });

    const resultado = await atualizarEventoNoCalendario({
      calendarId: "primary",
      googleEventId: "evt-1",
      etagConhecido: '"v2"',
      titulo: "Novo título",
      timezone: "America/Sao_Paulo",
      diaInteiro: false,
      inicio: new Date("2026-07-30T13:00:00Z"),
      fim: new Date("2026-07-30T14:00:00Z"),
      participantes: [],
      criarMeet: false,
    });

    expect(resultado).toEqual({ success: true, data: { conflito: false } });
    expect(clientMock.atualizarEventoParcial).toHaveBeenCalledWith({
      emailUsuario: "sessao@alpha.com",
      calendarId: "primary",
      googleEventId: "evt-1",
      etagConhecido: '"v2"',
      evento: expect.objectContaining({
        descricaoGoogle: undefined,
        participantes: undefined,
        criarMeet: false,
      }),
    });
  });
});
