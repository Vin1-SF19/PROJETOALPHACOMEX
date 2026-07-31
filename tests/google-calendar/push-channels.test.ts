import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  googleCalendarPushChannel: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));
const iniciarWatchMock = vi.hoisted(() => vi.fn());
const encerrarWatchMock = vi.hoisted(() => vi.fn());
const usuarioGoogleMock = vi.hoisted(() => vi.fn());
const leaseMocks = vi.hoisted(() => ({
  adquirir: vi.fn(),
  exigir: vi.fn(),
  liberar: vi.fn(),
  renovar: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/google-calendar/client", () => ({
  iniciarWatchEventos: iniciarWatchMock,
  encerrarWatchEventos: encerrarWatchMock,
}));
vi.mock("@/lib/google-calendar/usuario-google", () => ({
  obterUsuarioGoogleAtivoPorCalendario: usuarioGoogleMock,
}));
vi.mock("@/lib/google-calendar/distributed-lock", () => ({
  AgendaAlphaLeaseLostError: class extends Error {},
  adquirirLeaseSincronizacao: leaseMocks.adquirir,
  exigirLeaseSincronizacao: leaseMocks.exigir,
  liberarLeaseSincronizacao: leaseMocks.liberar,
  renovarLeaseSincronizacao: leaseMocks.renovar,
}));

import {
  autenticarCanalPush,
  criarCanalPush,
  encerrarCanalPush,
  hashTokenCanalPush,
  renovarCanalPush,
  tokenCanalPushCorresponde,
} from "@/lib/google-calendar/push-channels";

