import { alphaSeoIdempotencyKey, alphaSeoLockKey } from "./operation-policy";
import { makeCliResult, type AlphaSeoCheck, type AlphaSeoCliResult, type AlphaSeoJobResult } from "./contracts";

export interface AlphaSeoFixtureJob {
  id: string;
  projectId: string;
  type: AlphaSeoJobResult["type"];
  payload: Readonly<Record<string, unknown>>;
  attempts: number;
  maxAttempts: number;
  stale?: boolean;
  failUntilAttempt?: number;
}

export class InMemoryAlphaSeoQueue {
  readonly #jobs: AlphaSeoFixtureJob[];
  readonly #completed = new Set<string>();
  readonly #locks = new Set<string>();

  constructor(jobs: AlphaSeoFixtureJob[]) {
    this.#jobs = jobs.map((job) => ({ ...job, payload: { ...job.payload } }));
  }

  async processOnce(): Promise<AlphaSeoJobResult[]> {
    const results: AlphaSeoJobResult[] = [];
    for (const job of this.#jobs) {
      const idempotencyKey = alphaSeoIdempotencyKey(job.projectId, job.type, job.payload);
      if (this.#completed.has(idempotencyKey)) {
        results.push({ id: job.id, type: job.type, status: "skipped", attempts: job.attempts, idempotencyKey, message: "Already completed by idempotency key" });
        continue;
      }
      const lockKey = alphaSeoLockKey(job.projectId, job.type);
      if (this.#locks.has(lockKey)) {
        results.push({ id: job.id, type: job.type, status: "skipped", attempts: job.attempts, idempotencyKey, message: "Fixture mutex is already leased" });
        continue;
      }
      this.#locks.add(lockKey);
      try {
        job.attempts += 1;
        const mustFail = job.attempts <= (job.failUntilAttempt ?? 0);
        if (mustFail && job.attempts < job.maxAttempts) {
          results.push({ id: job.id, type: job.type, status: "retry-scheduled", attempts: job.attempts, idempotencyKey, message: `Fixture retry scheduled with bounded backoff (${job.attempts}/${job.maxAttempts})` });
          continue;
        }
        if (mustFail) {
          results.push({ id: job.id, type: job.type, status: "failed", attempts: job.attempts, idempotencyKey, message: "Fixture exhausted its bounded retry budget" });
          continue;
        }
        this.#completed.add(idempotencyKey);
        results.push({ id: job.id, type: job.type, status: "completed", attempts: job.attempts, idempotencyKey, message: job.stale ? "Recovered stale fixture lease and completed" : "Fixture job completed in memory" });
      } finally {
        this.#locks.delete(lockKey);
      }
    }
    return results;
  }
}

export function defaultAlphaSeoFixtureJobs(): AlphaSeoFixtureJob[] {
  return [
    { id: "fixture-rank-1", projectId: "fixture-project", type: "rank", payload: { schedule: "manual" }, attempts: 0, maxAttempts: 2 },
    { id: "fixture-audit-1", projectId: "fixture-project", type: "audit", payload: { target: "https://example.invalid" }, attempts: 0, maxAttempts: 2, stale: true },
    { id: "fixture-oauth-cleanup-1", projectId: "fixture-system", type: "oauth-cleanup", payload: { expiredBefore: "fixture" }, attempts: 0, maxAttempts: 2 },
  ];
}

export async function runAlphaSeoWorkerOnce(input: {
  queue?: InMemoryAlphaSeoQueue;
  timestamp?: string;
} = {}): Promise<AlphaSeoCliResult> {
  const queue = input.queue ?? new InMemoryAlphaSeoQueue(defaultAlphaSeoFixtureJobs());
  const jobs = await queue.processOnce();
  const checks: AlphaSeoCheck[] = [
    { id: "worker.fixture-only", ok: true, kind: "safety", message: "Worker used only an in-memory fixture queue; no database, network or paid provider was accessed" },
    { id: "worker.lease-mutex", ok: true, kind: "contract", message: "Per-project fixture mutex and idempotency keys were applied" },
    { id: "worker.retry-stale", ok: true, kind: "contract", message: "Bounded retry and stale-recovery contracts are active" },
  ];
  if (jobs.some((job) => job.status === "failed")) checks.push({ id: "worker.jobs", ok: false, kind: "dependency", message: "One or more fixture jobs exhausted their retry budget" });
  return makeCliResult({ command: "worker", checks, jobs, timestamp: input.timestamp });
}

