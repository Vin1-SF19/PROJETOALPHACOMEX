import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  concluirOperacao,
  enfileirarOperacao,
  reagendarOuEnviarDlq,
  recuperarClaimsExpirados,
  reivindicarProximaOperacao,
  renovarClaimOperacao,
  parseQueueAgendaAlphaArgs,
  validarPayloadOperacaoAgendaAlpha,
  type AgendaAlphaSqlExecutor,
  type AgendaAlphaSqlValue,
} from "@/lib/google-calendar/sync-queue";

let client: Client;
let sql: AgendaAlphaSqlExecutor;
let id = 0;

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
  id = 0;
  client = createClient({ url: ":memory:" });
  sql = createExecutor(client);
  await client.execute(`
    CREATE TABLE "GoogleCalendarPendingOperation" (
      "id" TEXT PRIMARY KEY,
      "calendarioId" TEXT NOT NULL,
      "pushChannelId" TEXT,
      "operationType" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "idempotencyKey" TEXT NOT NULL UNIQUE,
      "payloadJson" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "priority" INTEGER NOT NULL DEFAULT 100,
      "attemptCount" INTEGER NOT NULL DEFAULT 0,
      "maxAttempts" INTEGER NOT NULL DEFAULT 8,
      "availableAt" TEXT NOT NULL,
      "claimedBy" TEXT,
      "claimedAt" TEXT,
      "claimExpiresAt" TEXT,
      "claimToken" INTEGER NOT NULL DEFAULT 0,
      "lastErrorCode" TEXT,
      "lastErrorMessage" TEXT,
      "completedAt" TEXT,
      "deadLetteredAt" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);
});

afterEach(() => client.close());

describe("Agenda Alpha persistent queue", () => {
  it("aceita status e replay-dlq com alias legado", () => {
    expect(parseQueueAgendaAlphaArgs(["status"])).toEqual({
      command: "status",
    });
    expect(
      parseQueueAgendaAlphaArgs(["replay-dlq", "--operation", "op-1"]),
    ).toEqual({ command: "replay-dlq", operationId: "op-1" });
    expect(parseQueueAgendaAlphaArgs(["--replay=op-2"])).toEqual({
      command: "replay-dlq",
      operationId: "op-2",
    });
  });

  it.each([
    [],
    ["replay-dlq"],
    ["replay-dlq", "--operation"],
    ["replay-dlq", "--operation", "op-1", "--extra"],
    ["--replay="],
    ["desconhecido"],
  ])("rejeita combinacao CLI invalida: %j", (args) => {
    expect(() => parseQueueAgendaAlphaArgs(args)).toThrow();
  });

  it("recusa qualquer payload arbitrário ou chave sensível", () => {
    expect(validarPayloadOperacaoAgendaAlpha(null)).toBeNull();
    expect(() =>
      validarPayloadOperacaoAgendaAlpha({
        email: "usuario@empresa.com",
        token: "segredo",
        description: "conteúdo privado",
      }),
    ).toThrow("não aceitam payload persistido");
  });

  it("coalesce pendências e cria próxima operação quando a atual está processing", async () => {
    const now = new Date("2026-07-30T20:00:00.000Z");
    const deps = { sql, now: () => now, createId: () => `op-${++id}` };
    const first = await enfileirarOperacao(
      {
        calendarioId: "cal-1",
        operationType: "SYNC_CALENDAR",
        source: "WEBHOOK",
        idempotencyKey: "message-1",
      },
      deps,
    );
    const coalesced = await enfileirarOperacao(
      {
        calendarioId: "cal-1",
        operationType: "SYNC_CALENDAR",
        source: "WEBHOOK",
        idempotencyKey: "message-2",
      },
      deps,
    );
    expect(coalesced.id).toBe(first.id);

    const claim = await reivindicarProximaOperacao(
      { workerId: "worker-a" },
      { sql, now: () => now },
    );
    expect(claim?.claimToken).toBe(1);

    const next = await enfileirarOperacao(
      {
        calendarioId: "cal-1",
        operationType: "SYNC_CALENDAR",
        source: "WEBHOOK",
        idempotencyKey: "message-3",
      },
      deps,
    );
    expect(next.id).not.toBe(first.id);
  });

  it("somente owner+claimToken conclui e retry respeita DLQ", async () => {
    const now = new Date("2026-07-30T20:00:00.000Z");
    await enfileirarOperacao(
      {
        calendarioId: "cal-1",
        operationType: "SYNC_CALENDAR",
        source: "MANUAL",
        idempotencyKey: "manual-1",
        maxAttempts: 1,
      },
      { sql, now: () => now, createId: () => "op-1" },
    );
    const claim = await reivindicarProximaOperacao(
      { workerId: "worker-a" },
      { sql, now: () => now },
    );
    expect(claim).not.toBeNull();
    expect(
      await concluirOperacao(
        { ...claim!, workerId: "worker-stale" },
        { sql, now: () => now },
      ),
    ).toBe(false);
    await expect(
      reagendarOuEnviarDlq(
        claim!,
        { code: "HTTP_403", message: "token=segredo foi negado" },
        { sql, now: () => now, random: () => 0 },
      ),
    ).resolves.toBe("DEAD_LETTER");
  });

  it("heartbeat CAS impede recovery concorrente e rejeita token stale", async () => {
    let now = new Date("2026-07-30T20:00:00.000Z");
    await enfileirarOperacao(
      {
        calendarioId: "cal-1",
        operationType: "SYNC_CALENDAR",
        source: "SCHEDULED",
        idempotencyKey: "long-sync-1",
      },
      { sql, now: () => now, createId: () => "op-long" },
    );
    const claim = await reivindicarProximaOperacao(
      { workerId: "worker-a", claimDurationMs: 5_000 },
      { sql, now: () => now },
    );
    expect(claim).not.toBeNull();

    now = new Date("2026-07-30T20:00:04.000Z");
    expect(
      await renovarClaimOperacao(
        claim!,
        { claimDurationMs: 5_000 },
        { sql, now: () => now },
      ),
    ).toBe(true);

    now = new Date("2026-07-30T20:00:06.000Z");
    expect(await recuperarClaimsExpirados({ sql, now: () => now })).toBe(0);
    expect(
      await renovarClaimOperacao(
        { ...claim!, claimToken: claim!.claimToken + 1 },
        { claimDurationMs: 5_000 },
        { sql, now: () => now },
      ),
    ).toBe(false);
  });

  it("faz takeover atomico do claim expirado e cerca o worker antigo", async () => {
    let now = new Date("2026-07-30T20:00:00.000Z");
    await enfileirarOperacao(
      {
        calendarioId: "cal-1",
        operationType: "SYNC_CALENDAR",
        source: "SCHEDULED",
        idempotencyKey: "takeover-1",
      },
      { sql, now: () => now, createId: () => "op-takeover" },
    );
    const antigo = await reivindicarProximaOperacao(
      { workerId: "worker-antigo", claimDurationMs: 5_000 },
      { sql, now: () => now },
    );
    expect(antigo?.claimToken).toBe(1);

    now = new Date("2026-07-30T20:00:06.000Z");
    const atual = await reivindicarProximaOperacao(
      { workerId: "worker-atual", claimDurationMs: 5_000 },
      { sql, now: () => now },
    );

    expect(atual).toMatchObject({
      workerId: "worker-atual",
      claimToken: 2,
      operacao: {
        id: "op-takeover",
        claimedBy: "worker-atual",
        attemptCount: 2,
      },
    });
    await expect(
      concluirOperacao(antigo!, { sql, now: () => now }),
    ).resolves.toBe(false);
    await expect(
      reagendarOuEnviarDlq(
        antigo!,
        { code: "GOOGLE_UNAVAILABLE", message: "erro antigo" },
        { sql, now: () => now },
      ),
    ).resolves.toBe("STALE_CLAIM");
    await expect(
      concluirOperacao(atual!, { sql, now: () => now }),
    ).resolves.toBe(true);
  });

  it("recovery envia claim expirado sem tentativas restantes para DLQ", async () => {
    let now = new Date("2026-07-30T20:00:00.000Z");
    await enfileirarOperacao(
      {
        calendarioId: "cal-1",
        operationType: "SYNC_CALENDAR",
        source: "SCHEDULED",
        idempotencyKey: "recovery-dlq-1",
        maxAttempts: 1,
      },
      { sql, now: () => now, createId: () => "op-recovery-dlq" },
    );
    await reivindicarProximaOperacao(
      { workerId: "worker-a", claimDurationMs: 5_000 },
      { sql, now: () => now },
    );

    now = new Date("2026-07-30T20:00:06.000Z");
    expect(await recuperarClaimsExpirados({ sql, now: () => now })).toBe(1);
    const rows = await sql.query<{
      status: string;
      claimedBy: string | null;
      lastErrorCode: string | null;
      deadLetteredAt: string | null;
    }>(
      `SELECT "status", "claimedBy", "lastErrorCode", "deadLetteredAt"
       FROM "GoogleCalendarPendingOperation"
       WHERE "id" = ?`,
      ["op-recovery-dlq"],
    );
    expect(rows[0]).toMatchObject({
      status: "DEAD_LETTER",
      claimedBy: null,
      lastErrorCode: "CLAIM_EXPIRED",
    });
    expect(rows[0]?.deadLetteredAt).not.toBeNull();
  });
});
