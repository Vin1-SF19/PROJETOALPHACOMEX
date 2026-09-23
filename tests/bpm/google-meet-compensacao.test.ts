import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cardFindFirst: vi.fn(), cardFindUnique: vi.fn(), cacheDelete: vi.fn(), historicoFindMany: vi.fn(), historicoUpdate: vi.fn(),
  usuario: vi.fn(), usuarioCalendario: vi.fn(), obter: vi.fn(), cancelar: vi.fn(), atualizar: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmCard: { findFirst: mocks.cardFindFirst, findUnique: mocks.cardFindUnique },
  googleCalendarEventoCache: { deleteMany: mocks.cacheDelete },
  bpmCardHistorico: { findMany: mocks.historicoFindMany, update: mocks.historicoUpdate },
} }));
vi.mock("@/lib/google-calendar/usuario-google", () => ({
  obterUsuarioGoogleAtivo: mocks.usuario, obterUsuarioGoogleAtivoPorCalendario: mocks.usuarioCalendario,
}));
vi.mock("@/lib/google-calendar/client", () => ({
  obterEvento: mocks.obter, cancelarEvento: mocks.cancelar, atualizarEventoParcial: mocks.atualizar,
}));

import { cancelarCriacaoSemVinculo, reconciliarCompensacoesGoogleBpm, reverterReagendamentoSemPersistencia } from "@/lib/bpm/google-meet-compensacao";

const criado = { cardId: "card", userId: 7, calendarioId: "local", googleCalendarId: "primary", googleEventId: "evento" };
const reagendamento = {
  cardId: "card", calendarioId: "local", googleCalendarId: "primary", googleEventId: "evento",
  googleMeetLink: "https://meet.google.com/abc-defg-hij",
  inicioAnterior: "2026-09-20T13:00:00.000Z", fimAnterior: "2026-09-20T14:00:00.000Z",
  inicioNovo: "2026-09-23T13:00:00.000Z", participantesAnteriores: ["cliente@exemplo.com"], timezone: "America/Sao_Paulo",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cardFindFirst.mockResolvedValue(null);
  mocks.cardFindUnique.mockResolvedValue({ googleEventId: "evento", googleCalendarId: "primary", dataReuniao: new Date(reagendamento.inicioAnterior) });
  mocks.usuario.mockResolvedValue({ ok: true, emailUsuario: "organizador@exemplo.com" });
  mocks.usuarioCalendario.mockResolvedValue({ ok: true, emailUsuario: "organizador@exemplo.com" });
  mocks.obter.mockResolvedValue({ status: "confirmed", etag: "etag-1", linkMeet: reagendamento.googleMeetLink, inicio: { dataHora: reagendamento.inicioNovo } });
  mocks.cancelar.mockResolvedValue(undefined);
  mocks.atualizar.mockResolvedValue({});
  mocks.cacheDelete.mockResolvedValue({ count: 1 });
  mocks.historicoUpdate.mockResolvedValue({});
});

it("cancela criação órfã e preserva evento já vinculado", async () => {
  await cancelarCriacaoSemVinculo(criado);
  expect(mocks.cancelar).toHaveBeenCalledWith(expect.objectContaining({ googleEventId: "evento", etagConhecido: "etag-1" }));
  mocks.cardFindFirst.mockResolvedValueOnce({ id: "outro-card" });
  await cancelarCriacaoSemVinculo(criado);
  expect(mocks.cancelar).toHaveBeenCalledTimes(1);
});

it("restaura horário e participantes quando só Google foi alterado", async () => {
  await reverterReagendamentoSemPersistencia(reagendamento);
  expect(mocks.atualizar).toHaveBeenCalledWith(expect.objectContaining({
    etagConhecido: "etag-1",
    evento: expect.objectContaining({ inicio: new Date(reagendamento.inicioAnterior), participantes: ["cliente@exemplo.com"] }),
  }));
});

it("não sobrescreve mudança feita fora do painel", async () => {
  mocks.obter.mockResolvedValueOnce({ status: "confirmed", etag: "etag-2", linkMeet: reagendamento.googleMeetLink, inicio: { dataHora: "2026-09-25T13:00:00.000Z" } });
  await expect(reverterReagendamentoSemPersistencia(reagendamento)).rejects.toThrow("outro usuário");
  expect(mocks.atualizar).not.toHaveBeenCalled();
});

it("cron repete compensação pendente e encerra após sucesso", async () => {
  mocks.historicoFindMany.mockResolvedValue([{ id: "h1", acao: "REUNIAO_CRIACAO_COMPENSACAO_PENDENTE", valorNovoJson: JSON.stringify(criado) }]);
  expect(await reconciliarCompensacoesGoogleBpm()).toEqual({ examinados: 1, concluidos: 1, falhas: 0 });
  expect(mocks.historicoUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { acao: "REUNIAO_COMPENSACAO_CONCLUIDA" } }));
});