describe("push channels da Agenda Alpha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usuarioGoogleMock.mockResolvedValue({
      ok: true,
      emailUsuario: "subject-do-banco@alpha.com",
      userId: 7,
      conexaoId: "conn-1",
      calendarioId: "cal-1",
      googleCalendarId: "primary",
    });
    prismaMock.googleCalendarPushChannel.create.mockResolvedValue({
      id: "push-1",
    });
    prismaMock.googleCalendarPushChannel.updateMany.mockResolvedValue({
      count: 1,
    });
    const lease = {
      id: "lease-1",
      calendarioId: "cal-1",
      ownerId: "worker-1",
      fencingToken: 1,
      leaseExpiresAt: new Date(Date.now() + 90_000),
    };
    leaseMocks.adquirir.mockResolvedValue(lease);
    leaseMocks.exigir.mockResolvedValue(undefined);
    leaseMocks.liberar.mockResolvedValue(true);
    leaseMocks.renovar.mockResolvedValue(lease);
  });

  it("persiste somente SHA-256 e usa o subject resolvido do banco", async () => {
    const expiresAt = new Date("2026-08-05T12:00:00.000Z");
    iniciarWatchMock.mockResolvedValue({
      googleChannelId: "channel-1",
      googleResourceId: "resource-1",
      resourceUri: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      expiresAt,
    });
    prismaMock.googleCalendarPushChannel.update.mockResolvedValue({
      id: "push-1",
      calendarioId: "cal-1",
      googleChannelId: "channel-1",
      expiresAt,
      renewAfter: new Date("2026-08-05T00:00:00.000Z"),
    });

    await criarCanalPush("cal-1", {
      webhookBaseUrl: "https://painel.example.com",
      agora: () => new Date("2026-07-30T12:00:00.000Z"),
      gerarChannelId: () => "channel-1",
      gerarToken: () => "token-secreto",
    });

    expect(prismaMock.googleCalendarPushChannel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        calendarioId: "cal-1",
        googleChannelId: "channel-1",
        channelTokenHash: hashTokenCanalPush("token-secreto"),
      }),
      select: { id: true },
    });
    expect(
      prismaMock.googleCalendarPushChannel.create.mock.calls[0]?.[0]?.data,
    ).not.toEqual(expect.objectContaining({ channelToken: "token-secreto" }));
    expect(iniciarWatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        emailUsuario: "subject-do-banco@alpha.com",
        calendarId: "primary",
        channelToken: "token-secreto",
        webhookUrl: "https://painel.example.com/api/calendario-alpha/webhook",
      }),
    );
  });

  it("compara o token em SHA-256 e rejeita token grande ou hash inválido", () => {
    const hash = hashTokenCanalPush("segredo");
    expect(tokenCanalPushCorresponde("segredo", hash)).toBe(true);
    expect(tokenCanalPushCorresponde("outro", hash)).toBe(false);
    expect(tokenCanalPushCorresponde("x".repeat(257), hash)).toBe(false);
    expect(tokenCanalPushCorresponde("segredo", "invalido")).toBe(false);
  });

  it("autentica canal ativo e rejeita token/resource divergentes", async () => {
    prismaMock.googleCalendarPushChannel.findUnique.mockResolvedValue({
      id: "push-1",
      calendarioId: "cal-1",
      googleChannelId: "channel-1",
      googleResourceId: "resource-1",
      channelTokenHash: hashTokenCanalPush("segredo"),
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 60_000),
      lastMessageNumber: "41",
    });

    await expect(
      autenticarCanalPush({
        googleChannelId: "channel-1",
        channelToken: "segredo",
        googleResourceId: "resource-1",
      }),
    ).resolves.toMatchObject({ id: "push-1", calendarioId: "cal-1" });
    await expect(
      autenticarCanalPush({
        googleChannelId: "channel-1",
        channelToken: "segredo-incorreto",
        googleResourceId: "resource-1",
      }),
    ).resolves.toBeNull();
    await expect(
      autenticarCanalPush({
        googleChannelId: "channel-1",
        channelToken: "segredo",
        googleResourceId: "resource-divergente",
      }),
    ).resolves.toBeNull();
  });

  it("faz comparacao dummy para canal inexistente sem persistir segredo", async () => {
    prismaMock.googleCalendarPushChannel.findUnique.mockResolvedValue(null);

    await expect(
      autenticarCanalPush({
        googleChannelId: "channel-inexistente",
        channelToken: "token-super-secreto",
        googleResourceId: "resource-inexistente",
      }),
    ).resolves.toBeNull();

    expect(prismaMock.googleCalendarPushChannel.findUnique).toHaveBeenCalledWith({
      where: { googleChannelId: "channel-inexistente" },
      select: expect.objectContaining({
        channelTokenHash: true,
        lastMessageNumber: true,
      }),
    });
  });

  it("encerra watch remoto best-effort quando a persistencia local falha", async () => {
    const erroPersistencia = new Error("persistencia indisponivel");
    iniciarWatchMock.mockResolvedValue({
      googleChannelId: "channel-1",
      googleResourceId: "resource-1",
      resourceUri:
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      expiresAt: new Date("2026-08-05T12:00:00.000Z"),
    });
    prismaMock.googleCalendarPushChannel.update.mockRejectedValue(
      erroPersistencia,
    );
    encerrarWatchMock.mockRejectedValue(new Error("stop indisponivel"));

    await expect(
      criarCanalPush("cal-1", {
        webhookBaseUrl: "https://painel.example.com",
        agora: () => new Date("2026-07-30T12:00:00.000Z"),
        gerarChannelId: () => "channel-1",
        gerarToken: () => "token-secreto",
      }),
    ).rejects.toBe(erroPersistencia);

    expect(encerrarWatchMock).toHaveBeenCalledWith({
      emailUsuario: "subject-do-banco@alpha.com",
      channelId: "channel-1",
      resourceId: "resource-1",
    });
    expect(encerrarWatchMock.mock.calls[0]?.[0]).not.toHaveProperty(
      "channelToken",
    );
  });

  it("serializa dois renew concorrentes e cria exatamente um novo watch", async () => {
    const expiresAt = new Date("2026-08-05T12:00:00.000Z");
    const renewAfter = new Date("2026-08-05T00:00:00.000Z");
    const canalAtivo = {
      id: "push-antigo",
      calendarioId: "cal-1",
      status: "ACTIVE",
      renewAfter,
      googleChannelId: "channel-antigo",
      googleResourceId: "resource-antigo",
    };
    prismaMock.googleCalendarPushChannel.findUnique.mockImplementation(
      ({ select }: { select: Record<string, boolean> }) => {
        if (select.renewAfter) return Promise.resolve(canalAtivo);
        if (select.googleChannelId) return Promise.resolve(canalAtivo);
        return Promise.resolve({
          id: canalAtivo.id,
          calendarioId: canalAtivo.calendarioId,
          status: canalAtivo.status,
        });
      },
    );
    leaseMocks.adquirir
      .mockResolvedValueOnce({
        id: "lease-1",
        calendarioId: "cal-1",
        ownerId: "worker-1",
        fencingToken: 1,
        leaseExpiresAt: new Date(Date.now() + 90_000),
      })
      .mockResolvedValueOnce(null);
    iniciarWatchMock.mockResolvedValue({
      googleChannelId: "channel-novo",
      googleResourceId: "resource-novo",
      resourceUri: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      expiresAt,
    });
    prismaMock.googleCalendarPushChannel.create.mockResolvedValue({
      id: "push-novo",
    });
    prismaMock.googleCalendarPushChannel.update.mockResolvedValue({
      id: "push-novo",
      calendarioId: "cal-1",
      googleChannelId: "channel-novo",
      expiresAt,
      renewAfter,
    });
    encerrarWatchMock.mockResolvedValue(undefined);

    const resultados = await Promise.allSettled([
      renovarCanalPush("push-antigo", {
        webhookBaseUrl: "https://painel.example.com",
        gerarChannelId: () => "channel-novo",
        gerarToken: () => "token-novo",
      }),
      renovarCanalPush("push-antigo", {
        webhookBaseUrl: "https://painel.example.com",
        gerarChannelId: () => "channel-novo-2",
        gerarToken: () => "token-novo-2",
      }),
    ]);

    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((resultado) => resultado.status === "rejected")).toHaveLength(1);
    expect(iniciarWatchMock).toHaveBeenCalledTimes(1);
    expect(encerrarWatchMock).toHaveBeenCalledTimes(1);
  });

  it("não recria watch quando renew encontra o canal já parado", async () => {
    prismaMock.googleCalendarPushChannel.findUnique
      .mockResolvedValueOnce({
        id: "push-antigo",
        calendarioId: "cal-1",
      })
      .mockResolvedValueOnce({
        id: "push-antigo",
        calendarioId: "cal-1",
        status: "STOPPED",
        renewAfter: new Date(),
      });

    await expect(
      renovarCanalPush("push-antigo", {
        webhookBaseUrl: "https://painel.example.com",
      }),
    ).rejects.toThrow("Somente canal ACTIVE pode ser renovado.");
    expect(iniciarWatchMock).not.toHaveBeenCalled();
  });

  it("finaliza stop somente a partir de STOPPING e nunca sobrescreve STOPPED com ERROR", async () => {
    prismaMock.googleCalendarPushChannel.findUnique
      .mockResolvedValueOnce({
        calendarioId: "cal-1",
        status: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: "push-1",
        calendarioId: "cal-1",
        googleChannelId: "channel-1",
        googleResourceId: "resource-1",
        status: "ACTIVE",
      });
    prismaMock.googleCalendarPushChannel.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    encerrarWatchMock.mockResolvedValue(undefined);

    await expect(encerrarCanalPush("push-1")).resolves.toBe(true);

    expect(prismaMock.googleCalendarPushChannel.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "push-1", status: "STOPPING" },
        data: expect.objectContaining({ status: "STOPPED" }),
      }),
    );
    expect(
      prismaMock.googleCalendarPushChannel.updateMany.mock.calls.some(
        ([argumento]) =>
          argumento.data?.status === "ERROR" &&
          argumento.where?.status !== "STOPPING",
      ),
    ).toBe(false);
  });
});
