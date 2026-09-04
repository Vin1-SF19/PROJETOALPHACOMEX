import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const acessoMock = vi.hoisted(() => vi.fn());
const criarEventoMock = vi.hoisted(() => vi.fn());
const atualizarEventoMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: acessoMock }));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/actions/google-calendar-eventos", () => ({ criarEventoNoCalendario: criarEventoMock }));
vi.mock("@/lib/google-calendar/client", () => ({
  atualizarEventoParcial: atualizarEventoMock,
  cancelarEvento: vi.fn(),
  obterEvento: vi.fn(),
}));
vi.mock("@/lib/google-calendar/usuario-google", () => ({
  obterUsuarioGoogleAtivo: vi.fn(),
  obterUsuarioGoogleAtivoPorCalendario: vi.fn(),
}));
vi.mock("@/lib/google-calendar/cache-eventos", () => ({ dadosCacheDeEvento: vi.fn() }));
vi.mock("@/lib/google-calendar/errors", () => ({
  GoogleCalendarError: class GoogleCalendarError extends Error {},
}));

import { AgendarReuniaoGoogleMeetBpm, ReagendarReuniaoBpm } from "@/actions/bpm/GoogleMeet";

const CARD_ID = "clw0000000000000card";
const DATA = new Date("2026-08-20T13:00:00.000Z");
const ERRO_ETAPA = "O Google Meet só pode ser agendado ou reagendado na etapa Agendar Reunião.";

describe("Google Meet: guard de etapa no backend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    acessoMock.mockResolvedValue(undefined);
    prismaMock.bpmCard.findUnique.mockResolvedValue({
      id: CARD_ID,
      etapaId: "clw0000000000000etap",
      updatedAt: new Date("2026-08-13T00:00:00.000Z"),
      etapa: { nome: "Reunião Agendada" },
      googleEventId: null,
      googleCalendarId: null,
      googleMeetLink: null,
      dataReuniao: null,
      transcricaoReuniao: null,
      empresa: { nomeFantasia: "Empresa", razaoSocial: "Empresa LTDA" },
    });
  });

  it("recusa chamadas diretas de agendamento fora de Agendar Reunião antes do Calendar", async () => {
    await expect(AgendarReuniaoGoogleMeetBpm({ cardId: CARD_ID, dataHora: DATA })).resolves.toEqual({
      success: false,
      error: ERRO_ETAPA,
    });
    expect(criarEventoMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("recusa chamadas diretas de reagendamento fora de Agendar Reunião antes do Calendar", async () => {
    await expect(ReagendarReuniaoBpm({ cardId: CARD_ID, dataHora: DATA })).resolves.toEqual({
      success: false,
      error: ERRO_ETAPA,
    });
    expect(atualizarEventoMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita data fora do contrato antes de ownership, Calendar e persistência", async () => {
    const invalidas = [
      null,
      "",
      "data-invalida",
      "09/04/2026 10:30",
      "September 4, 2026 10:30",
      "0",
      "2026-09-04",
      "2026-02-30T10:30:00Z",
      false,
    ];
    for (const dataHora of invalidas) {
      expect((await AgendarReuniaoGoogleMeetBpm({ cardId: CARD_ID, dataHora })).success).toBe(false);
      expect((await ReagendarReuniaoBpm({ cardId: CARD_ID, dataHora })).success).toBe(false);
    }
    expect(acessoMock).not.toHaveBeenCalled();
    expect(criarEventoMock).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("exige sessão antes de validar ou consultar o card", async () => {
    authMock.mockResolvedValueOnce(null);
    await expect(AgendarReuniaoGoogleMeetBpm({ cardId: CARD_ID, dataHora: DATA })).resolves.toEqual({
      success: false,
      error: "Não autorizado",
    });
    expect(acessoMock).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.findUnique).not.toHaveBeenCalled();
  });
});
