import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { patchMock, deleteMock, calendarMock } = vi.hoisted(() => {
  const patch = vi.fn();
  const remove = vi.fn();
  return {
    patchMock: patch,
    deleteMock: remove,
    calendarMock: vi.fn(() => ({
      events: { patch, delete: remove },
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

import { atualizarEventoParcial, cancelarEvento } from "@/lib/google-calendar/client";

beforeAll(() => {
  process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL = "service@project.test";
  process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY = "fake-key";
});

beforeEach(() => {
  vi.clearAllMocks();
  patchMock.mockResolvedValue({
    data: { id: "evt-1", etag: '"v2"', summary: "Updated" },
  });
  deleteMock.mockResolvedValue({ data: {} });
});

describe("Google Calendar optimistic concurrency headers", () => {
  it("sends If-Match on events.patch", async () => {
    await atualizarEventoParcial({
      emailUsuario: "user@alpha.com",
      calendarId: "primary",
      googleEventId: "evt-1",
      etagConhecido: '"v1"',
      evento: { titulo: "Updated" },
    });

    expect(patchMock).toHaveBeenCalledWith(
      expect.objectContaining({ calendarId: "primary", eventId: "evt-1" }),
      { headers: { "If-Match": '"v1"' } },
    );
  });

  it("sends If-Match on events.delete", async () => {
    await cancelarEvento({
      emailUsuario: "user@alpha.com",
      calendarId: "primary",
      googleEventId: "evt-1",
      etagConhecido: '"v1"',
    });

    expect(deleteMock).toHaveBeenCalledWith(
      { calendarId: "primary", eventId: "evt-1" },
      { headers: { "If-Match": '"v1"' } },
    );
  });
});
