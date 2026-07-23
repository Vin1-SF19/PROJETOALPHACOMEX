import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, eventosMock, colegasMock, adminMock } = vi.hoisted(() => ({
  prismaMock: {
    googleCalendarSelecionado: { findMany: vi.fn() },
    googleCalendarEventoCache: { findMany: vi.fn(), findUnique: vi.fn() },
    googleCalendarColegaVisivel: { findMany: vi.fn() },
    usuarios: { findUnique: vi.fn(), findMany: vi.fn() },
  },
  eventosMock: {
    listarEventosDoCalendario: vi.fn(),
    criarEventoNoCalendario: vi.fn(),
    atualizarEventoParcialNoCalendario: vi.fn(),
    cancelarEventoNoCalendario: vi.fn(),
    consultarDisponibilidade: vi.fn(),
  },
  colegasMock: { listarEventosDeColega: vi.fn() },
  adminMock: {
    criarEventoParaColega: vi.fn(),
    atualizarEventoParcialParaColega: vi.fn(),
    cancelarEventoParaColega: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/actions/google-calendar-eventos", () => eventosMock);
vi.mock("@/actions/google-calendar-colegas", () => colegasMock);
vi.mock("@/actions/google-calendar-admin", () => adminMock);

import { executarCalendarTool } from "@/lib/bibble/calendar-tools";

const usuario = { userId: 7, role: "OPERACIONAL", permissoes: ["calendarioAlpha"] };
const admin = {
  userId: 1,
  role: "Admin",
  permissoes: [],
  confirmouCancelamentoCalendario: true,
};
const calendario = {
  id: "cal-1",
  googleCalendarId: "usuario@alpha.com",
  nome: "Principal",
  timezone: "America/Sao_Paulo",
  papelAcesso: "owner",
  visivel: true,
  gravavel: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.googleCalendarSelecionado.findMany.mockResolvedValue([]);
  prismaMock.googleCalendarEventoCache.findMany.mockResolvedValue([]);
  prismaMock.googleCalendarEventoCache.findUnique.mockResolvedValue(null);
  prismaMock.googleCalendarColegaVisivel.findMany.mockResolvedValue([]);
  prismaMock.usuarios.findUnique.mockResolvedValue({ email: "usuario@alpha.com" });
  prismaMock.usuarios.findMany.mockResolvedValue([]);
});

describe("Bibble calendar edge cases", () => {
  it("infers all-day and a one-day duration from a civil start date", async () => {
    prismaMock.googleCalendarSelecionado.findMany.mockResolvedValue([calendario]);
    eventosMock.criarEventoNoCalendario.mockResolvedValue({
      success: true,
      data: { googleEventId: "evt-day" },
    });

    await executarCalendarTool(
      "criar_evento_calendario",
      { titulo: "Feriado", data_inicio: "2026-07-24" },
      usuario,
    );

    expect(eventosMock.criarEventoNoCalendario).toHaveBeenCalledWith(
      expect.objectContaining({
        diaInteiro: true,
        inicio: new Date("2026-07-24T03:00:00.000Z"),
        fim: new Date("2026-07-25T03:00:00.000Z"),
      }),
    );
  });

  it.each([
    ["2026-07-24", "2026-07-25T14:00:00-03:00"],
    ["2026-07-24T14:00:00-03:00", "2026-07-25"],
  ])("rejects mixed date formats (%s, %s)", async (inicio, fim) => {
    const resposta = JSON.parse(
      await executarCalendarTool(
        "criar_evento_calendario",
        { titulo: "Misto", data_inicio: inicio, data_fim: fim },
        usuario,
      ),
    );
    expect(resposta.ok).toBe(false);
    expect(eventosMock.criarEventoNoCalendario).not.toHaveBeenCalled();
  });

  it("rejects an explicit query window over sixty days", async () => {
    const resposta = JSON.parse(
      await executarCalendarTool(
        "listar_eventos_calendario",
        { data_inicio: "2026-01-01", data_fim: "2026-03-03" },
        usuario,
      ),
    );
    expect(resposta.detalhes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mensagem: expect.stringContaining("60 dias") }),
      ]),
    );
    expect(eventosMock.listarEventosDoCalendario).not.toHaveBeenCalled();
  });

  it("truncates event lists at 200 and reports the original total", async () => {
    prismaMock.googleCalendarSelecionado.findMany.mockResolvedValue([calendario]);
    eventosMock.listarEventosDoCalendario.mockResolvedValue({
      success: true,
      data: Array.from({ length: 201 }, (_, i) => ({
        googleEventId: `evt-${i}`,
        status: "confirmed",
        titulo: `Evento ${i}`,
        inicioEm: new Date(2026, 6, 24, 8, i),
        fimEm: new Date(2026, 6, 24, 9, i),
        diaInteiro: false,
        etag: `"etag-${i}"`,
        linkMeet: null,
      })),
    });

    const resposta = JSON.parse(
      await executarCalendarTool(
        "listar_eventos_calendario",
        { data_inicio: "2026-07-24", data_fim: "2026-07-24" },
        usuario,
      ),
    );
    expect(resposta).toMatchObject({ total: 201, truncado: true });
    expect(resposta.eventos).toHaveLength(200);
  });

  it.each([
    ["editar_evento_calendario", { google_event_id: "evt", titulo: "Novo" }],
    ["cancelar_evento_calendario", { google_event_id: "evt", confirmado: true }],
  ])("requires an ETag for own mutation tool %s", async (nome, input) => {
    const resposta = JSON.parse(
      await executarCalendarTool(nome, input, {
        ...usuario,
        confirmouCancelamentoCalendario: true,
      }),
    );
    expect(resposta).toMatchObject({ ok: false });
    expect(eventosMock.atualizarEventoParcialNoCalendario).not.toHaveBeenCalled();
    expect(eventosMock.cancelarEventoNoCalendario).not.toHaveBeenCalled();
  });

  it.each([
    [
      "editar_evento_calendario_colega",
      { colega_nome_ou_email: "ana@alpha.com", google_event_id: "evt", titulo: "Novo" },
    ],
    [
      "cancelar_evento_calendario_colega",
      { colega_nome_ou_email: "ana@alpha.com", google_event_id: "evt", confirmado: true },
    ],
  ])("requires an ETag for colleague mutation tool %s", async (nome, input) => {
    const resposta = JSON.parse(await executarCalendarTool(nome, input, admin));
    expect(resposta).toMatchObject({ ok: false });
    expect(adminMock.atualizarEventoParcialParaColega).not.toHaveBeenCalled();
    expect(adminMock.cancelarEventoParaColega).not.toHaveBeenCalled();
  });

  it("does not trust confirmado=true without server-side confirmation context", async () => {
    const resposta = JSON.parse(
      await executarCalendarTool(
        "cancelar_evento_calendario",
        { google_event_id: "evt", etag: '"v1"', confirmado: true },
        usuario,
      ),
    );
    expect(resposta.erro).toContain("Cancelamento pendente");
    expect(eventosMock.cancelarEventoNoCalendario).not.toHaveBeenCalled();
  });

  it("limits common-user colleague resolution to visible active shares", async () => {
    prismaMock.googleCalendarColegaVisivel.findMany.mockResolvedValue([
      { colega: { id: 10, nome: "Ana", email: "ana@alpha.com" } },
    ]);
    colegasMock.listarEventosDeColega.mockResolvedValue({ success: true, data: [] });

    await executarCalendarTool(
      "consultar_agenda_colega",
      { nome_ou_email: "ana@alpha.com" },
      usuario,
    );
    expect(prismaMock.googleCalendarColegaVisivel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 7,
          visivel: true,
          colega: expect.objectContaining({ status: "ATIVO" }),
        }),
      }),
    );
    expect(prismaMock.usuarios.findMany).not.toHaveBeenCalled();
  });

  it("limits Admin colleague resolution to active users other than self", async () => {
    prismaMock.usuarios.findMany.mockResolvedValue([
      { id: 10, nome: "Ana", email: "ana@alpha.com" },
    ]);
    colegasMock.listarEventosDeColega.mockResolvedValue({ success: true, data: [] });
    await executarCalendarTool(
      "consultar_agenda_colega",
      { nome_ou_email: "Ana" },
      admin,
    );
    expect(prismaMock.usuarios.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ATIVO", id: { not: 1 } }),
      }),
    );
  });

  it("sends only visible selected calendars to FreeBusy", async () => {
    prismaMock.googleCalendarSelecionado.findMany.mockResolvedValue([
      calendario,
      {
        ...calendario,
        id: "hidden",
        googleCalendarId: "hidden@alpha.com",
        nome: "Hidden",
        visivel: false,
      },
    ]);
    eventosMock.consultarDisponibilidade.mockResolvedValue({ success: true, data: {} });

    await executarCalendarTool(
      "consultar_disponibilidade_calendario",
      {
        data_inicio: "2026-07-24T14:00:00-03:00",
        data_fim: "2026-07-24T15:00:00-03:00",
      },
      usuario,
    );
    expect(eventosMock.consultarDisponibilidade).toHaveBeenCalledWith({
      googleCalendarIds: ["usuario@alpha.com"],
      inicio: new Date("2026-07-24T17:00:00.000Z"),
      fim: new Date("2026-07-24T18:00:00.000Z"),
    });
  });
});
