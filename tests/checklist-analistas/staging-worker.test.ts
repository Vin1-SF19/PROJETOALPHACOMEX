import { afterAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, chmod, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadStagingConfig, main, runStagingWorker, STAGING_DATABASE_SHA256, STAGING_ORIGIN, WORKER_PATH } from "../../scripts/checklist-analistas/staging-worker.mjs";

const env = { CHECKLIST_TARGET_ENVIRONMENT: "staging", CHECKLIST_PANEL_ORIGIN: STAGING_ORIGIN, CHECKLIST_STAGING_DATABASE_SHA256: STAGING_DATABASE_SHA256, CHECKLIST_WORKER_SECRET: "synthetic_stage_secret_for_local_tests_only" };
const directories: string[] = [];
afterAll(async () => { for (const d of directories) await rm(d, { recursive: true, force: true }); });
const json = (data: unknown) => Response.json(data);

describe("scheduler CheckList exclusivo staging", () => {
  it("nega produção, URLs alternativas/credenciais/path/query e fingerprint divergente antes do fetch", async () => {
    const fetchImpl = vi.fn();
    for (const change of [
      { CHECKLIST_TARGET_ENVIRONMENT: "production" },
      ...["https://painel.alpha-comex.com", `${STAGING_ORIGIN}/`, `${STAGING_ORIGIN}/api/other`, `${STAGING_ORIGIN}?target=prod`, "https://staging.alpha-comex.com.evil.invalid", "https://user@staging.alpha-comex.com"].map(CHECKLIST_PANEL_ORIGIN => ({ CHECKLIST_PANEL_ORIGIN })),
      { CHECKLIST_STAGING_DATABASE_SHA256: "0".repeat(64) },
      { CHECKLIST_WORKER_SECRET: "" },
      { CHECKLIST_WORKER_SECRET: "REPLACE_WITH_NEW_STAGE_ONLY_SECRET" },
      { CHECKLIST_WORKER_SECRET: `${env.CHECKLIST_WORKER_SECRET}\nheader` },
    ]) expect((await runStagingWorker({ ...env, ...change }, { fetchImpl })).ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("dry-run não faz rede e omite credenciais", async () => {
    const fetchImpl = vi.fn();
    const result = await runStagingWorker(env, { dryRun: true, fetchImpl });
    expect(result).toMatchObject({ ok: true, mode: "dry-run", networkRequests: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(env.CHECKLIST_WORKER_SECRET);
  });

  it("env explícito0600 fora da release; recusa default, permissões amplas e symlink", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "checklist-worker-env-")); directories.push(dir);
    const file = path.join(dir, ".env.staging.local");
    await writeFile(file, Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n"), { mode: 0o600 });
    expect(await loadStagingConfig(file)).toEqual(env);
    expect(await main(["--check", "--env-file", file])).toMatchObject({ ok: true, mode: "dry-run" });
    await expect(loadStagingConfig(".env.local")).rejects.toThrow("STAGING_ENV_FILE_REQUIRED");
    await expect(loadStagingConfig(path.resolve(".env.staging.local"))).rejects.toThrow("ENV_MUST_BE_OUTSIDE_RELEASE");
    await chmod(file, 0o644);
    await expect(loadStagingConfig(file)).rejects.toThrow("ENV_FILE_MUST_BE_REGULAR_0600");
    const dir2 = await mkdtemp(path.join(tmpdir(), "checklist-worker-link-")); directories.push(dir2);
    await symlink(file, path.join(dir2, ".env.staging.local"));
    expect((await main(["--check", "--env-file", path.join(dir2, ".env.staging.local")])).ok).toBe(false);
    expect(await main([])).toEqual({ ok: false, code: "USAGE_ONCE_OR_DRY_RUN_ENV_FILE" });
  });

  it("POST fixa destino, Bearer e redirect:error; retorna só processed seguro", async () => {
    const bypass = "synthetic_stage_bypass_token";
    const fetchImpl = vi.fn().mockResolvedValue(json({ processed: 3, internalSecret: "must_not_escape" }));
    expect(await runStagingWorker({ ...env, CHECKLIST_VERCEL_PROTECTION_BYPASS: bypass }, { fetchImpl })).toEqual({ ok: true, mode: "once", processed: 3 });
    expect(fetchImpl).toHaveBeenCalledWith(STAGING_ORIGIN + WORKER_PATH, expect.objectContaining({ method: "POST", redirect: "error", headers: { authorization: `Bearer ${env.CHECKLIST_WORKER_SECRET}`, "x-vercel-protection-bypass": bypass }, signal: expect.any(AbortSignal) }));
  });

  it("HTTP erro não imprime corpo, URL ou segredo do servidor", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(`password=${env.CHECKLIST_WORKER_SECRET}`, { status: 401 }));
    expect(await runStagingWorker(env, { fetchImpl })).toEqual({ ok: false, code: "WORKER_HTTP_FAILED", status: 401 });
    fetchImpl.mockRejectedValue(new Error(`fetch failed token=${env.CHECKLIST_WORKER_SECRET}`));
    expect(await runStagingWorker(env, { fetchImpl })).toEqual({ ok: false, code: "WORKER_REQUEST_FAILED" });
  });

  it("timeout aborta requisição e libera nova execução", async () => {
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn<typeof fetch>((_url, options) => { signal = options?.signal ?? undefined; return new Promise<Response>(() => {}); });
    expect(await runStagingWorker(env, { fetchImpl, timeoutMs: 5 })).toEqual({ ok: false, code: "WORKER_TIMEOUT" });
    expect(signal?.aborted).toBe(true);
    expect(await runStagingWorker(env, { fetchImpl: vi.fn().mockResolvedValue(json({ processed: 0 })) })).toMatchObject({ ok: true, processed: 0 });
  });

  it("recusa execução simultânea no processo enquanto HTTP está pendente", async () => {
    let finish!: (value: Response) => void;
    const first = runStagingWorker(env, { fetchImpl: () => new Promise<Response>(resolve => { finish = resolve; }) });
    expect(await runStagingWorker(env, { fetchImpl: vi.fn() })).toEqual({ ok: false, code: "WORKER_ALREADY_RUNNING" });
    finish(json({ processed: 1 }));
    expect(await first).toMatchObject({ ok: true });
  });

  it("limita corpo e rejeita HTML, JSON inválido e processed fora do contrato", async () => {
    for (const response of [new Response("secret html"), new Response("invalid", { headers: { "content-type": "application/json" } }), json({ processed: -1 }), json({ processed: 51 }), json({ processed: 1.2 }), json({ processed: 0, padding: "x".repeat(5000) })]) {
      const result = await runStagingWorker(env, { fetchImpl: vi.fn().mockResolvedValue(response) });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toMatch(/secret|padding|invalid/);
    }
  });
});
