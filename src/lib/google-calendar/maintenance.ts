import { randomUUID } from "node:crypto";

import db from "@/lib/prisma";
import {
  criarCanalPush,
  encerrarCanalPush,
  encerrarCanaisPushAtivos,
  renovarCanaisPushProximosExpiracao,
  type ResultadoLoteCanaisPush,
} from "@/lib/google-calendar/push-channels";
import {
  AgendaAlphaConfigError,
  exigirAgendaAlphaRuntimeConfig,
  type AgendaAlphaRuntimeConfig,
} from "@/lib/google-calendar/runtime-config";
import {
  enfileirarOperacao,
  obterResumoFila,
  recuperarClaimsExpirados,
  type StatusOperacaoAgenda,
} from "@/lib/google-calendar/sync-queue";

export type ModoMaintenanceAgendaAlpha = "dry-run" | "apply";

export interface AcoesMaintenanceAgendaAlpha {
  mode: ModoMaintenanceAgendaAlpha;
  status: boolean;
  renewWatches: boolean;
  reconcileStale: boolean;
  recoverExpired: boolean;
  createCalendarIds: string[];
  stopChannelIds: string[];
  stopAll: boolean;
}

export interface StatusMaintenanceAgendaAlpha {
  queue: Record<StatusOperacaoAgenda, number>;
  channels: {
    active: number;
    creating: number;
    error: number;
    expiringWithin24Hours: number;
  };
  leases: { active: number; expired: number };
}

export interface PlanoMaintenanceAgendaAlpha {
  renewCandidates: number;
  staleCalendars: number;
  expiredClaims: number;
  channelsToCreate: number;
  channelsToStop: number;
}

export interface ResumoMaintenanceAgendaAlpha {
  correlationId: string;
  mode: ModoMaintenanceAgendaAlpha;
  plan: PlanoMaintenanceAgendaAlpha;
  status?: StatusMaintenanceAgendaAlpha;
  renewed?: ResultadoLoteCanaisPush;
  stopped?: ResultadoLoteCanaisPush;
  channelsCreated: number;
  reconciliationsEnqueued: number;
  expiredClaimsRecovered: number;
  operationalFailures: number;
}

export interface EventoMaintenanceAgendaAlpha {
  component: "agenda-alpha-maintenance";
  correlationId: string;
  timestamp: string;
  event: "plan_created" | "action_completed" | "maintenance_finished";
  action?: string;
  value?: number;
}

interface MaintenanceDependencies {
  config?: AgendaAlphaRuntimeConfig;
  now?: () => Date;
  correlationId?: string;
  emit?: (event: EventoMaintenanceAgendaAlpha) => void;
  getStatus?: (now: Date) => Promise<StatusMaintenanceAgendaAlpha>;
  getPlan?: (
    actions: AcoesMaintenanceAgendaAlpha,
    now: Date,
  ) => Promise<PlanoMaintenanceAgendaAlpha>;
  renewWatches?: typeof renovarCanaisPushProximosExpiracao;
  createChannel?: typeof criarCanalPush;
  stopChannel?: typeof encerrarCanalPush;
  stopActiveChannels?: typeof encerrarCanaisPushAtivos;
  reconcileStale?: (now: Date) => Promise<number>;
  recoverExpired?: () => Promise<number>;
}

