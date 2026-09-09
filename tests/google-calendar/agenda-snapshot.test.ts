import { beforeEach, describe, expect, it, vi } from "vitest";

const acessoMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  googleCalendarSelecionado: { findMany: vi.fn() },
  googleCalendarTaskCache: { findMany: vi.fn() },
}));
const metricaMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/google-calendar/autorizacao", () => ({
  verificarAcessoCalendarioAlpha: acessoMock,
}));
vi.mock("@/lib/google-calendar/observability", () => ({
  criarCorrelationIdAgendaAlpha: () => "12345678-1234-1234-1234-123456789abc",
  registrarMetricaPerformanceAgendaAlpha: metricaMock,
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { carregarIntervaloAgendaAlpha } from "@/actions/google-calendar-agenda";

describe("Agenda Alpha snapshot consolidado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acessoMock.mockResolvedValue({ autorizado: true, userId: 7 });
    prismaMock.googleCalendarSelecionado.findMany.mockResolvedValue([
      {
        id: "cal-1",
        googleCalendarId: "primary",
        nome: "Principal",
        corHex: "#3366ff",
        gravavel: true,
        eventos: [
          {
            id: "cache-1",
            googleEventId: "google-1",
            status: "confirmed",
            titulo: "Planejamento",
            inicioEm: new Date("2026-09-09T12:00:00.000Z"),
            fimEm: new Date("2026-09-09T13:00:00.000Z"),
            diaInteiro: false,
            etag: '"v1"',
            linkMeet: null,
            eventType: "default",
            statusPropertiesJson: null,
          },
        ],
      },
    ]);
    prismaMock.googleCalendarTaskCache.findMany.mockResolvedValue([
      {
        id: "task-1",
        titulo: "Retornar cliente",
        notas: null,
        status: "needsAction",
        vencimentoEm: new Date("2026-09-09T12:00:00.000Z"),
        inicioLocalEm: null,
        fimLocalEm: null,
        agendamentoChamado: null,
        taskList: { googleTaskListId: "list-1", titulo: "Minhas tarefas" },
      },
    ]);
  });

  it("autoriza uma vez e retorna eventos e tarefas em consultas consolidadas", async () => {
    const resultado = await carregarIntervaloAgendaAlpha({
      inicioISO: "2026-09-01T00:00:00.000Z",
      fimISO: "2026-10-01T00:00:00.000Z",
    });

    expect(resultado).toMatchObject({
      success: true,
      data: {
        eventos: [{ id: "cache-1", calendarioGoogleId: "primary" }],
        tarefas: [{ id: "task-1", taskListGoogleId: "list-1" }],
      },
    });
    expect(acessoMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.googleCalendarSelecionado.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.googleCalendarTaskCache.findMany).toHaveBeenCalledTimes(1);
    expect(metricaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "snapshot_intervalo",
        outcome: "success",
        itemCount: 2,
      }),
    );
  });

  it("rejeita intervalos maiores que a janela anual antes de consultar o banco", async () => {
    const resultado = await carregarIntervaloAgendaAlpha({
      inicioISO: "2025-01-01T00:00:00.000Z",
      fimISO: "2026-09-01T00:00:00.000Z",
    });

    expect(resultado).toEqual({
      success: false,
      error: "Intervalo da agenda inválido.",
    });
    expect(prismaMock.googleCalendarSelecionado.findMany).not.toHaveBeenCalled();
  });

  it("preserva resposta segura quando o cache remoto falha", async () => {
    prismaMock.googleCalendarSelecionado.findMany.mockRejectedValue(
      new Error("database-url-secreta"),
    );

    const resultado = await carregarIntervaloAgendaAlpha({
      inicioISO: "2026-09-01T00:00:00.000Z",
      fimISO: "2026-10-01T00:00:00.000Z",
    });

    expect(resultado).toEqual({
      success: false,
      error: "Não foi possível atualizar este período da Agenda Alpha.",
    });
    expect(metricaMock).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "error" }),
    );
  });
});