export interface PersistentAlphaSeoWorkerResult {
  claimed: boolean;
  jobId?: string;
  type?: string;
  status: "idle" | "completed" | "retry-scheduled" | "dead-letter";
}

export async function runPersistentAlphaSeoWorkerOnce(input: { workerId?: string } = {}): Promise<PersistentAlphaSeoWorkerResult> {
  const [{ checkpointAlphaSeoJob, claimAlphaSeoJob, completeAlphaSeoJob, deferAlphaSeoJob, failAlphaSeoJob, heartbeatAlphaSeoJob, newWorkerId, toPrismaJson }, { processRankRun }, { parseRankQueuedState }, { processSiteAudit }, { parseAuditCrawlCheckpoint }, { classifyAlphaSeoProcessorResult }] = await Promise.all([
    import("./jobs/queue"),
    import("./rank-tracking/service"),
    import("./rank-tracking/queued-state"),
    import("./audit/service"),
    import("./audit/checkpoint"),
    import("./jobs/processor-result"),
  ]);
  const workerId = input.workerId ?? newWorkerId();
  const job = await claimAlphaSeoJob({ workerId, types: ["RANK_RUN", "SITE_AUDIT", "LIGHTHOUSE"] });
  if (!job) return { claimed: false, status: "idle" };
  const payload = job.payload && typeof job.payload === "object" && !Array.isArray(job.payload) ? job.payload as Record<string, unknown> : {};
  const heartbeat = async () => {
    const alive = await heartbeatAlphaSeoJob({ jobId: job.id, workerId, claimToken: job.claimToken });
    if (alive.count !== 1) throw new Error("ALPHA_SEO_JOB_FENCE_LOST");
  };
  try {
    let result: Record<string, unknown>;
    if (job.type === "RANK_RUN") {
      if (typeof payload.runId !== "string") throw new Error("RANK_JOB_PAYLOAD_INVALID");
      const keywordIds = Array.isArray(payload.keywordIds) ? payload.keywordIds.filter((value): value is string => typeof value === "string") : undefined;
      result = await processRankRun(
        payload.runId,
        workerId,
        undefined,
        keywordIds,
        heartbeat,
        parseRankQueuedState(payload.rankQueue),
        async (state) => checkpointAlphaSeoJob({
          jobId: job.id,
          workerId,
          claimToken: job.claimToken,
          payload: toPrismaJson({ ...payload, rankQueue: state }),
          result: toPrismaJson({ checkpoint: "rank-queued", queue: state }),
        }),
      );
    } else if (job.type === "SITE_AUDIT") {
      if (typeof payload.auditId !== "string") throw new Error("AUDIT_JOB_PAYLOAD_INVALID");
      result = await processSiteAudit({
        auditId: payload.auditId,
        workerId,
        heartbeatJob: heartbeat,
        checkpoint: parseAuditCrawlCheckpoint(payload.auditCheckpoint),
        persistCheckpoint: async (state) => checkpointAlphaSeoJob({
          jobId: job.id,
          workerId,
          claimToken: job.claimToken,
          payload: toPrismaJson({ ...payload, auditCheckpoint: state }),
          result: toPrismaJson({ checkpoint: "audit-crawl", pages: state.pages.length, pending: state.queue.length }),
        }),
      });
    } else {
      result = { skipped: true, terminal: true, reason: "LIGHTHOUSE_JOBS_RUN_INSIDE_AUDIT_CORE" };
    }
    const disposition = classifyAlphaSeoProcessorResult(result);
    if (disposition.kind === "defer") {
      await deferAlphaSeoJob({ jobId: job.id, workerId, claimToken: job.claimToken, delayMs: disposition.delayMs, result: toPrismaJson(result) });
      return { claimed: true, jobId: job.id, type: job.type, status: "retry-scheduled" };
    }
    if (disposition.kind === "invalid") throw new Error("ALPHA_SEO_PROCESSOR_SKIPPED_WITHOUT_DISPOSITION");
    await completeAlphaSeoJob({ jobId: job.id, workerId, claimToken: job.claimToken, result: toPrismaJson(result) });
    return { claimed: true, jobId: job.id, type: job.type, status: "completed" };
  } catch (error) {
    await failAlphaSeoJob({ jobId: job.id, workerId, claimToken: job.claimToken, attemptCount: job.attemptCount, maxAttempts: job.maxAttempts, error });
    return { claimed: true, jobId: job.id, type: job.type, status: job.attemptCount >= job.maxAttempts ? "dead-letter" : "retry-scheduled" };
  }
}
