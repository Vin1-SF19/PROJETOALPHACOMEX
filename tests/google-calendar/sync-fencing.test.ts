import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const tx = {
    googleCalendarEventoCache: { createMany: vi.fn(), deleteMany: vi.fn() },
    googleCalendarSelecionado: { update: vi.fn() },
    googleCalendarSyncLease: { findUnique: vi.fn() },
  };
  return {
    ...tx,
    $transaction: vi.fn(
      (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };
});
const listarEventosPaginaMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/google-calendar/client", () => ({
  listarEventosPagina: listarEventosPaginaMock,
}));

import { sincronizarCalendario } from "@/lib/google-calendar/sync";

const calendario = {
  id: "cal-1",
  googleCalendarId: "primary",
  syncToken: "token-anterior",
};

describe("fencing no commit final da sincronização", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarEventosPaginaMock.mockResolvedValue({
      eventos: [],
      proximoPageToken: null,
      proximoSyncToken: "token-novo",
    });
  });

  it("impede cache/cursor quando owner ou token ficaram obsoletos", async () => {
    prismaMock.googleCalendarSyncLease.findUnique.mockResolvedValue({
      ownerId: "worker-novo",
      fencingToken: 4,
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });

    const resultado = await sincronizarCalendario(
      calendario,
      "subject-do-banco@alpha.com",
      true,
      { fencing: { ownerId: "worker-antigo", fencingToken: 3 } },
    );

    expect(resultado).toMatchObject({
      ok: false,
      codigo: "FENCING_PERDIDO",
    });
    expect(prismaMock.googleCalendarEventoCache.createMany).not.toHaveBeenCalled();
    expect(prismaMock.googleCalendarSelecionado.update).not.toHaveBeenCalled();
  });

  it("verifica lease duas vezes dentro da transação antes do cursor", async () => {
    prismaMock.googleCalendarSyncLease.findUnique.mockResolvedValue({
      ownerId: "worker-1",
      fencingToken: 3,
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });

    const resultado = await sincronizarCalendario(
      calendario,
      "subject-do-banco@alpha.com",
      true,
      { fencing: { ownerId: "worker-1", fencingToken: 3 } },
    );

    expect(resultado).toMatchObject({ ok: true });
    expect(prismaMock.googleCalendarSyncLease.findUnique).toHaveBeenCalledTimes(2);
    expect(
      prismaMock.googleCalendarSyncLease.findUnique.mock.invocationCallOrder[0],
    ).toBeLessThan(
      prismaMock.googleCalendarSelecionado.update.mock.invocationCallOrder[0],
    );
  });
});
