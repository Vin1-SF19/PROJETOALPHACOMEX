import { randomUUID } from "node:crypto";

import db from "@/lib/prisma";
import {
  encerrarCanalPush,
  renovarCanalPush,
} from "@/lib/google-calendar/push-channels";
import {
  AgendaAlphaLeaseLostError,
  adquirirLeaseSincronizacao,
  exigirLeaseSincronizacao,
  liberarLeaseSincronizacao,
  renovarLeaseSincronizacao,
  type LeaseSincronizacaoAgenda,
} from "@/lib/google-calendar/distributed-lock";
import {
  GoogleCalendarError,
  type GoogleCalendarErrorKind,
} from "@/lib/google-calendar/errors";
import {
  AgendaAlphaConfigError,
  exigirAgendaAlphaRuntimeConfig,
  type AgendaAlphaRuntimeConfig,
} from "@/lib/google-calendar/runtime-config";
import {
  concluirOperacao,
  reagendarOuEnviarDlq,
  reivindicarProximaOperacao,
  renovarClaimOperacao,
  type ClaimOperacaoAgenda,
} from "@/lib/google-calendar/sync-queue";
import {
  sincronizarCalendario,
  type ResultadoSincronizacaoCalendario,
} from "@/lib/google-calendar/sync";

interface CalendarioWorker {
  id: string;
  googleCalendarId: string;
  syncToken: string | null;
  conexao: {
    status: string;
    user: {
      email: string;
      status: string;
    };
  };
}

interface FencingWorker {
  ownerId: string;
  fencingToken: number;
}

type ExecutarSyncWorker = (
  calendario: Pick<
    CalendarioWorker,
    "id" | "googleCalendarId" | "syncToken"
  >,
  emailUsuario: string,
  permitirRetryFullSync: boolean,
  opcoes: { fencing: FencingWorker },
) => Promise<ResultadoSincronizacaoCalendario>;

export interface EventoWorkerAgendaAlpha {
  correlationId: string;
  timestamp: string;
  event:
    | "worker_started"
    | "shutdown_requested"
    | "poll_idle"
    | "job_claimed"
    | "lock_contended"
    | "lease_lost"
    | "claim_lost"
    | "job_succeeded"
    | "job_retried"
    | "job_dead_lettered"
    | "job_failed"
    | "worker_finished";
  operationId?: string;
  operationType?: string;
  attemptCount?: number;
  result?: string;
}

export interface ResumoWorkerAgendaAlpha {
  correlationId: string;
  claimed: number;
  succeeded: number;
  retried: number;
  deadLettered: number;
  staleClaims: number;
  lockContentions: number;
  noWork: boolean;
  operationalFailures: number;
}

interface WorkerDependencies {
  config?: AgendaAlphaRuntimeConfig;
  workerId?: string;
  correlationId?: string;
  signal?: AbortSignal;
  now?: () => Date;
  sleep?: (durationMs: number) => Promise<void>;
  emit?: (event: EventoWorkerAgendaAlpha) => void;
  findCalendar?: (calendarioId: string) => Promise<CalendarioWorker | null>;
  claimNext?: typeof reivindicarProximaOperacao;
  complete?: typeof concluirOperacao;
  retryOrDlq?: typeof reagendarOuEnviarDlq;
  acquireLease?: typeof adquirirLeaseSincronizacao;
  renewLease?: typeof renovarLeaseSincronizacao;
  renewClaim?: typeof renovarClaimOperacao;
  assertLease?: typeof exigirLeaseSincronizacao;
  releaseLease?: typeof liberarLeaseSincronizacao;
  executeSync?: ExecutarSyncWorker;
  renewChannel?: typeof renovarCanalPush;
  stopChannel?: typeof encerrarCanalPush;
  markChannelError?: (channelId: string, code: string) => Promise<void>;
}

export interface OpcoesWorkerAgendaAlpha {
  mode: "once" | "drain" | "continuous";
  maxJobs?: number;
  pollIntervalMs?: number;
  idleWaitMs?: number;
  claimDurationMs?: number;
  claimHeartbeatIntervalMs?: number;
  leaseDurationMs?: number;
  heartbeatIntervalMs?: number;
}

