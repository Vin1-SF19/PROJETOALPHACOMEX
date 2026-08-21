import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadAlphaSeoEnvironment,
  runAlphaSeoDoctor,
} from "@/lib/alpha-seo/doctor";
import {
  InMemoryAlphaSeoQueue,
  runAlphaSeoWorkerOnce,
} from "@/lib/alpha-seo/worker";

const SOURCE_ROOT = path.resolve(process.cwd(), "..", "open-seo-main");

describe("Alpha SEO doctor and fixture worker", () => {
  it("loads .env.local after .env with override without mutating process.env", async () => {
    const fixtureRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "alpha-seo-env-"),
    );
    const isolatedEnv: Record<string, string | undefined> = {
      EXISTING_VALUE: "preserved",
    };
    try {
      await fs.writeFile(
        path.join(fixtureRoot, ".env"),
        [
          "ALPHA_SEO_PRECEDENCE=from-env",
          "ALPHA_SEO_ENV_ONLY=from-env",
          "ALPHA_SEO_SECRET=base-secret",
        ].join("\n"),
      );
      await fs.writeFile(
        path.join(fixtureRoot, ".env.local"),
        [
          "ALPHA_SEO_PRECEDENCE=from-env-local",
          "ALPHA_SEO_SECRET=local-secret",
        ].join("\n"),
      );

      const loaded = loadAlphaSeoEnvironment({
        cwd: fixtureRoot,
        processEnv: isolatedEnv,
      });

      expect(loaded).toMatchObject({
        ALPHA_SEO_PRECEDENCE: "from-env-local",
        ALPHA_SEO_ENV_ONLY: "from-env",
        ALPHA_SEO_SECRET: "local-secret",
        EXISTING_VALUE: "preserved",
      });
      expect(process.env.ALPHA_SEO_PRECEDENCE).not.toBe("from-env-local");
    } finally {
      await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("keeps doctor read-only/redacted and passes the 46/46 named source contract", async () => {
    const secrets = {
      TURSO_DATABASE_URL: "libsql://secret-host.invalid",
      TURSO_AUTH_TOKEN: "secret-turso-token",
      DATAFORSEO_API_KEY: "secret-dataforseo",
      OPENROUTER_API_KEY: "secret-openrouter",
      GOOGLE_CLIENT_ID: "secret-google-id",
      GOOGLE_CLIENT_SECRET: "secret-google-secret",
      ALPHA_SEO_GOOGLE_TOKEN_ENCRYPTION_KEY: "secret-encryption",
      ALPHA_SEO_QUEUE_MODE: "fixture-memory",
      ALPHA_SEO_LOCK_MODE: "fixture-memory",
    };
    const result = await runAlphaSeoDoctor({
      sourceRoot: SOURCE_ROOT,
      env: secrets,
      skipNetwork: true,
      timestamp: "2026-08-20T00:00:00.000Z",
    });
    expect(result.code).toBe(0);
    expect(
      result.checks.find((check) => check.id === "contract.mcp-source-parity"),
    ).toMatchObject({
      ok: true,
      details: {
        source: 46,
        ported: 46,
        missing: 0,
        unexpected: 0,
        historicalClaim: 48,
        historicalUnnamedGap: 2,
        historicalGapBlocking: false,
      },
    });
    const serialized = JSON.stringify(result);
    for (const key of [
      "TURSO_DATABASE_URL",
      "TURSO_AUTH_TOKEN",
      "DATAFORSEO_API_KEY",
      "OPENROUTER_API_KEY",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "ALPHA_SEO_GOOGLE_TOKEN_ENCRYPTION_KEY",
    ] as const) {
      expect(serialized).not.toContain(secrets[key]);
    }
    expect(serialized).not.toContain("libsql://secret-host.invalid");
    expect(serialized).not.toContain("secret-host.invalid");
    expect(
      result.checks.find((check) => check.id === "dependency.turso")?.message,
    ).toBe("Read-only network probe explicitly skipped");
  });

  it("returns code 2 offline only for genuinely missing configuration, never for historical MCP metadata", async () => {
    const result = await runAlphaSeoDoctor({
      sourceRoot: SOURCE_ROOT,
      env: {},
      skipNetwork: true,
      timestamp: "2026-08-20T00:00:00.000Z",
    });
    expect(result.code).toBe(2);
    expect(
      result.checks
        .filter((check) => !check.ok)
        .every((check) => check.kind === "config"),
    ).toBe(true);
    expect(
      result.checks.find((check) => check.id === "contract.mcp-source-parity")
        ?.ok,
    ).toBe(true);
  });

  it("processes rank, audit and OAuth cleanup only in memory", async () => {
    const result = await runAlphaSeoWorkerOnce({
      timestamp: "2026-08-20T00:00:00.000Z",
    });
    expect(result).toMatchObject({ ok: true, command: "worker", code: 0 });
    expect(result.jobs?.map((job) => job.type)).toEqual([
      "rank",
      "audit",
      "oauth-cleanup",
    ]);
    expect(result.jobs?.every((job) => job.status === "completed")).toBe(true);
  });

  it("applies bounded retries and idempotent skips", async () => {
    const queue = new InMemoryAlphaSeoQueue([
      {
        id: "retry",
        projectId: "p",
        type: "rank",
        payload: { q: 1 },
        attempts: 0,
        maxAttempts: 2,
        failUntilAttempt: 1,
      },
    ]);
    const first = await queue.processOnce();
    const second = await queue.processOnce();
    const third = await queue.processOnce();
    expect(first[0].status).toBe("retry-scheduled");
    expect(second[0].status).toBe("completed");
    expect(third[0].status).toBe("skipped");
  });
});