function readValue(args: readonly string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} exige um identificador`);
  }
  return value;
}

export function parseMaintenanceAgendaAlphaArgs(
  args: readonly string[],
): AcoesMaintenanceAgendaAlpha {
  let status = false;
  let renewWatches = false;
  let reconcileStale = false;
  let recoverExpired = false;
  let createRequested = false;
  let stopRequested = false;
  let stopAll = false;
  let apply = false;
  let dryRun = false;
  const createCalendarIds: string[] = [];
  const stopChannelIds: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "status" || arg === "--status") status = true;
    else if (arg === "renew" || arg === "--renew-watches") renewWatches = true;
    else if (arg === "reconcile" || arg === "--reconcile-stale") {
      reconcileStale = true;
    } else if (arg === "recover" || arg === "--recover-expired") {
      recoverExpired = true;
    } else if (arg === "create" || arg === "--create-watch") {
      createRequested = true;
    } else if (arg === "stop" || arg === "--stop-watches") {
      stopRequested = true;
      if (arg === "--stop-watches") stopAll = true;
    } else if (arg === "--calendar") {
      createCalendarIds.push(readValue(args, index, "--calendar"));
      index += 1;
    } else if (arg.startsWith("--calendar=")) {
      createCalendarIds.push(arg.slice("--calendar=".length));
    } else if (arg === "--channel") {
      stopChannelIds.push(readValue(args, index, "--channel"));
      index += 1;
    } else if (arg.startsWith("--channel=")) {
      stopChannelIds.push(arg.slice("--channel=".length));
    } else if (arg === "--all") {
      if (stopRequested) stopAll = true;
      else {
        status = true;
        renewWatches = true;
        reconcileStale = true;
        recoverExpired = true;
      }
    } else if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") dryRun = true;
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }

  if (apply && dryRun) throw new Error("Escolha apenas --dry-run ou --apply");
  if (createRequested && createCalendarIds.length === 0) {
    throw new Error("create exige ao menos um --calendar <id>");
  }
  if (
    stopRequested &&
    !stopAll &&
    stopChannelIds.length === 0
  ) {
    throw new Error("stop exige --channel <id> ou --all");
  }
  const hasMutation =
    renewWatches ||
    reconcileStale ||
    recoverExpired ||
    createCalendarIds.length > 0 ||
    stopAll ||
    stopChannelIds.length > 0;
  if (hasMutation && !apply && !dryRun) {
    throw new Error("Ações mutáveis exigem --dry-run ou --apply");
  }
  if (
    !status &&
    !hasMutation
  ) {
    throw new Error(
      "Informe status, renew, reconcile, recover, create ou stop",
    );
  }

  return {
    mode: apply ? "apply" : "dry-run",
    status,
    renewWatches,
    reconcileStale,
    recoverExpired,
    createCalendarIds: [...new Set(createCalendarIds.filter(Boolean))],
    stopChannelIds: [...new Set(stopChannelIds.filter(Boolean))],
    stopAll,
  };
}

async function defaultStatus(now: Date): Promise<StatusMaintenanceAgendaAlpha> {
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
  const [
    queue,
    active,
    creating,
    error,
    expiringWithin24Hours,
    activeLeases,
    expiredLeases,
  ] = await Promise.all([
    obterResumoFila(),
    db.googleCalendarPushChannel.count({ where: { status: "ACTIVE" } }),
    db.googleCalendarPushChannel.count({ where: { status: "CREATING" } }),
    db.googleCalendarPushChannel.count({ where: { status: "ERROR" } }),
    db.googleCalendarPushChannel.count({
      where: { status: "ACTIVE", expiresAt: { lte: in24Hours } },
    }),
    db.googleCalendarSyncLease.count({
      where: { leaseExpiresAt: { gt: now } },
    }),
    db.googleCalendarSyncLease.count({
      where: { leaseExpiresAt: { lte: now } },
    }),
  ]);
  return {
    queue,
    channels: { active, creating, error, expiringWithin24Hours },
    leases: { active: activeLeases, expired: expiredLeases },
  };
}

function staleCalendarWhere(staleBefore: Date) {
  return {
    OR: [
      { ultimaSincronizacaoEm: null },
      { ultimaSincronizacaoEm: { lte: staleBefore } },
    ],
    conexao: { status: "ATIVA", user: { status: "ATIVO" } },
  };
}

async function defaultPlan(
  actions: AcoesMaintenanceAgendaAlpha,
  now: Date,
): Promise<PlanoMaintenanceAgendaAlpha> {
  const staleBefore = new Date(now.getTime() - 15 * 60 * 1_000);
  const [renewCandidates, staleCalendars, expiredClaims, stopCandidates] =
    await Promise.all([
      actions.renewWatches
        ? db.googleCalendarPushChannel.count({
            where: { status: "ACTIVE", renewAfter: { lte: now } },
          })
        : 0,
      actions.reconcileStale
        ? db.googleCalendarSelecionado.count({
            where: staleCalendarWhere(staleBefore),
          })
        : 0,
      actions.recoverExpired
        ? db.googleCalendarPendingOperation.count({
            where: {
              status: "PROCESSING",
              claimExpiresAt: { lte: now },
            },
          })
        : 0,
      actions.stopAll
        ? db.googleCalendarPushChannel.count({
            where: { status: { in: ["CREATING", "ACTIVE", "ERROR"] } },
          })
        : actions.stopChannelIds.length,
    ]);
  return {
    renewCandidates,
    staleCalendars,
    expiredClaims,
    channelsToCreate: actions.createCalendarIds.length,
    channelsToStop: stopCandidates,
  };
}

async function defaultReconcileStale(now: Date): Promise<number> {
  const staleBefore = new Date(now.getTime() - 15 * 60 * 1_000);
  const bucket = Math.floor(now.getTime() / (15 * 60 * 1_000));
  const calendars = await db.googleCalendarSelecionado.findMany({
    where: staleCalendarWhere(staleBefore),
    select: { id: true },
    orderBy: { ultimaSincronizacaoEm: "asc" },
    take: 500,
  });
  for (const calendar of calendars) {
    await enfileirarOperacao({
      calendarioId: calendar.id,
      operationType: "RECONCILE_CHANNEL",
      source: "SCHEDULED",
      idempotencyKey: `reconcile:${calendar.id}:${bucket}`,
      priority: 200,
    });
  }
  return calendars.length;
}

function defaultEmit(event: EventoMaintenanceAgendaAlpha): void {
  console.info(JSON.stringify(event));
}

export async function executarMaintenanceAgendaAlpha(
  actions: AcoesMaintenanceAgendaAlpha,
  dependencies: MaintenanceDependencies = {},
): Promise<ResumoMaintenanceAgendaAlpha> {
  const config = dependencies.config ?? exigirAgendaAlphaRuntimeConfig();
  const now = dependencies.now?.() ?? new Date();
  const correlationId = dependencies.correlationId ?? randomUUID();
  const emit = dependencies.emit ?? defaultEmit;
  const log = (
    event: Omit<EventoMaintenanceAgendaAlpha, "component" | "correlationId" | "timestamp">,
  ) =>
    emit({
      component: "agenda-alpha-maintenance",
      correlationId,
      timestamp: now.toISOString(),
      ...event,
    });
  const hasMutation =
    actions.renewWatches ||
    actions.reconcileStale ||
    actions.recoverExpired ||
    actions.createCalendarIds.length > 0 ||
    actions.stopAll ||
    actions.stopChannelIds.length > 0;

  if (
    actions.mode === "apply" &&
    hasMutation &&
    (!config.queueEnabled || !config.distributedLockEnabled)
  ) {
    throw new AgendaAlphaConfigError([
      "maintenance mutável exige fila e lock distribuído habilitados",
    ]);
  }
  const hasPushMutation =
    actions.renewWatches ||
    actions.createCalendarIds.length > 0 ||
    actions.stopAll ||
    actions.stopChannelIds.length > 0;
  if (
    actions.mode === "apply" &&
    hasPushMutation &&
    (!config.pushEnabled || !config.webhookBaseUrl)
  ) {
    throw new AgendaAlphaConfigError([
      "manutenção de canais exige push habilitado e URL HTTPS pública",
    ]);
  }

  const plan = await (dependencies.getPlan ?? defaultPlan)(actions, now);
  log({ event: "plan_created", value: Object.values(plan).reduce((a, b) => a + b, 0) });
  const summary: ResumoMaintenanceAgendaAlpha = {
    correlationId,
    mode: actions.mode,
    plan,
    channelsCreated: 0,
    reconciliationsEnqueued: 0,
    expiredClaimsRecovered: 0,
    operationalFailures: 0,
  };
  if (actions.status) {
    summary.status = await (dependencies.getStatus ?? defaultStatus)(now);
  }
  if (actions.mode === "dry-run") {
    log({ event: "maintenance_finished", action: "dry-run" });
    return summary;
  }

  const webhookBaseUrl = config.webhookBaseUrl!;
  if (actions.recoverExpired) {
    summary.expiredClaimsRecovered = await (
      dependencies.recoverExpired ?? recuperarClaimsExpirados
    )();
    log({ event: "action_completed", action: "recover", value: summary.expiredClaimsRecovered });
  }
  if (actions.reconcileStale) {
    summary.reconciliationsEnqueued = await (
      dependencies.reconcileStale ?? defaultReconcileStale
    )(now);
    log({ event: "action_completed", action: "reconcile", value: summary.reconciliationsEnqueued });
  }
  if (actions.renewWatches) {
    summary.renewed = await (
      dependencies.renewWatches ?? renovarCanaisPushProximosExpiracao
    )({ webhookBaseUrl, agora: now });
    summary.operationalFailures += summary.renewed.falhas;
    log({ event: "action_completed", action: "renew", value: summary.renewed.concluidos });
  }
  for (const calendarioId of actions.createCalendarIds) {
    try {
      await (dependencies.createChannel ?? criarCanalPush)(calendarioId, {
        webhookBaseUrl,
      });
      summary.channelsCreated += 1;
    } catch {
      summary.operationalFailures += 1;
    }
  }
  if (actions.createCalendarIds.length > 0) {
    log({ event: "action_completed", action: "create", value: summary.channelsCreated });
  }
  if (actions.stopAll) {
    summary.stopped = await (
      dependencies.stopActiveChannels ?? encerrarCanaisPushAtivos
    )();
    summary.operationalFailures += summary.stopped.falhas;
  } else if (actions.stopChannelIds.length > 0) {
    let completed = 0;
    let failures = 0;
    for (const channelId of actions.stopChannelIds) {
      try {
        const stopped = await (
          dependencies.stopChannel ?? encerrarCanalPush
        )(channelId, { bestEffort: true });
        if (stopped) completed += 1;
        else failures += 1;
      } catch {
        failures += 1;
      }
    }
    summary.stopped = {
      encontrados: actions.stopChannelIds.length,
      concluidos: completed,
      falhas: failures,
    };
    summary.operationalFailures += failures;
  }
  if (summary.stopped) {
    log({ event: "action_completed", action: "stop", value: summary.stopped.concluidos });
  }
  log({ event: "maintenance_finished", value: summary.operationalFailures });
  return summary;
}
