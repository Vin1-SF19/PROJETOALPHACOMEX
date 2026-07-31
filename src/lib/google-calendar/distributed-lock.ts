import { randomUUID } from "node:crypto";

import {
  prismaAgendaAlphaSqlExecutor,
  type AgendaAlphaSqlExecutor,
} from "@/lib/google-calendar/sync-queue";

interface RawLeaseRow {
  id: string;
  calendarioId: string;
  ownerId: string;
  fencingToken: number;
  leaseExpiresAt: Date | string;
  heartbeatAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface LeaseSincronizacaoAgenda {
  id: string;
  calendarioId: string;
  ownerId: string;
  fencingToken: number;
  leaseExpiresAt: Date;
  heartbeatAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class AgendaAlphaLeaseLostError extends Error {
  constructor() {
    super("Lease de sincronização perdido");
    this.name = "AgendaAlphaLeaseLostError";
  }
}

interface LeaseDependencies {
  sql?: AgendaAlphaSqlExecutor;
  now?: () => Date;
  createId?: () => string;
}

function mapLease(row: RawLeaseRow): LeaseSincronizacaoAgenda {
  return {
    ...row,
    leaseExpiresAt:
      row.leaseExpiresAt instanceof Date
        ? row.leaseExpiresAt
        : new Date(row.leaseExpiresAt),
    heartbeatAt:
      row.heartbeatAt instanceof Date
        ? row.heartbeatAt
        : new Date(row.heartbeatAt),
    createdAt:
      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
  };
}

function assertIdentifier(value: string, field: string): void {
  if (!value.trim() || value.length > 128) throw new Error(`${field} inválido`);
}

export async function adquirirLeaseSincronizacao(
  input: { calendarioId: string; ownerId: string; leaseDurationMs?: number },
  dependencies: LeaseDependencies = {},
): Promise<LeaseSincronizacaoAgenda | null> {
  assertIdentifier(input.calendarioId, "calendarioId");
  assertIdentifier(input.ownerId, "ownerId");
  const leaseDurationMs = input.leaseDurationMs ?? 90_000;
  if (!Number.isInteger(leaseDurationMs) || leaseDurationMs < 10_000) {
    throw new Error("leaseDurationMs inválido");
  }

  const sql = dependencies.sql ?? prismaAgendaAlphaSqlExecutor;
  const now = dependencies.now?.() ?? new Date();
  const expiresAt = new Date(now.getTime() + leaseDurationMs);
  const rows = await sql.query<RawLeaseRow>(
    `
      INSERT INTO "GoogleCalendarSyncLease" (
        "id", "calendarioId", "ownerId", "fencingToken",
        "leaseExpiresAt", "heartbeatAt", "createdAt", "updatedAt"
      )
      VALUES (?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT("calendarioId") DO UPDATE SET
        "ownerId" = excluded."ownerId",
        "fencingToken" = "GoogleCalendarSyncLease"."fencingToken" + 1,
        "leaseExpiresAt" = excluded."leaseExpiresAt",
        "heartbeatAt" = excluded."heartbeatAt",
        "updatedAt" = excluded."updatedAt"
      WHERE "GoogleCalendarSyncLease"."leaseExpiresAt" <= ?
         OR "GoogleCalendarSyncLease"."ownerId" = excluded."ownerId"
      RETURNING *
    `,
    [
      dependencies.createId?.() ?? randomUUID(),
      input.calendarioId,
      input.ownerId,
      expiresAt.toISOString(),
      now.toISOString(),
      now.toISOString(),
      now.toISOString(),
      now.toISOString(),
    ],
  );
  return rows[0] ? mapLease(rows[0]) : null;
}

export async function renovarLeaseSincronizacao(
  lease: Pick<
    LeaseSincronizacaoAgenda,
    "calendarioId" | "ownerId" | "fencingToken"
  >,
  input: { leaseDurationMs?: number } = {},
  dependencies: LeaseDependencies = {},
): Promise<LeaseSincronizacaoAgenda | null> {
  const leaseDurationMs = input.leaseDurationMs ?? 90_000;
  if (!Number.isInteger(leaseDurationMs) || leaseDurationMs < 10_000) {
    throw new Error("leaseDurationMs inválido");
  }
  const sql = dependencies.sql ?? prismaAgendaAlphaSqlExecutor;
  const now = dependencies.now?.() ?? new Date();
  const expiresAt = new Date(now.getTime() + leaseDurationMs);
  const rows = await sql.query<RawLeaseRow>(
    `
      UPDATE "GoogleCalendarSyncLease"
      SET
        "leaseExpiresAt" = ?,
        "heartbeatAt" = ?,
        "updatedAt" = ?
      WHERE "calendarioId" = ?
        AND "ownerId" = ?
        AND "fencingToken" = ?
        AND "leaseExpiresAt" > ?
      RETURNING *
    `,
    [
      expiresAt.toISOString(),
      now.toISOString(),
      now.toISOString(),
      lease.calendarioId,
      lease.ownerId,
      lease.fencingToken,
      now.toISOString(),
    ],
  );
  return rows[0] ? mapLease(rows[0]) : null;
}

export async function verificarLeaseSincronizacao(
  lease: Pick<
    LeaseSincronizacaoAgenda,
    "calendarioId" | "ownerId" | "fencingToken"
  >,
  dependencies: LeaseDependencies = {},
): Promise<boolean> {
  const sql = dependencies.sql ?? prismaAgendaAlphaSqlExecutor;
  const now = dependencies.now?.() ?? new Date();
  const rows = await sql.query<{ owned: number | bigint }>(
    `
      SELECT 1 AS "owned"
      FROM "GoogleCalendarSyncLease"
      WHERE "calendarioId" = ?
        AND "ownerId" = ?
        AND "fencingToken" = ?
        AND "leaseExpiresAt" > ?
      LIMIT 1
    `,
    [
      lease.calendarioId,
      lease.ownerId,
      lease.fencingToken,
      now.toISOString(),
    ],
  );
  return rows.length === 1;
}

export async function exigirLeaseSincronizacao(
  lease: Pick<
    LeaseSincronizacaoAgenda,
    "calendarioId" | "ownerId" | "fencingToken"
  >,
  dependencies: LeaseDependencies = {},
): Promise<void> {
  if (!(await verificarLeaseSincronizacao(lease, dependencies))) {
    throw new AgendaAlphaLeaseLostError();
  }
}

export async function liberarLeaseSincronizacao(
  lease: Pick<
    LeaseSincronizacaoAgenda,
    "calendarioId" | "ownerId" | "fencingToken"
  >,
  dependencies: LeaseDependencies = {},
): Promise<boolean> {
  const sql = dependencies.sql ?? prismaAgendaAlphaSqlExecutor;
  const now = dependencies.now?.() ?? new Date();
  const affected = await sql.execute(
    `
      UPDATE "GoogleCalendarSyncLease"
      SET
        "leaseExpiresAt" = ?,
        "heartbeatAt" = ?,
        "updatedAt" = ?
      WHERE "calendarioId" = ?
        AND "ownerId" = ?
        AND "fencingToken" = ?
    `,
    [
      now.toISOString(),
      now.toISOString(),
      now.toISOString(),
      lease.calendarioId,
      lease.ownerId,
      lease.fencingToken,
    ],
  );
  return affected === 1;
}

