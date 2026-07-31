import { randomUUID } from "node:crypto";

import db from "@/lib/prisma";

export const TIPOS_OPERACAO_AGENDA = [
  "SYNC_CALENDAR",
  "RENEW_CHANNEL",
  "STOP_CHANNEL",
  "RECONCILE_CHANNEL",
] as const;
export type TipoOperacaoAgenda = (typeof TIPOS_OPERACAO_AGENDA)[number];

export const FONTES_OPERACAO_AGENDA = [
  "WEBHOOK",
  "MANUAL",
  "SCHEDULED",
  "ADMIN",
] as const;
export type FonteOperacaoAgenda = (typeof FONTES_OPERACAO_AGENDA)[number];

export type StatusOperacaoAgenda =
  | "PENDING"
  | "PROCESSING"
  | "RETRY"
  | "SUCCEEDED"
  | "DEAD_LETTER"
  | "CANCELLED";

export type AgendaAlphaSqlValue = string | number | boolean | Date | null;

export interface AgendaAlphaSqlExecutor {
  query<T>(sql: string, values?: readonly AgendaAlphaSqlValue[]): Promise<T[]>;
  execute(
    sql: string,
    values?: readonly AgendaAlphaSqlValue[],
  ): Promise<number>;
}

export interface PrismaUnsafeSqlClient {
  $queryRawUnsafe<T = unknown>(
    sql: string,
    ...values: AgendaAlphaSqlValue[]
  ): Promise<T>;
  $executeRawUnsafe(
    sql: string,
    ...values: AgendaAlphaSqlValue[]
  ): Promise<number>;
}

export function criarAgendaAlphaSqlExecutor(
  client: PrismaUnsafeSqlClient,
): AgendaAlphaSqlExecutor {
  return {
    query<T>(sql: string, values: readonly AgendaAlphaSqlValue[] = []) {
      return client.$queryRawUnsafe<T[]>(sql, ...values);
    },
    execute(sql: string, values: readonly AgendaAlphaSqlValue[] = []) {
      return client.$executeRawUnsafe(sql, ...values);
    },
  };
}

export const prismaAgendaAlphaSqlExecutor =
  criarAgendaAlphaSqlExecutor(db);

