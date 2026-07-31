import { describe, expect, it, vi } from "vitest";

import {
  executarWorkerAgendaAlpha,
  parseWorkerAgendaAlphaArgs,
} from "@/lib/google-calendar/worker";
import { GoogleCalendarError } from "@/lib/google-calendar/errors";

const runtime = {
  distributedLockEnabled: true,
  queueEnabled: true,
  pushEnabled: false,
  webhookBaseUrl: null,
  valid: true,
  errors: [],
};

function criarClaimSync() {
  const now = new Date();
  return {
    workerId: "worker-a",
    claimToken: 1,
    operacao: {
      id: "op-long-sync",
      calendarioId: "cal-1",
      pushChannelId: null,
      operationType: "SYNC_CALENDAR" as const,
      source: "SCHEDULED" as const,
      idempotencyKey: "long-sync",
      payloadJson: null,
      status: "PROCESSING" as const,
      priority: 100,
      attemptCount: 1,
      maxAttempts: 8,
      availableAt: now,
      claimedBy: "worker-a",
      claimedAt: now,
      claimExpiresAt: new Date(now.getTime() + 5_000),
      claimToken: 1,
      lastErrorCode: null,
      lastErrorMessage: null,
      completedAt: null,
      deadLetteredAt: null,
      createdAt: now,
      updatedAt: now,
    },
  };
}

