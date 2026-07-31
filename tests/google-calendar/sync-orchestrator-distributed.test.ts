import { afterEach, describe, expect, it, vi } from "vitest";

import { criarOrquestradorSincronizacao } from "@/lib/google-calendar/sync-orchestrator";

const calendario = {
  id: "cal-1",
  googleCalendarId: "primary",
  syncToken: null,
};
const contadores = {
  eventosRecebidos: 0,
  eventosAtualizados: 0,
  eventosRemovidos: 0,
  paginasProcessadas: 1,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("orquestrador com lock distribuído", () => {
  it("repassa fencing ao sync e libera somente o lease adquirido", async () => {
    const executarSync = vi.fn().mockResolvedValue({
      ok: true,
      contadores,
      sincronizadoEm: new Date(),
    });
    const lease = {
      id: "lease-1",
      calendarioId: "cal-1",
      ownerId: "worker-1",
      fencingToken: 9,
      leaseExpiresAt: new Date(Date.now() + 90_000),
      heartbeatAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const liberarLease = vi.fn().mockResolvedValue(true);
    const orquestrador = criarOrquestradorSincronizacao({
      executarSync,
      distributedLockEnabled: true,
      ownerId: "worker-1",
      adquirirLease: vi.fn().mockResolvedValue(lease),
      liberarLease,
    });

    await expect(
      orquestrador.executar({
        userId: 7,
        calendario,
        emailUsuario: "subject-do-banco@alpha.com",
      }),
    ).resolves.toMatchObject({ status: "sincronizado" });
    expect(executarSync).toHaveBeenCalledWith(
      calendario,
      "subject-do-banco@alpha.com",
      true,
      { fencing: { ownerId: "worker-1", fencingToken: 9 } },
    );
    expect(liberarLease).toHaveBeenCalledWith(lease);
  });

  it("não chama Google quando outro worker detém o lease", async () => {
    const executarSync = vi.fn();
    const orquestrador = criarOrquestradorSincronizacao({
      executarSync,
      distributedLockEnabled: true,
      ownerId: "worker-2",
      adquirirLease: vi.fn().mockResolvedValue(null),
      liberarLease: vi.fn(),
    });

    await expect(
      orquestrador.executar({
        userId: 7,
        calendario,
        emailUsuario: "subject-do-banco@alpha.com",
      }),
    ).resolves.toMatchObject({ status: "em_andamento" });
    expect(executarSync).not.toHaveBeenCalled();
  });
  it("neutraliza rejeição do heartbeat sem unhandled rejection", async () => {
    vi.useFakeTimers();
    let concluirSync!: () => void;
    const executarSync = vi.fn(
      () =>
        new Promise<{
          ok: true;
          contadores: typeof contadores;
          sincronizadoEm: Date;
        }>((resolve) => {
          concluirSync = () =>
            resolve({ ok: true, contadores, sincronizadoEm: new Date() });
        }),
    );
    const lease = {
      id: "lease-1",
      calendarioId: "cal-1",
      ownerId: "worker-1",
      fencingToken: 9,
      leaseExpiresAt: new Date(Date.now() + 90_000),
      heartbeatAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const renovarLease = vi.fn().mockRejectedValue(new Error("redis offline"));
    const liberarLease = vi.fn().mockResolvedValue(true);
    const orquestrador = criarOrquestradorSincronizacao({
      executarSync,
      distributedLockEnabled: true,
      ownerId: "worker-1",
      adquirirLease: vi.fn().mockResolvedValue(lease),
      renovarLease,
      liberarLease,
    });

    const execucao = orquestrador.executar({
      userId: 7,
      calendario,
      emailUsuario: "subject-do-banco@alpha.com",
    });
    await vi.advanceTimersByTimeAsync(30_000);
    concluirSync();

    await expect(execucao).resolves.toMatchObject({ status: "erro" });
    expect(renovarLease).toHaveBeenCalledTimes(1);
    expect(liberarLease).toHaveBeenCalledTimes(1);
  });
});