interface RawOperationRow {
  id: string;
  calendarioId: string;
  pushChannelId: string | null;
  operationType: TipoOperacaoAgenda;
  source: FonteOperacaoAgenda;
  idempotencyKey: string;
  payloadJson: string | null;
  status: StatusOperacaoAgenda;
  priority: number;
  attemptCount: number;
  maxAttempts: number;
  availableAt: Date | string;
  claimedBy: string | null;
  claimedAt: Date | string | null;
  claimExpiresAt: Date | string | null;
  claimToken: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  completedAt: Date | string | null;
  deadLetteredAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface OperacaoAgendaAlpha
  extends Omit<
    RawOperationRow,
    | "availableAt"
    | "claimedAt"
    | "claimExpiresAt"
    | "completedAt"
    | "deadLetteredAt"
    | "createdAt"
    | "updatedAt"
  > {
  availableAt: Date;
  claimedAt: Date | null;
  claimExpiresAt: Date | null;
  completedAt: Date | null;
  deadLetteredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClaimOperacaoAgenda {
  operacao: OperacaoAgendaAlpha;
  workerId: string;
  claimToken: number;
}

export type ComandoQueueAgendaAlpha =
  | { command: "status" }
  | { command: "recover-expired" }
  | { command: "replay-dlq"; operationId: string };

export function parseQueueAgendaAlphaArgs(
  args: readonly string[],
): ComandoQueueAgendaAlpha {
  if (args.length === 1 && (args[0] === "status" || args[0] === "--status")) {
    return { command: "status" };
  }
  if (
    args.length === 1 &&
    (args[0] === "recover-expired" || args[0] === "--recover-expired")
  ) {
    return { command: "recover-expired" };
  }
  const legacyReplay = args.find((arg) => arg.startsWith("--replay="));
  if (legacyReplay && args.length === 1) {
    const operationId = legacyReplay.slice("--replay=".length);
    if (!operationId) throw new Error("--replay exige operation-id");
    return { command: "replay-dlq", operationId };
  }
  if (args[0] === "replay-dlq") {
    const operationIndex = args.indexOf("--operation");
    const inlineOperation = args.find((arg) =>
      arg.startsWith("--operation="),
    );
    const operationId =
      inlineOperation?.slice("--operation=".length) ??
      (operationIndex >= 0 ? args[operationIndex + 1] : undefined);
    const expectedLength = inlineOperation ? 2 : 3;
    if (!operationId || args.length !== expectedLength) {
      throw new Error(
        "Use replay-dlq --operation <id> para reprocessar uma operação",
      );
    }
    return { command: "replay-dlq", operationId };
  }
  throw new Error(
    "Use status, recover-expired ou replay-dlq --operation <id>",
  );
}

interface QueueDependencies {
  sql?: AgendaAlphaSqlExecutor;
  now?: () => Date;
  createId?: () => string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: Date | string | null): Date | null {
  return value === null ? null : toDate(value);
}

function mapOperation(row: RawOperationRow): OperacaoAgendaAlpha {
  return {
    ...row,
    availableAt: toDate(row.availableAt),
    claimedAt: toNullableDate(row.claimedAt),
    claimExpiresAt: toNullableDate(row.claimExpiresAt),
    completedAt: toNullableDate(row.completedAt),
    deadLetteredAt: toNullableDate(row.deadLetteredAt),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function assertNonEmpty(value: string, name: string, maxLength = 255): void {
  if (!value.trim() || value.length > maxLength) {
    throw new Error(`${name} inválido`);
  }
}

export function validarPayloadOperacaoAgendaAlpha(
  payload: unknown,
): null {
  if (payload === undefined || payload === null) return null;
  throw new Error(
    "As operações atuais da Agenda Alpha não aceitam payload persistido",
  );
}

function sanitizeErrorCode(value: string): string {
  const normalized = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\p{L}\p{N} _.:/-]/gu, "")
    .trim()
    .slice(0, 64);
  return normalized || "OPERATION_FAILED";
}

function safeErrorMessage(code: string): string {
  const normalized = code.toUpperCase();
  if (normalized === "LOCK_BUSY") {
    return "Outro worker mantém o lease deste calendário";
  }
  if (normalized === "FENCING_PERDIDO") {
    return "Lease perdido durante a sincronização";
  }
  if (normalized === "CLAIM_EXPIRED") {
    return "Claim expirado e recuperado automaticamente";
  }
  if (
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized === "UNAUTHENTICATED" ||
    normalized === "PERMISSION_DENIED"
  ) {
    return "Credencial ou permissão rejeitada pelo provedor";
  }
  return "Falha operacional da Agenda Alpha";
}

export async function enfileirarOperacao(
  input: {
    calendarioId: string;
    operationType: TipoOperacaoAgenda;
    source: FonteOperacaoAgenda;
    idempotencyKey: string;
    pushChannelId?: string | null;
    payload?: null;
    priority?: number;
    maxAttempts?: number;
    availableAt?: Date;
  },
  dependencies: QueueDependencies = {},
): Promise<OperacaoAgendaAlpha> {
  assertNonEmpty(input.calendarioId, "calendarioId");
  assertNonEmpty(input.idempotencyKey, "idempotencyKey");
  if (!TIPOS_OPERACAO_AGENDA.includes(input.operationType)) {
    throw new Error("operationType inválido");
  }
  if (!FONTES_OPERACAO_AGENDA.includes(input.source)) {
    throw new Error("source inválida");
  }

  const priority = input.priority ?? 100;
  const maxAttempts = input.maxAttempts ?? 8;
  if (!Number.isInteger(priority) || priority < 0 || priority > 10_000) {
    throw new Error("priority inválida");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 50) {
    throw new Error("maxAttempts inválido");
  }

  const sql = dependencies.sql ?? prismaAgendaAlphaSqlExecutor;
  const now = dependencies.now?.() ?? new Date();
  const availableAt = input.availableAt ?? now;
  const payloadJson = validarPayloadOperacaoAgendaAlpha(input.payload);
  const id = dependencies.createId?.() ?? randomUUID();

  const rows = await sql.query<RawOperationRow>(
    `
      INSERT INTO "GoogleCalendarPendingOperation" (
        "id", "calendarioId", "pushChannelId", "operationType", "source",
        "idempotencyKey", "payloadJson", "status", "priority", "attemptCount",
        "maxAttempts", "availableAt", "claimToken", "createdAt", "updatedAt"
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, 0, ?, ?, 0, ?, ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM "GoogleCalendarPendingOperation"
        WHERE "calendarioId" = ?
          AND "operationType" = ?
          AND "status" IN ('PENDING', 'RETRY')
      )
      ON CONFLICT("idempotencyKey") DO UPDATE SET
        "updatedAt" = excluded."updatedAt"
      RETURNING *
    `,
    [
      id,
      input.calendarioId,
      input.pushChannelId ?? null,
      input.operationType,
      input.source,
      input.idempotencyKey,
      payloadJson,
      priority,
      maxAttempts,
      availableAt.toISOString(),
      now.toISOString(),
      now.toISOString(),
      input.calendarioId,
      input.operationType,
    ],
  );

  if (rows[0]) return mapOperation(rows[0]);

  const coalesced = await sql.query<RawOperationRow>(
    `
      SELECT *
      FROM "GoogleCalendarPendingOperation"
      WHERE "calendarioId" = ?
        AND "operationType" = ?
        AND "status" IN ('PENDING', 'RETRY')
      ORDER BY "priority" ASC, "createdAt" ASC
      LIMIT 1
    `,
    [input.calendarioId, input.operationType],
  );
  if (!coalesced[0]) {
    throw new Error("Falha ao confirmar operação enfileirada");
  }
  return mapOperation(coalesced[0]);
}

export async function reivindicarProximaOperacao(
  input: {
    workerId: string;
    claimDurationMs?: number;
    operationTypes?: readonly TipoOperacaoAgenda[];
  },
  dependencies: QueueDependencies = {},
): Promise<ClaimOperacaoAgenda | null> {
  assertNonEmpty(input.workerId, "workerId", 128);
  const claimDurationMs = input.claimDurationMs ?? 120_000;
  if (!Number.isInteger(claimDurationMs) || claimDurationMs < 5_000) {
    throw new Error("claimDurationMs inválido");
  }

  const operationTypes = input.operationTypes ?? TIPOS_OPERACAO_AGENDA;
  if (
    operationTypes.length === 0 ||
    operationTypes.some((type) => !TIPOS_OPERACAO_AGENDA.includes(type))
  ) {
    throw new Error("operationTypes inválido");
  }

  const sql = dependencies.sql ?? prismaAgendaAlphaSqlExecutor;
  const now = dependencies.now?.() ?? new Date();
  const expiresAt = new Date(now.getTime() + claimDurationMs);
  const placeholders = operationTypes.map(() => "?").join(", ");
  const eligibility = `
    (
      ("status" IN ('PENDING', 'RETRY') AND "availableAt" <= ?)
      OR
      ("status" = 'PROCESSING' AND "claimExpiresAt" <= ?)
    )
    AND "operationType" IN (${placeholders})
  `;
  const values: AgendaAlphaSqlValue[] = [
    input.workerId,
    now.toISOString(),
    expiresAt.toISOString(),
    now.toISOString(),
    now.toISOString(),
    now.toISOString(),
    ...operationTypes,
    now.toISOString(),
    now.toISOString(),
    ...operationTypes,
  ];

  const rows = await sql.query<RawOperationRow>(
    `
      UPDATE "GoogleCalendarPendingOperation"
      SET
        "status" = 'PROCESSING',
        "claimedBy" = ?,
        "claimedAt" = ?,
        "claimExpiresAt" = ?,
        "claimToken" = "claimToken" + 1,
        "attemptCount" = "attemptCount" + 1,
        "updatedAt" = ?
      WHERE "id" = (
        SELECT "id"
        FROM "GoogleCalendarPendingOperation"
        WHERE ${eligibility}
        ORDER BY "priority" ASC, "availableAt" ASC, "createdAt" ASC
        LIMIT 1
      )
      AND ${eligibility}
      RETURNING *
    `,
    values,
  );

  if (!rows[0]) return null;
  const operacao = mapOperation(rows[0]);
  return { operacao, workerId: input.workerId, claimToken: operacao.claimToken };
}

export async function concluirOperacao(
  claim: ClaimOperacaoAgenda,
  dependencies: QueueDependencies = {},
): Promise<boolean> {
  const sql = dependencies.sql ?? prismaAgendaAlphaSqlExecutor;
  const now = dependencies.now?.() ?? new Date();
  const affected = await sql.execute(
    `
      UPDATE "GoogleCalendarPendingOperation"
      SET
        "status" = 'SUCCEEDED',
        "completedAt" = ?,
        "claimedBy" = NULL,
        "claimedAt" = NULL,
        "claimExpiresAt" = NULL,
        "lastErrorCode" = NULL,
        "lastErrorMessage" = NULL,
        "updatedAt" = ?
      WHERE "id" = ?
        AND "status" = 'PROCESSING'
        AND "claimedBy" = ?
        AND "claimToken" = ?
        AND "claimExpiresAt" > ?
    `,
    [
      now.toISOString(),
      now.toISOString(),
      claim.operacao.id,
      claim.workerId,
      claim.claimToken,
      now.toISOString(),
    ],
  );
  return affected === 1;
}

export async function renovarClaimOperacao(
  claim: ClaimOperacaoAgenda,
  input: { claimDurationMs?: number } = {},
  dependencies: QueueDependencies = {},
): Promise<boolean> {
  const claimDurationMs = input.claimDurationMs ?? 120_000;
  if (!Number.isInteger(claimDurationMs) || claimDurationMs < 5_000) {
    throw new Error("claimDurationMs inválido");
  }
  const sql = dependencies.sql ?? prismaAgendaAlphaSqlExecutor;
  const now = dependencies.now?.() ?? new Date();
  const expiresAt = new Date(now.getTime() + claimDurationMs);
  const affected = await sql.execute(
    `
      UPDATE "GoogleCalendarPendingOperation"
      SET
        "claimExpiresAt" = ?,
        "updatedAt" = ?
      WHERE "id" = ?
        AND "status" = 'PROCESSING'
        AND "claimedBy" = ?
        AND "claimToken" = ?
        AND "claimExpiresAt" > ?
    `,
    [
      expiresAt.toISOString(),
      now.toISOString(),
      claim.operacao.id,
      claim.workerId,
      claim.claimToken,
      now.toISOString(),
    ],
  );
  return affected === 1;
}

export function calcularBackoffOperacaoMs(
  attemptCount: number,
  random: () => number = Math.random,
): number {
  const boundedAttempt = Math.max(1, Math.min(attemptCount, 10));
  const base = Math.min(15 * 60_000, 5_000 * 2 ** (boundedAttempt - 1));
  const jitter = Math.floor(Math.max(0, Math.min(random(), 1)) * 1_000);
  return base + jitter;
}

export function erroPermanenteAgendaAlpha(errorCode: string): boolean {
  const normalized = errorCode.trim().toUpperCase();
  return (
    normalized === "400" ||
    normalized === "401" ||
    normalized === "403" ||
    normalized === "HTTP_400" ||
    normalized === "HTTP_401" ||
    normalized === "HTTP_403" ||
    normalized === "INVALID_ARGUMENT" ||
    normalized === "UNAUTHENTICATED" ||
    normalized === "PERMISSION_DENIED"
  );
}

export async function reagendarOuEnviarDlq(
  claim: ClaimOperacaoAgenda,
  failure: { code: string; message: string; permanent?: boolean },
  dependencies: QueueDependencies & { random?: () => number } = {},
): Promise<"RETRY" | "DEAD_LETTER" | "STALE_CLAIM"> {
  const sql = dependencies.sql ?? prismaAgendaAlphaSqlExecutor;
  const now = dependencies.now?.() ?? new Date();
  const isDeadLetter =
    failure.permanent === true ||
    erroPermanenteAgendaAlpha(failure.code) ||
    claim.operacao.attemptCount >= claim.operacao.maxAttempts;
  const status = isDeadLetter ? "DEAD_LETTER" : "RETRY";
  const availableAt = isDeadLetter
    ? now
    : new Date(
        now.getTime() +
          calcularBackoffOperacaoMs(
            claim.operacao.attemptCount,
            dependencies.random,
          ),
      );
  const code = sanitizeErrorCode(failure.code);
  const message = safeErrorMessage(code);

  const affected = await sql.execute(
    `
      UPDATE "GoogleCalendarPendingOperation"
      SET
        "status" = ?,
        "availableAt" = ?,
        "deadLetteredAt" = ?,
        "claimedBy" = NULL,
        "claimedAt" = NULL,
        "claimExpiresAt" = NULL,
        "lastErrorCode" = ?,
        "lastErrorMessage" = ?,
        "updatedAt" = ?
      WHERE "id" = ?
        AND "status" = 'PROCESSING'
        AND "claimedBy" = ?
        AND "claimToken" = ?
        AND "claimExpiresAt" > ?
    `,
    [
      status,
      availableAt.toISOString(),
      isDeadLetter ? now.toISOString() : null,
      code,
      message,
      now.toISOString(),
      claim.operacao.id,
      claim.workerId,
      claim.claimToken,
      now.toISOString(),
    ],
  );
  if (affected !== 1) return "STALE_CLAIM";
  return status;
}

export async function recuperarClaimsExpirados(
  dependencies: QueueDependencies = {},
): Promise<number> {
  const sql = dependencies.sql ?? prismaAgendaAlphaSqlExecutor;
  const now = dependencies.now?.() ?? new Date();
  return sql.execute(
    `
      UPDATE "GoogleCalendarPendingOperation"
      SET
        "status" = CASE
          WHEN "attemptCount" >= "maxAttempts" THEN 'DEAD_LETTER'
          ELSE 'RETRY'
        END,
        "availableAt" = ?,
        "deadLetteredAt" = CASE
          WHEN "attemptCount" >= "maxAttempts" THEN ?
          ELSE NULL
        END,
        "claimedBy" = NULL,
        "claimedAt" = NULL,
        "claimExpiresAt" = NULL,
        "lastErrorCode" = 'CLAIM_EXPIRED',
        "lastErrorMessage" = 'Claim expirado e recuperado automaticamente',
        "updatedAt" = ?
      WHERE "status" = 'PROCESSING'
        AND "claimExpiresAt" <= ?
    `,
    [
      now.toISOString(),
      now.toISOString(),
      now.toISOString(),
      now.toISOString(),
    ],
  );
}

export async function reprocessarOperacaoDlq(
  operationId: string,
  dependencies: QueueDependencies = {},
): Promise<boolean> {
  assertNonEmpty(operationId, "operationId");
  const sql = dependencies.sql ?? prismaAgendaAlphaSqlExecutor;
  const now = dependencies.now?.() ?? new Date();
  const affected = await sql.execute(
    `
      UPDATE "GoogleCalendarPendingOperation"
      SET
        "status" = 'RETRY',
        "availableAt" = ?,
        "attemptCount" = 0,
        "claimedBy" = NULL,
        "claimedAt" = NULL,
        "claimExpiresAt" = NULL,
        "lastErrorCode" = NULL,
        "lastErrorMessage" = NULL,
        "deadLetteredAt" = NULL,
        "updatedAt" = ?
      WHERE "id" = ?
        AND "status" = 'DEAD_LETTER'
    `,
    [now.toISOString(), now.toISOString(), operationId],
  );
  return affected === 1;
}

interface RawStatusCount {
  status: StatusOperacaoAgenda;
  total: number | bigint;
}

export async function obterResumoFila(
  dependencies: QueueDependencies = {},
): Promise<Record<StatusOperacaoAgenda, number>> {
  const sql = dependencies.sql ?? prismaAgendaAlphaSqlExecutor;
  const rows = await sql.query<RawStatusCount>(
    `
      SELECT "status", COUNT(*) AS "total"
      FROM "GoogleCalendarPendingOperation"
      GROUP BY "status"
    `,
  );
  const summary: Record<StatusOperacaoAgenda, number> = {
    PENDING: 0,
    PROCESSING: 0,
    RETRY: 0,
    SUCCEEDED: 0,
    DEAD_LETTER: 0,
    CANCELLED: 0,
  };
  for (const row of rows) summary[row.status] = Number(row.total);
  return summary;
}