export function parseWorkerAgendaAlphaArgs(
  args: readonly string[],
): OpcoesWorkerAgendaAlpha {
  const hasOnce = args.includes("--once");
  const hasDrain = args.includes("--drain");
  const hasContinuous = args.includes("--continuous");
  if ([hasOnce, hasDrain, hasContinuous].filter(Boolean).length !== 1) {
    throw new Error(
      "Informe exatamente um modo: --once, --drain ou --continuous",
    );
  }

  let maxJobs: number | undefined;
  let pollIntervalMs: number | undefined;
  let claimDurationMs: number | undefined;
  let claimHeartbeatIntervalMs: number | undefined;
  for (const arg of args) {
    if (arg.startsWith("--max-jobs=")) {
      maxJobs = Number(arg.slice("--max-jobs=".length));
      continue;
    }
    if (arg.startsWith("--poll-interval-ms=")) {
      pollIntervalMs = Number(arg.slice("--poll-interval-ms=".length));
      continue;
    }
    if (arg.startsWith("--claim-duration-ms=")) {
      claimDurationMs = Number(arg.slice("--claim-duration-ms=".length));
      continue;
    }
    if (arg.startsWith("--claim-heartbeat-ms=")) {
      claimHeartbeatIntervalMs = Number(
        arg.slice("--claim-heartbeat-ms=".length),
      );
      continue;
    }
    if (arg !== "--once" && arg !== "--drain" && arg !== "--continuous") {
      throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }
  if (
    maxJobs !== undefined &&
    (!Number.isInteger(maxJobs) || maxJobs < 1 || maxJobs > 10_000)
  ) {
    throw new Error("--max-jobs deve ser um inteiro entre 1 e 10000");
  }
  if (
    pollIntervalMs !== undefined &&
    (!Number.isInteger(pollIntervalMs) ||
      pollIntervalMs < 100 ||
      pollIntervalMs > 60_000)
  ) {
    throw new Error(
      "--poll-interval-ms deve ser um inteiro entre 100 e 60000",
    );
  }
  if (
    claimDurationMs !== undefined &&
    (!Number.isInteger(claimDurationMs) || claimDurationMs < 5_000)
  ) {
    throw new Error("--claim-duration-ms deve ser inteiro e ao menos 5000");
  }
  if (
    claimHeartbeatIntervalMs !== undefined &&
    (!Number.isInteger(claimHeartbeatIntervalMs) ||
      claimHeartbeatIntervalMs < 1_000)
  ) {
    throw new Error("--claim-heartbeat-ms deve ser inteiro e ao menos 1000");
  }
  return {
    mode: hasOnce ? "once" : hasDrain ? "drain" : "continuous",
    maxJobs,
    pollIntervalMs,
    claimDurationMs,
    claimHeartbeatIntervalMs,
  };
}

function createEmptySummary(correlationId: string): ResumoWorkerAgendaAlpha {
  return {
    correlationId,
    claimed: 0,
    succeeded: 0,
    retried: 0,
    deadLettered: 0,
    staleClaims: 0,
    lockContentions: 0,
    noWork: false,
    operationalFailures: 0,
  };
}

function defaultEmit(event: EventoWorkerAgendaAlpha): void {
  console.info(JSON.stringify({ component: "agenda-alpha-worker", ...event }));
}

async function defaultFindCalendar(
  calendarioId: string,
): Promise<CalendarioWorker | null> {
  return db.googleCalendarSelecionado.findUnique({
    where: { id: calendarioId },
    select: {
      id: true,
      googleCalendarId: true,
      syncToken: true,
      conexao: {
        select: {
          status: true,
          user: { select: { email: true, status: true } },
        },
      },
    },
  });
}

const defaultExecuteSync: ExecutarSyncWorker = (
  calendario,
  emailUsuario,
  permitirRetryFullSync,
  opcoes,
) =>
  sincronizarCalendario(
    calendario,
    emailUsuario,
    permitirRetryFullSync,
    opcoes,
  );

function normalizeFailure(error: unknown): {
  code: string;
  message: string;
  permanent?: boolean;
} {
  if (error instanceof AgendaAlphaLeaseLostError) {
    return {
      code: "FENCING_PERDIDO",
      message: "Lease perdido durante a sincronização",
    };
  }
  if (error instanceof GoogleCalendarError) {
    const codes: Record<GoogleCalendarErrorKind, string> = {
      auth_expired: "GOOGLE_AUTH_EXPIRED",
      forbidden: "GOOGLE_FORBIDDEN",
      not_found: "GOOGLE_NOT_FOUND",
      gone: "GOOGLE_GONE",
      rate_limited: "GOOGLE_RATE_LIMITED",
      invalid_request: "GOOGLE_INVALID_REQUEST",
      unavailable: "GOOGLE_UNAVAILABLE",
      unknown: "GOOGLE_UNKNOWN",
    };
    return {
      code: codes[error.kind],
      message: "Falha normalizada do provedor de calendário",
      permanent:
        !error.retryable &&
        ["auth_expired", "forbidden", "not_found", "invalid_request"].includes(
          error.kind,
        ),
    };
  }
  if (error instanceof Error) {
    return {
      code: "WORKER_ERROR",
      message: "Falha operacional interna do worker",
    };
  }
  return {
    code: "WORKER_ERROR",
    message: "Falha operacional inesperada",
  };
}

const CODIGOS_PERMANENTES_SYNC = new Set([
  "GOOGLE_AUTH_EXPIRED",
  "GOOGLE_FORBIDDEN",
  "GOOGLE_NOT_FOUND",
  "GOOGLE_INVALID_REQUEST",
  "HTTP_400",
  "HTTP_401",
  "HTTP_403",
  "AUTH_EXPIRED",
  "FORBIDDEN",
  "INVALID_REQUEST",
]);

async function defaultMarkChannelError(
  channelId: string,
  code: string,
): Promise<void> {
  await db.googleCalendarPushChannel.updateMany({
    where: { id: channelId },
    data: {
      status: "ERROR",
      lastErrorCode: CODIGOS_PERMANENTES_SYNC.has(code)
        ? code
        : "SYNC_PERMANENT_FAILURE",
      lastErrorAt: new Date(),
    },
  });
}

async function processClaim(
  claim: ClaimOperacaoAgenda,
  options: {
    leaseDurationMs: number;
    heartbeatIntervalMs: number;
    claimDurationMs: number;
    claimHeartbeatIntervalMs: number;
    webhookBaseUrl: string | null;
  },
  dependencies: Omit<
    Required<
      Pick<
        WorkerDependencies,
        | "now"
        | "emit"
        | "findCalendar"
        | "complete"
        | "retryOrDlq"
        | "acquireLease"
        | "renewLease"
        | "renewClaim"
        | "assertLease"
        | "releaseLease"
        | "executeSync"
        | "renewChannel"
        | "stopChannel"
        | "markChannelError"
      >
    >,
    "emit"
  > & {
    emit: (
      event: Omit<EventoWorkerAgendaAlpha, "correlationId" | "timestamp">,
    ) => void;
  },
): Promise<"SUCCEEDED" | "RETRY" | "DEAD_LETTER" | "STALE_CLAIM" | "LOCK_BUSY"> {
  const { operacao } = claim;
  if (
    operacao.operationType === "RENEW_CHANNEL" ||
    operacao.operationType === "STOP_CHANNEL"
  ) {
    if (!operacao.pushChannelId) {
      return dependencies.retryOrDlq(claim, {
        code: "CHANNEL_ID_MISSING",
        message: "Operação de canal sem identificador persistido",
        permanent: true,
      });
    }
    let claimLost = false;
    let claimHeartbeatRunning = false;
    const claimHeartbeat = setInterval(() => {
      if (claimHeartbeatRunning || claimLost) return;
      claimHeartbeatRunning = true;
      void dependencies
        .renewClaim(claim, { claimDurationMs: options.claimDurationMs })
        .then((renewed) => {
          if (!renewed) {
            claimLost = true;
            dependencies.emit({
              event: "claim_lost",
              operationId: operacao.id,
              operationType: operacao.operationType,
            });
          }
        })
        .catch(() => {
          claimLost = true;
        })
        .finally(() => {
          claimHeartbeatRunning = false;
        });
    }, options.claimHeartbeatIntervalMs);
    claimHeartbeat.unref();
    try {
      if (operacao.operationType === "RENEW_CHANNEL") {
        if (!options.webhookBaseUrl) {
          return dependencies.retryOrDlq(claim, {
            code: "PUSH_DISABLED",
            message: "Push não está configurado para renovação",
            permanent: true,
          });
        }
        await dependencies.renewChannel(operacao.pushChannelId, {
          webhookBaseUrl: options.webhookBaseUrl,
        });
      } else {
        await dependencies.stopChannel(operacao.pushChannelId, {
          bestEffort: false,
        });
      }
      if (claimLost) return "STALE_CLAIM";
      const completed = await dependencies.complete(claim);
      return completed ? "SUCCEEDED" : "STALE_CLAIM";
    } catch (error) {
      if (claimLost) return "STALE_CLAIM";
      return dependencies.retryOrDlq(claim, normalizeFailure(error));
    } finally {
      clearInterval(claimHeartbeat);
    }
  }

  const calendar = await dependencies.findCalendar(operacao.calendarioId);
  if (
    !calendar ||
    calendar.conexao.status !== "ATIVA" ||
    calendar.conexao.user.status !== "ATIVO" ||
    !calendar.conexao.user.email.trim()
  ) {
    return dependencies.retryOrDlq(claim, {
      code: "CALENDAR_NOT_ACTIVE",
      message: "Calendário, conexão ou usuário não está ativo",
      permanent: true,
    });
  }

  const lease = await dependencies.acquireLease({
    calendarioId: operacao.calendarioId,
    ownerId: claim.workerId,
    leaseDurationMs: options.leaseDurationMs,
  });
  if (!lease) {
    dependencies.emit({
      event: "lock_contended",
      operationId: operacao.id,
      operationType: operacao.operationType,
      attemptCount: operacao.attemptCount,
    });
    await dependencies.retryOrDlq(claim, {
      code: "LOCK_BUSY",
      message: "Outro worker mantém o lease deste calendário",
    });
    return "LOCK_BUSY";
  }

  let currentLease: LeaseSincronizacaoAgenda = lease;
  let processingOwnershipLost = false;
  let heartbeatRunning = false;
  const heartbeat = setInterval(() => {
    if (heartbeatRunning || processingOwnershipLost) return;
    heartbeatRunning = true;
    void Promise.all([
      dependencies.renewClaim(claim, {
        claimDurationMs: options.claimDurationMs,
      }),
      dependencies.renewLease(currentLease, {
        leaseDurationMs: options.leaseDurationMs,
      }),
    ])
      .then(([claimRenewed, leaseRenewed]) => {
        if (!claimRenewed || !leaseRenewed) {
          processingOwnershipLost = true;
          dependencies.emit({
            event: claimRenewed ? "lease_lost" : "claim_lost",
            operationId: operacao.id,
            operationType: operacao.operationType,
          });
          return;
        }
        currentLease = leaseRenewed;
      })
      .catch(() => {
        processingOwnershipLost = true;
        dependencies.emit({
          event: "lease_lost",
          operationId: operacao.id,
          operationType: operacao.operationType,
        });
      })
      .finally(() => {
        heartbeatRunning = false;
      });
  }, Math.min(options.heartbeatIntervalMs, options.claimHeartbeatIntervalMs));
  heartbeat.unref();

  try {
    const result = await dependencies.executeSync(
      {
        id: calendar.id,
        googleCalendarId: calendar.googleCalendarId,
        syncToken: calendar.syncToken,
      },
      calendar.conexao.user.email,
      true,
      {
        fencing: {
          ownerId: currentLease.ownerId,
          fencingToken: currentLease.fencingToken,
        },
      },
    );
    if (processingOwnershipLost) return "STALE_CLAIM";

    if (!result.ok) {
      const failureCode =
        "codigo" in result && typeof result.codigo === "string"
          ? result.codigo
          : "SYNC_FAILED";
      const typedPermanent =
        "permanent" in result && result.permanent === true;
      const permanent =
        typedPermanent || CODIGOS_PERMANENTES_SYNC.has(failureCode);
      if (permanent && operacao.pushChannelId) {
        await dependencies
          .markChannelError(operacao.pushChannelId, failureCode)
          .catch(() => undefined);
      }
      return dependencies.retryOrDlq(claim, {
        code: failureCode,
        message: result.erro,
        permanent,
      });
    }

    await dependencies.assertLease(currentLease);
    const completed = await dependencies.complete(claim);
    return completed ? "SUCCEEDED" : "STALE_CLAIM";
  } catch (error) {
    if (processingOwnershipLost) return "STALE_CLAIM";
    return dependencies.retryOrDlq(claim, normalizeFailure(error));
  } finally {
    clearInterval(heartbeat);
    await dependencies.releaseLease(currentLease).catch(() => false);
  }
}

export async function executarWorkerAgendaAlpha(
  options: OpcoesWorkerAgendaAlpha,
  dependencies: WorkerDependencies = {},
): Promise<ResumoWorkerAgendaAlpha> {
  const config = dependencies.config ?? exigirAgendaAlphaRuntimeConfig();
  if (!config.queueEnabled || !config.distributedLockEnabled) {
    throw new AgendaAlphaConfigError([
      "worker exige fila e lock distribuído habilitados",
    ]);
  }

  const maxJobs =
    options.maxJobs ??
    (options.mode === "once"
      ? 1
      : options.mode === "drain"
        ? 10_000
        : Number.MAX_SAFE_INTEGER);
  if (!Number.isSafeInteger(maxJobs) || maxJobs < 1) {
    throw new Error("maxJobs inválido");
  }
  const idleWaitMs = options.idleWaitMs ?? 250;
  const pollIntervalMs = options.pollIntervalMs ?? 5_000;
  if (
    !Number.isInteger(pollIntervalMs) ||
    pollIntervalMs < 100 ||
    pollIntervalMs > 60_000
  ) {
    throw new Error("pollIntervalMs inválido");
  }
  const claimDurationMs = options.claimDurationMs ?? 300_000;
  const leaseDurationMs = options.leaseDurationMs ?? 90_000;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30_000;
  const claimHeartbeatIntervalMs =
    options.claimHeartbeatIntervalMs ?? heartbeatIntervalMs;
  if (
    heartbeatIntervalMs < 1_000 ||
    heartbeatIntervalMs >= leaseDurationMs / 2 ||
    claimHeartbeatIntervalMs < 1_000 ||
    claimHeartbeatIntervalMs >= claimDurationMs / 2
  ) {
    throw new Error(
      "heartbeats devem ser menores que metade de seus respectivos TTLs",
    );
  }

  const workerId = dependencies.workerId ?? `agenda-alpha:${process.pid}:${randomUUID()}`;
  const now = dependencies.now ?? (() => new Date());
  const sleep =
    dependencies.sleep ??
    ((durationMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, durationMs)));
  const correlationId = dependencies.correlationId ?? randomUUID();
  const rawEmit = dependencies.emit ?? defaultEmit;
  const emit = (
    event: Omit<EventoWorkerAgendaAlpha, "correlationId" | "timestamp">,
  ) =>
    rawEmit({
      ...event,
      correlationId,
      timestamp: now().toISOString(),
    });
  const summary = createEmptySummary(correlationId);
  const workerDependencies = {
    now,
    emit,
    findCalendar: dependencies.findCalendar ?? defaultFindCalendar,
    complete: dependencies.complete ?? concluirOperacao,
    retryOrDlq: dependencies.retryOrDlq ?? reagendarOuEnviarDlq,
    acquireLease: dependencies.acquireLease ?? adquirirLeaseSincronizacao,
    renewLease: dependencies.renewLease ?? renovarLeaseSincronizacao,
    renewClaim: dependencies.renewClaim ?? renovarClaimOperacao,
    assertLease: dependencies.assertLease ?? exigirLeaseSincronizacao,
    releaseLease: dependencies.releaseLease ?? liberarLeaseSincronizacao,
    executeSync: dependencies.executeSync ?? defaultExecuteSync,
    renewChannel: dependencies.renewChannel ?? renovarCanalPush,
    stopChannel: dependencies.stopChannel ?? encerrarCanalPush,
    markChannelError: dependencies.markChannelError ?? defaultMarkChannelError,
  };
  const claimNext = dependencies.claimNext ?? reivindicarProximaOperacao;

  emit({ event: "worker_started" });
  while (summary.claimed < maxJobs) {
    if (dependencies.signal?.aborted) {
      emit({ event: "shutdown_requested" });
      break;
    }
    const claim = await claimNext({
      workerId,
      claimDurationMs,
    });
    if (!claim) {
      summary.noWork = summary.claimed === 0;
      if (options.mode !== "continuous") break;
      emit({ event: "poll_idle" });
      await sleep(pollIntervalMs);
      continue;
    }
    summary.claimed += 1;
    summary.noWork = false;
    emit({
      event: "job_claimed",
      operationId: claim.operacao.id,
      operationType: claim.operacao.operationType,
      attemptCount: claim.operacao.attemptCount,
    });

    const result = await processClaim(
      claim,
      {
        leaseDurationMs,
        heartbeatIntervalMs,
        claimDurationMs,
        claimHeartbeatIntervalMs,
        webhookBaseUrl: config.pushEnabled ? config.webhookBaseUrl : null,
      },
      workerDependencies,
    );
    if (result === "SUCCEEDED") {
      summary.succeeded += 1;
      emit({ event: "job_succeeded", operationId: claim.operacao.id });
    } else if (result === "DEAD_LETTER") {
      summary.deadLettered += 1;
      summary.operationalFailures += 1;
      emit({ event: "job_dead_lettered", operationId: claim.operacao.id });
    } else if (result === "STALE_CLAIM") {
      summary.staleClaims += 1;
      summary.operationalFailures += 1;
      emit({ event: "job_failed", operationId: claim.operacao.id, result });
    } else {
      summary.retried += 1;
      if (result === "LOCK_BUSY") summary.lockContentions += 1;
      emit({ event: "job_retried", operationId: claim.operacao.id, result });
    }

    if (options.mode === "once") break;
    if (idleWaitMs > 0 && options.mode !== "continuous") {
      await sleep(idleWaitMs);
    }
  }
  emit({ event: "worker_finished", result: JSON.stringify(summary) });
  return summary;
}
