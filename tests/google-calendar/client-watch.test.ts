import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { watchMock, stopMock, calendarMock } = vi.hoisted(() => {
  const watch = vi.fn();
  const stop = vi.fn();
  return {
    watchMock: watch,
    stopMock: stop,
    calendarMock: vi.fn(() => ({
      events: { watch },
      channels: { stop },
    })),
  };
});

vi.mock("googleapis", () => ({
  calendar_v3: {},
  google: {
    auth: { JWT: class JWT {} },
    calendar: calendarMock,
  },
}));

import {
  encerrarWatchEventos,
  iniciarWatchEventos,
} from "@/lib/google-calendar/client";

beforeAll(() => {
  process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL = "service@project.test";
  process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY = "fake-key";
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("wrappers de watch do Google Calendar", () => {
  it("cria events.watch com token e callback HTTPS", async () => {
    const expiration = Date.now() + 60_000;
    watchMock.mockResolvedValue({
      data: {
        id: "channel-1",
        resourceId: "resource-1",
        resourceUri: "https://google.example/resource",
        expiration: String(expiration),
      },
    });

    await expect(
      iniciarWatchEventos({
        emailUsuario: "subject-do-banco@alpha.com",
        calendarId: "primary",
        channelId: "channel-1",
        channelToken: "token-secreto",
        webhookUrl: "https://painel.example.com/api/calendario-alpha/webhook",
        expirationMs: expiration,
      }),
    ).resolves.toMatchObject({
      googleChannelId: "channel-1",
      googleResourceId: "resource-1",
    });
    expect(watchMock).toHaveBeenCalledWith({
      calendarId: "primary",
      requestBody: {
        id: "channel-1",
        type: "web_hook",
        address: "https://painel.example.com/api/calendario-alpha/webhook",
        token: "token-secreto",
        expiration: String(expiration),
      },
    });
  });

  it("encerra channels.stop com o par opaco retornado pelo Google", async () => {
    stopMock.mockResolvedValue({ data: {} });
    await encerrarWatchEventos({
      emailUsuario: "subject-do-banco@alpha.com",
      channelId: "channel-1",
      resourceId: "resource-1",
    });
    expect(stopMock).toHaveBeenCalledWith({
      requestBody: { id: "channel-1", resourceId: "resource-1" },
    });
  });
});
