import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { patchMock, deleteMock, getMock, calendarMock } = vi.hoisted(() => {
  const patch = vi.fn();
  const remove = vi.fn();
  const get = vi.fn();
  return {
    patchMock: patch,
    deleteMock: remove,
    getMock: get,
    calendarMock: vi.fn(() => ({
      events: { patch, delete: remove, get },
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
  getMock.mockRejectedValue({ response: { status: 404 } });
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
    const resultado = await cancelarEvento({
      emailUsuario: "user@alpha.com",
      calendarId: "primary",
      googleEventId: "evt-1",
      etagConhecido: '"v1"',
    });

    expect(deleteMock).toHaveBeenCalledWith(
      { calendarId: "primary", eventId: "evt-1" },
      { headers: { "If-Match": '"v1"' } },
    );
    expect(getMock).toHaveBeenCalledWith({
      calendarId: "primary",
      eventId: "evt-1",
    });
    expect(resultado).toEqual({
      jaEstavaCancelado: false,
      confirmado: true,
    });
  });

  it("accepts a cancelled event as confirmation after delete", async () => {
    getMock.mockResolvedValue({ data: { status: "cancelled" } });

    await expect(
      cancelarEvento({
        emailUsuario: "user@alpha.com",
        calendarId: "primary",
        googleEventId: "evt-1",
      }),
    ).resolves.toEqual({
      jaEstavaCancelado: false,
      confirmado: true,
    });
  });

  it("treats an already missing event as an idempotent cancellation", async () => {
    deleteMock.mockRejectedValue({ response: { status: 404 } });

    await expect(
      cancelarEvento({
        emailUsuario: "user@alpha.com",
        calendarId: "primary",
        googleEventId: "evt-missing",
      }),
    ).resolves.toEqual({
      jaEstavaCancelado: true,
      confirmado: true,
    });

    expect(getMock).not.toHaveBeenCalled();
  });

  it("does not report success while Google still returns the active event", async () => {
    getMock.mockResolvedValue({ data: { status: "confirmed" } });

    await expect(
      cancelarEvento({
        emailUsuario: "user@alpha.com",
        calendarId: "primary",
        googleEventId: "evt-1",
      }),
    ).rejects.toThrow("não confirmou o cancelamento");

    expect(getMock).toHaveBeenCalledTimes(3);
  });

  it("preserves an ETag conflict returned by Google", async () => {
    deleteMock.mockRejectedValue({ response: { status: 412 } });

    await expect(
      cancelarEvento({
        emailUsuario: "user@alpha.com",
        calendarId: "primary",
        googleEventId: "evt-1",
        etagConhecido: '"outdated"',
      }),
    ).rejects.toMatchObject({ status: 412 });

    expect(getMock).not.toHaveBeenCalled();
  });

  it("does not confirm cancellation when the verification request fails", async () => {
    getMock.mockRejectedValue({ response: { status: 403 } });

    await expect(
      cancelarEvento({
        emailUsuario: "user@alpha.com",
        calendarId: "primary",
        googleEventId: "evt-1",
      }),
    ).rejects.toThrow("Acesso negado");
  });
});