describe("Agenda Alpha worker", () => {
  it("exige modo CLI explícito", () => {
    expect(parseWorkerAgendaAlphaArgs(["--once", "--max-jobs=1"])).toEqual({
      mode: "once",
      maxJobs: 1,
    });
    expect(() => parseWorkerAgendaAlphaArgs([])).toThrow();
    expect(() => parseWorkerAgendaAlphaArgs(["--once", "--drain"])).toThrow();
    expect(
      parseWorkerAgendaAlphaArgs([
        "--continuous",
        "--poll-interval-ms=500",
      ]),
    ).toMatchObject({ mode: "continuous", pollIntervalMs: 500 });
  });

  it.each([
    ["--once", "--desconhecido"],
    ["--once", "--max-jobs=0"],
    ["--once", "--max-jobs=1.5"],
    ["--continuous", "--poll-interval-ms=99"],
    ["--continuous", "--poll-interval-ms=60001"],
    ["--once", "--claim-duration-ms=4999"],
    ["--once", "--claim-heartbeat-ms=999"],
  ])("rejeita argumento CLI inválido: %j", (...args) => {
    expect(() => parseWorkerAgendaAlphaArgs(args)).toThrow();
  });

  it("resolve subject no banco e entrega fencing ao sync", async () => {
    const complete = vi.fn().mockResolvedValue(true);
    const executeSync = vi.fn().mockResolvedValue({
      ok: true,
      sincronizadoEm: new Date(),
      contadores: {
        eventosRecebidos: 0,
        eventosAtualizados: 0,
        eventosRemovidos: 0,
        paginasProcessadas: 1,
      },
    });
    const claim = {
      workerId: "worker-a",
      claimToken: 1,
      operacao: {
        id: "op-1",
        calendarioId: "cal-1",
        pushChannelId: null,
        operationType: "SYNC_CALENDAR" as const,
        source: "WEBHOOK" as const,
        idempotencyKey: "message-1",
        payloadJson: null,
        status: "PROCESSING" as const,
        priority: 100,
        attemptCount: 1,
        maxAttempts: 8,
        availableAt: new Date(),
        claimedBy: "worker-a",
        claimedAt: new Date(),
        claimExpiresAt: new Date(),
        claimToken: 1,
        lastErrorCode: null,
        lastErrorMessage: null,
        completedAt: null,
        deadLetteredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    const summary = await executarWorkerAgendaAlpha(
      {
        mode: "once",
        heartbeatIntervalMs: 1_000,
        leaseDurationMs: 10_000,
      },
      {
        config: runtime,
        workerId: "worker-a",
        emit: vi.fn(),
        claimNext: vi.fn().mockResolvedValue(claim),
        findCalendar: vi.fn().mockResolvedValue({
          id: "cal-1",
          googleCalendarId: "primary",
          syncToken: "cursor",
          conexao: {
            status: "ATIVA",
            user: { status: "ATIVO", email: "server@empresa.com" },
          },
        }),
        acquireLease: vi.fn().mockResolvedValue({
          id: "lease-1",
          calendarioId: "cal-1",
          ownerId: "worker-a",
          fencingToken: 7,
          leaseExpiresAt: new Date(Date.now() + 10_000),
          heartbeatAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        renewLease: vi.fn(),
        assertLease: vi.fn(),
        releaseLease: vi.fn().mockResolvedValue(true),
        executeSync,
        complete,
      },
    );

    expect(summary.succeeded).toBe(1);
    expect(executeSync).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cal-1" }),
      "server@empresa.com",
      true,
      { fencing: { ownerId: "worker-a", fencingToken: 7 } },
    );
    expect(complete).toHaveBeenCalledOnce();
  });

  it("continuous faz polling até shutdown gracioso", async () => {
    const controller = new AbortController();
    const claimNext = vi.fn().mockResolvedValue(null);
    const summary = await executarWorkerAgendaAlpha(
      { mode: "continuous", pollIntervalMs: 100 },
      {
        config: runtime,
        signal: controller.signal,
        emit: vi.fn(),
        claimNext,
        sleep: vi.fn().mockImplementation(async () => controller.abort()),
      },
    );
    expect(summary.noWork).toBe(true);
    expect(claimNext).toHaveBeenCalledOnce();
  });

  it("despacha RENEW_CHANNEL sem deixar operação presa", async () => {
    const renewChannel = vi.fn().mockResolvedValue({});
    const complete = vi.fn().mockResolvedValue(true);
    const summary = await executarWorkerAgendaAlpha(
      { mode: "once" },
      {
        config: {
          ...runtime,
          pushEnabled: true,
          webhookBaseUrl: "https://painel.example.com",
        },
        workerId: "worker-a",
        emit: vi.fn(),
        claimNext: vi.fn().mockResolvedValue({
          workerId: "worker-a",
          claimToken: 1,
          operacao: {
            id: "op-renew",
            calendarioId: "cal-1",
            pushChannelId: "channel-1",
            operationType: "RENEW_CHANNEL",
            source: "SCHEDULED",
            idempotencyKey: "renew-1",
            payloadJson: null,
            status: "PROCESSING",
            priority: 100,
            attemptCount: 1,
            maxAttempts: 8,
            availableAt: new Date(),
            claimedBy: "worker-a",
            claimedAt: new Date(),
            claimExpiresAt: new Date(),
            claimToken: 1,
            lastErrorCode: null,
            lastErrorMessage: null,
            completedAt: null,
            deadLetteredAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
        renewChannel,
        complete,
      },
    );
    expect(summary.succeeded).toBe(1);
    expect(renewChannel).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
  });

  it("envia falha permanente Google direto para DLQ e marca canal ERROR", async () => {
    const retryOrDlq = vi.fn().mockResolvedValue("DEAD_LETTER");
    const markChannelError = vi.fn().mockResolvedValue(undefined);
    const summary = await executarWorkerAgendaAlpha(
      { mode: "once", heartbeatIntervalMs: 1_000, leaseDurationMs: 10_000 },
      {
        config: runtime,
        workerId: "worker-a",
        emit: vi.fn(),
        claimNext: vi.fn().mockResolvedValue({
          workerId: "worker-a",
          claimToken: 1,
          operacao: {
            id: "op-sync",
            calendarioId: "cal-1",
            pushChannelId: "channel-1",
            operationType: "SYNC_CALENDAR",
            source: "WEBHOOK",
            idempotencyKey: "sync-1",
            payloadJson: null,
            status: "PROCESSING",
            priority: 100,
            attemptCount: 1,
            maxAttempts: 8,
            availableAt: new Date(),
            claimedBy: "worker-a",
            claimedAt: new Date(),
            claimExpiresAt: new Date(),
            claimToken: 1,
            lastErrorCode: null,
            lastErrorMessage: null,
            completedAt: null,
            deadLetteredAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
        findCalendar: vi.fn().mockResolvedValue({
          id: "cal-1",
          googleCalendarId: "primary",
          syncToken: "cursor",
          conexao: {
            status: "ATIVA",
            user: { status: "ATIVO", email: "server@empresa.com" },
          },
        }),
        acquireLease: vi.fn().mockResolvedValue({
          id: "lease-1",
          calendarioId: "cal-1",
          ownerId: "worker-a",
          fencingToken: 2,
          leaseExpiresAt: new Date(Date.now() + 10_000),
          heartbeatAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        releaseLease: vi.fn().mockResolvedValue(true),
        executeSync: vi.fn().mockResolvedValue({
          ok: false,
          codigo: "GOOGLE_FORBIDDEN",
          permanent: true,
          retryable: false,
          erro: "Mensagem sanitizada",
          contadores: {
            eventosRecebidos: 0,
            eventosAtualizados: 0,
            eventosRemovidos: 0,
            paginasProcessadas: 0,
          },
        }),
        retryOrDlq,
        markChannelError,
      },
    );
    expect(summary.deadLettered).toBe(1);
    expect(retryOrDlq).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        code: "GOOGLE_FORBIDDEN",
        permanent: true,
      }),
    );
    expect(markChannelError).toHaveBeenCalledWith(
      "channel-1",
      "GOOGLE_FORBIDDEN",
    );
  });

  it.each([
    {
      name: "403 permanente",
      error: new GoogleCalendarError("segredo não pode vazar", {
        kind: "forbidden",
        retryable: false,
        status: 403,
      }),
      queueResult: "DEAD_LETTER",
      permanent: true,
      code: "GOOGLE_FORBIDDEN",
    },
    {
      name: "5xx transitório",
      error: new GoogleCalendarError("upstream indisponível", {
        kind: "unavailable",
        retryable: true,
        status: 503,
      }),
      queueResult: "RETRY",
      permanent: false,
      code: "GOOGLE_UNAVAILABLE",
    },
  ])("classifica canal $name", async ({ error, queueResult, permanent, code }) => {
    const retryOrDlq = vi.fn().mockResolvedValue(queueResult);
    const now = new Date();
    const summary = await executarWorkerAgendaAlpha(
      { mode: "once" },
      {
        config: {
          ...runtime,
          pushEnabled: true,
          webhookBaseUrl: "https://painel.example.com",
        },
        workerId: "worker-a",
        emit: vi.fn(),
        claimNext: vi.fn().mockResolvedValue({
          workerId: "worker-a",
          claimToken: 1,
          operacao: {
            id: "op-channel",
            calendarioId: "cal-1",
            pushChannelId: "channel-1",
            operationType: "RENEW_CHANNEL",
            source: "SCHEDULED",
            idempotencyKey: "renew-error",
            payloadJson: null,
            status: "PROCESSING",
            priority: 100,
            attemptCount: 1,
            maxAttempts: 8,
            availableAt: now,
            claimedBy: "worker-a",
            claimedAt: now,
            claimExpiresAt: new Date(now.getTime() + 300_000),
            claimToken: 1,
            lastErrorCode: null,
            lastErrorMessage: null,
            completedAt: null,
            deadLetteredAt: null,
            createdAt: now,
            updatedAt: now,
          },
        }),
        renewChannel: vi.fn().mockRejectedValue(error),
        retryOrDlq,
      },
    );
    expect(retryOrDlq).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ code, permanent }),
    );
    expect(
      queueResult === "DEAD_LETTER"
        ? summary.deadLettered
        : summary.retried,
    ).toBe(1);
  });

  it("renova claim e lease juntos durante sync maior que o TTL inicial", async () => {
    vi.useFakeTimers();
    try {
      let finishSync:
        | ((value: {
            ok: true;
            sincronizadoEm: Date;
            contadores: {
              eventosRecebidos: number;
              eventosAtualizados: number;
              eventosRemovidos: number;
              paginasProcessadas: number;
            };
          }) => void)
        | undefined;
      const executeSync = vi.fn(
        () =>
          new Promise<{
            ok: true;
            sincronizadoEm: Date;
            contadores: {
              eventosRecebidos: number;
              eventosAtualizados: number;
              eventosRemovidos: number;
              paginasProcessadas: number;
            };
          }>((resolve) => {
            finishSync = resolve;
          }),
      );
      const lease = {
        id: "lease-1",
        calendarioId: "cal-1",
        ownerId: "worker-a",
        fencingToken: 2,
        leaseExpiresAt: new Date(Date.now() + 10_000),
        heartbeatAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const renewClaim = vi.fn().mockResolvedValue(true);
      const renewLease = vi.fn().mockResolvedValue(lease);
      const execution = executarWorkerAgendaAlpha(
        {
          mode: "once",
          claimDurationMs: 5_000,
          leaseDurationMs: 10_000,
          heartbeatIntervalMs: 1_000,
          claimHeartbeatIntervalMs: 1_000,
        },
        {
          config: runtime,
          workerId: "worker-a",
          emit: vi.fn(),
          claimNext: vi.fn().mockResolvedValue(criarClaimSync()),
          findCalendar: vi.fn().mockResolvedValue({
            id: "cal-1",
            googleCalendarId: "primary",
            syncToken: "cursor",
            conexao: {
              status: "ATIVA",
              user: { status: "ATIVO", email: "server@empresa.com" },
            },
          }),
          acquireLease: vi.fn().mockResolvedValue(lease),
          renewClaim,
          renewLease,
          assertLease: vi.fn(),
          releaseLease: vi.fn().mockResolvedValue(true),
          complete: vi.fn().mockResolvedValue(true),
          executeSync,
        },
      );
      await vi.advanceTimersByTimeAsync(6_000);
      expect(renewClaim).toHaveBeenCalled();
      expect(renewLease).toHaveBeenCalled();
      finishSync?.({
        ok: true,
        sincronizadoEm: new Date(),
        contadores: {
          eventosRecebidos: 0,
          eventosAtualizados: 0,
          eventosRemovidos: 0,
          paginasProcessadas: 1,
        },
      });
      await expect(execution).resolves.toMatchObject({ succeeded: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});
