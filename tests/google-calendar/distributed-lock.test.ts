import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  adquirirLeaseSincronizacao,
  exigirLeaseSincronizacao,
  liberarLeaseSincronizacao,
  renovarLeaseSincronizacao,
  verificarLeaseSincronizacao,
} from "@/lib/google-calendar/distributed-lock";
import type {
  AgendaAlphaSqlExecutor,
  AgendaAlphaSqlValue,
} from "@/lib/google-calendar/sync-queue";

let client: Client;
let sql: AgendaAlphaSqlExecutor;

function createExecutor(database: Client): AgendaAlphaSqlExecutor {
  return {
    async query<T>(
      statement: string,
      values: readonly AgendaAlphaSqlValue[] = [],
    ) {
      const result = await database.execute({
        sql: statement,
        args: [...values] as AgendaAlphaSqlValue[],
      });
      return result.rows as T[];
    },
    async execute(
      statement: string,
      values: readonly AgendaAlphaSqlValue[] = [],
    ) {
      const result = await database.execute({
        sql: statement,
        args: [...values] as AgendaAlphaSqlValue[],
      });
      return result.rowsAffected;
    },
  };
}

beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  sql = createExecutor(client);
  await client.execute(`
    CREATE TABLE "GoogleCalendarSyncLease" (
      "id" TEXT PRIMARY KEY,
      "calendarioId" TEXT NOT NULL UNIQUE,
      "ownerId" TEXT NOT NULL,
      "fencingToken" INTEGER NOT NULL DEFAULT 1,
      "leaseExpiresAt" TEXT NOT NULL,
      "heartbeatAt" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);
});

afterEach(() => client.close());

describe("Agenda Alpha distributed lease", () => {
  it("concede um único owner e rejeita concorrente antes da expiração", async () => {
    const now = new Date("2026-07-30T20:00:00.000Z");
    const first = await adquirirLeaseSincronizacao(
      { calendarioId: "cal-1", ownerId: "worker-a" },
      { sql, now: () => now, createId: () => "lease-1" },
    );
    const second = await adquirirLeaseSincronizacao(
      { calendarioId: "cal-1", ownerId: "worker-b" },
      { sql, now: () => now, createId: () => "lease-2" },
    );

    expect(first?.fencingToken).toBe(1);
    expect(second).toBeNull();
  });

  it("incrementa fencing ao retomar e bloqueia heartbeat/release stale", async () => {
    let now = new Date("2026-07-30T20:00:00.000Z");
    const stale = await adquirirLeaseSincronizacao(
      { calendarioId: "cal-1", ownerId: "worker-a", leaseDurationMs: 10_000 },
      { sql, now: () => now, createId: () => "lease-1" },
    );
    expect(stale).not.toBeNull();

    now = new Date("2026-07-30T20:00:11.000Z");
    const current = await adquirirLeaseSincronizacao(
      { calendarioId: "cal-1", ownerId: "worker-b" },
      { sql, now: () => now, createId: () => "lease-2" },
    );

    expect(current?.fencingToken).toBe(2);
    expect(
      await renovarLeaseSincronizacao(stale!, {}, { sql, now: () => now }),
    ).toBeNull();
    expect(
      await liberarLeaseSincronizacao(stale!, { sql, now: () => now }),
    ).toBe(false);
    expect(
      await verificarLeaseSincronizacao(current!, { sql, now: () => now }),
    ).toBe(true);
    await expect(
      exigirLeaseSincronizacao(stale!, { sql, now: () => now }),
    ).rejects.toThrow("Lease de sincronização perdido");
  });
});
