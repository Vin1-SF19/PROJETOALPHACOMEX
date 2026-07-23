import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  eventosActionsMock,
  colegasActionsMock,
  adminActionsMock,
} = vi.hoisted(() => ({
  prismaMock: {
    googleCalendarSelecionado: {
      findMany: vi.fn(),
    },
    googleCalendarEventoCache: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    googleCalendarColegaVisivel: {
      findMany: vi.fn(),
    },
    usuarios: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  eventosActionsMock: {
    listarEventosDoCalendario: vi.fn(),
    criarEventoNoCalendario: vi.fn(),
    atualizarEventoParcialNoCalendario: vi.fn(),
    cancelarEventoNoCalendario: vi.fn(),
    consultarDisponibilidade: vi.fn(),
  },
  colegasActionsMock: {
    listarEventosDeColega: vi.fn(),
  },
  adminActionsMock: {
    criarEventoParaColega: vi.fn(),
    atualizarEventoParcialParaColega: vi.fn(),
    cancelarEventoParaColega: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/actions/google-calendar-eventos", () => eventosActionsMock);
vi.mock("@/actions/google-calendar-colegas", () => colegasActionsMock);
vi.mock("@/actions/google-calendar-admin", () => adminActionsMock);

import { executarCalendarTool } from "@/lib/bibble/calendar-tools";

const ctxUsuario = {
  userId: 7,
  role: "OPERACIONAL",
  permissoes: ["calendarioAlpha"],
};

const ctxAdmin = {
  userId: 1,
  role: "Admin",
  permissoes: [],
  confirmouCancelamentoCalendario: true,
};

function calendario(
  sobrescritas: Partial<{
    id: string;
    googleCalendarId: string;
    nome: string;
    timezone: string;
    papelAcesso: string;
    visivel: boolean;
    gravavel: boolean;
  }> = {},
) {
  return {
    id: "cal-1",
    googleCalendarId: "usuario@alpha.com",
    nome: "Agenda principal",
    timezone: "America/Sao_Paulo",
    papelAcesso: "owner",
    visivel: true,
    gravavel: true,
    ...sobrescritas,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.googleCalendarSelecionado.findMany.mockResolvedValue([]);
  prismaMock.googleCalendarEventoCache.findMany.mockResolvedValue([]);
  prismaMock.googleCalendarEventoCache.findUnique.mockResolvedValue(null);
  prismaMock.googleCalendarColegaVisivel.findMany.mockResolvedValue([]);
  prismaMock.usuarios.findUnique.mockResolvedValue({ email: "usuario@alpha.com" });
  prismaMock.usuarios.findFirst.mockResolvedValue(null);
  prismaMock.usuarios.findMany.mockResolvedValue([]);
});

describe("Bibble Calendar tools", () => {
  it("não escolhe silenciosamente entre calendários graváveis ambíguos", async () => {
    prismaMock.googleCalendarSelecionado.findMany.mockResolvedValue([
      calendario({
        id: "cal-a",
        googleCalendarId: "a@alpha.com",
        nome: "Agenda A",
      }),
      calendario({
        id: "cal-b",
        googleCalendarId: "b@alpha.com",
        nome: "Agenda B",
      }),
    ]);

    const resposta = await executarCalendarTool(
      "criar_evento_calendario",
      {
        titulo: "Reunião",
        data_inicio: "2026-07-24T14:00:00-03:00",
      },
      ctxUsuario,
    );

    expect(JSON.parse(resposta)).toMatchObject({
      ok: false,
      erro: expect.stringContaining("mais de um calendário"),
      candidatos: [
        { nome: "Agenda A", gravavel: true },
        { nome: "Agenda B", gravavel: true },
      ],
    });
    expect(eventosActionsMock.criarEventoNoCalendario).not.toHaveBeenCalled();
  });

  it("prefere o calendário principal identificado pelo e-mail do usuário", async () => {
    prismaMock.googleCalendarSelecionado.findMany.mockResolvedValue([
      calendario({
        id: "cal-equipe",
        googleCalendarId: "equipe@alpha.com",
        nome: "Equipe",
      }),
      calendario(),
    ]);
    eventosActionsMock.criarEventoNoCalendario.mockResolvedValue({
      success: true,
      data: { googleEventId: "evt-1" },
    });
    prismaMock.googleCalendarEventoCache.findUnique.mockResolvedValue({
      googleEventId: "evt-1",
      titulo: "Reunião",
      inicioEm: new Date("2026-07-24T17:00:00.000Z"),
      fimEm: new Date("2026-07-24T18:00:00.000Z"),
      diaInteiro: false,
      etag: '"v1"',
      linkMeet: null,
    });

    const resposta = await executarCalendarTool(
      "criar_evento_calendario",
      {
        titulo: "Reunião",
        data_inicio: "2026-07-24T14:00:00-03:00",
      },
      ctxUsuario,
    );

    expect(eventosActionsMock.criarEventoNoCalendario).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: "usuario@alpha.com",
        inicio: new Date("2026-07-24T17:00:00.000Z"),
        fim: new Date("2026-07-24T18:00:00.000Z"),
      }),
    );
    expect(JSON.parse(resposta)).toMatchObject({
      ok: true,
      evento: { id: "evt-1", etag: '"v1"', calendario: "Agenda principal" },
    });
  });

  it("exige offset explícito em evento com horário", async () => {
    const resposta = await executarCalendarTool(
      "criar_evento_calendario",
      {
        titulo: "Reunião",
        data_inicio: "2026-07-24T14:00:00",
        dia_inteiro: false,
      },
      ctxUsuario,
    );

    expect(JSON.parse(resposta)).toMatchObject({
      ok: false,
      erro: "Parâmetros inválidos.",
    });
    expect(eventosActionsMock.criarEventoNoCalendario).not.toHaveBeenCalled();
  });

  it("retorna id e etag ao listar a agenda", async () => {
    prismaMock.googleCalendarSelecionado.findMany.mockResolvedValue([calendario()]);
    eventosActionsMock.listarEventosDoCalendario.mockResolvedValue({
      success: true,
      data: [
        {
          googleEventId: "evt-listado",
          status: "confirmed",
          titulo: "Daily",
          inicioEm: new Date("2026-07-24T12:00:00.000Z"),
          fimEm: new Date("2026-07-24T12:30:00.000Z"),
          diaInteiro: false,
          etag: '"etag-listado"',
          linkMeet: "https://meet.google.com/abc",
        },
      ],
    });

    const resposta = await executarCalendarTool(
      "listar_eventos_calendario",
      { data_inicio: "2026-07-24", data_fim: "2026-07-24" },
      ctxUsuario,
    );

    expect(JSON.parse(resposta)).toMatchObject({
      ok: true,
      total: 1,
      eventos: [
        {
          id: "evt-listado",
          etag: '"etag-listado"',
          titulo: "Daily",
        },
      ],
    });
  });

  it("bloqueia cancelamento sem confirmação explícita", async () => {
    const resposta = await executarCalendarTool(
      "cancelar_evento_calendario",
      { google_event_id: "evt-1" },
      ctxUsuario,
    );

    expect(JSON.parse(resposta)).toMatchObject({
      ok: false,
      erro: expect.stringContaining("Cancelamento pendente"),
    });
    expect(prismaMock.googleCalendarEventoCache.findMany).not.toHaveBeenCalled();
    expect(eventosActionsMock.cancelarEventoNoCalendario).not.toHaveBeenCalled();
  });

  it("exige início, fim e tipo juntos em edição temporal", async () => {
    const resposta = await executarCalendarTool(
      "editar_evento_calendario",
      {
        google_event_id: "evt-1",
        etag: '"etag-1"',
        data_inicio: "2026-07-24T15:00:00-03:00",
      },
      ctxUsuario,
    );

    expect(JSON.parse(resposta)).toMatchObject({
      ok: false,
      detalhes: expect.arrayContaining([
        expect.objectContaining({ mensagem: expect.stringContaining("juntos") }),
      ]),
    });
    expect(eventosActionsMock.atualizarEventoParcialNoCalendario).not.toHaveBeenCalled();
  });

  it("retorna candidatos quando o nome do colega é ambíguo", async () => {
    prismaMock.googleCalendarColegaVisivel.findMany.mockResolvedValue([
      { colega: { id: 10, nome: "Ana Lima", email: "ana.lima@alpha.com" } },
      { colega: { id: 11, nome: "Ana Souza", email: "ana.souza@alpha.com" } },
    ]);

    const resposta = await executarCalendarTool(
      "consultar_agenda_colega",
      { nome_ou_email: "Ana" },
      ctxUsuario,
    );

    expect(JSON.parse(resposta)).toMatchObject({
      ok: false,
      erro: "Colaborador ambíguo.",
      candidatos: [
        { nome: "Ana Lima", email: "ana.lima@alpha.com" },
        { nome: "Ana Souza", email: "ana.souza@alpha.com" },
      ],
    });
    expect(colegasActionsMock.listarEventosDeColega).not.toHaveBeenCalled();
  });

  it("não expõe candidatos fora da lista compartilhada para usuário comum", async () => {
    prismaMock.googleCalendarColegaVisivel.findMany.mockResolvedValue([]);
    prismaMock.usuarios.findMany.mockResolvedValue([
      { id: 10, nome: "Ana Privada", email: "ana.privada@alpha.com" },
    ]);

    const resposta = await executarCalendarTool(
      "consultar_agenda_colega",
      { nome_ou_email: "Ana" },
      ctxUsuario,
    );

    expect(JSON.parse(resposta)).toMatchObject({
      ok: false,
      erro: "Colaborador não encontrado.",
      candidatos: [],
    });
    expect(prismaMock.usuarios.findMany).not.toHaveBeenCalled();
    expect(colegasActionsMock.listarEventosDeColega).not.toHaveBeenCalled();
  });

  it("restringe CRUD de agenda de colega a Admin/CEO", async () => {
    const resposta = await executarCalendarTool(
      "criar_evento_calendario_colega",
      {
        colega_nome_ou_email: "Ana",
        titulo: "Reunião",
        data_inicio: "2026-07-24T14:00:00-03:00",
      },
      ctxUsuario,
    );

    expect(resposta).toContain("Somente Admin/CEO");
    expect(prismaMock.usuarios.findMany).not.toHaveBeenCalled();
    expect(adminActionsMock.criarEventoParaColega).not.toHaveBeenCalled();
  });

  it("Admin cancela evento de colega somente com confirmação", async () => {
    prismaMock.usuarios.findMany.mockResolvedValue([
      {
        id: 10,
        nome: "Ana Lima",
        email: "ana.lima@alpha.com",
      },
    ]);
    adminActionsMock.cancelarEventoParaColega.mockResolvedValue({
      success: true,
      data: { ok: true },
    });

    const resposta = await executarCalendarTool(
      "cancelar_evento_calendario_colega",
      {
        colega_nome_ou_email: "ana.lima@alpha.com",
        google_event_id: "evt-colega",
        etag: '"etag-colega"',
        confirmado: true,
      },
      ctxAdmin,
    );

    expect(adminActionsMock.cancelarEventoParaColega).toHaveBeenCalledWith(10, {
      calendarId: "ana.lima@alpha.com",
      googleEventId: "evt-colega",
      etagConhecido: '"etag-colega"',
    });
    expect(JSON.parse(resposta)).toMatchObject({
      ok: true,
      cancelado: true,
      id: "evt-colega",
    });
  });
});
