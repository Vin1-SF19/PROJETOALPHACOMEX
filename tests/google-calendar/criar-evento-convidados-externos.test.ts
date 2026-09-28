import { beforeEach, expect, it, vi } from "vitest";

const acesso = vi.hoisted(() => vi.fn());
const usuario = vi.hoisted(() => vi.fn());
const criarGoogle = vi.hoisted(() => vi.fn());
const cacheCreate = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/google-calendar/autorizacao", () => ({ verificarAcessoCalendarioAlpha: acesso }));
vi.mock("@/lib/google-calendar/usuario-google", () => ({ obterUsuarioGoogleAtivo: usuario }));
vi.mock("@/lib/google-calendar/client", () => ({ criarEvento: criarGoogle }));
vi.mock("@/lib/google-calendar/observability", () => ({
  criarCorrelationIdAgendaAlpha: () => "correlacao-teste",
  registrarMetricaPerformanceAgendaAlpha: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: {
  googleCalendarSelecionado: { findFirst: vi.fn().mockResolvedValue({ id: "cal-local", gravavel: true }) },
  googleCalendarEventoCache: { create: cacheCreate },
} }));

import { criarEventoNoCalendario } from "@/actions/google-calendar-eventos";
import { GoogleCalendarError } from "@/lib/google-calendar/errors";

const dados = {
  calendarId: "primary", titulo: "Reunião de teste", timezone: "America/Sao_Paulo",
  diaInteiro: false, inicio: new Date("2026-10-15T15:00:00.000Z"), fim: new Date("2026-10-15T16:00:00.000Z"),
  participantes: ["pessoa@gmail.com", "contato@hotmail.com"], criarMeet: true,
  eventType: "default" as const, visibilidade: "default" as const,
  transparencia: "opaque" as const, lembretesMinutos: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  acesso.mockResolvedValue({ autorizado: true, userId: 7 });
  usuario.mockResolvedValue({ ok: true, emailUsuario: "organizador@exemplo.com" });
});

it("mostra recusa do Google com código seguro e mantém convidados externos no payload", async () => {
  criarGoogle.mockRejectedValue(new GoogleCalendarError("Acesso negado", {
    kind: "forbidden", status: 403, reason: "forbiddenForNonOrganizer",
  }));
  const resultado = await criarEventoNoCalendario(dados);
  expect(resultado).toEqual({
    success: false,
    error: expect.stringContaining("403: forbiddenForNonOrganizer"),
  });
  expect(criarGoogle).toHaveBeenCalledWith(expect.objectContaining({
    evento: expect.objectContaining({ participantes: dados.participantes }),
  }));
  expect(cacheCreate).not.toHaveBeenCalled();
});

it("não trata falha do cache como falha do evento já criado no Google", async () => {
  criarGoogle.mockResolvedValue({
    googleEventId: "evento-1", status: "confirmed", titulo: "Reunião de teste",
    inicio: { dataHora: "2026-10-15T15:00:00.000Z" },
    fim: { dataHora: "2026-10-15T16:00:00.000Z" },
    diaInteiro: false, etag: "v1", linkMeet: "https://meet.google.com/abc-defg-hij",
    eventType: "default", statusPropertiesJson: null, atualizadoEm: "2026-10-15T15:00:00.000Z",
  });
  cacheCreate.mockRejectedValue(new Error("cache temporariamente indisponível"));
  await expect(criarEventoNoCalendario(dados)).resolves.toEqual({
    success: true, data: { googleEventId: "evento-1" },
  });
});
