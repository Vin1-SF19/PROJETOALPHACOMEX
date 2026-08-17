import { z } from "zod";

import { getOllamaHeaders } from "@/lib/bibble/client";
import { auditRoadmapModuleCatalog } from "@/lib/roadmap-alpha/catalog";
import {
  readRoadmapRuntimeConfig,
  type RoadmapEnvironment,
  type RoadmapRuntimeConfig,
} from "@/lib/roadmap-alpha/runtime-config";

export type RoadmapCliExitCode = 0 | 1 | 2;
export interface RoadmapCommandResult {
  ok: boolean;
  command: "doctor" | "check-modules";
  code: RoadmapCliExitCode;
  checks: Record<string, unknown>;
  timestamp: string;
}

interface DoctorDependencies {
  env?: RoadmapEnvironment;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

const ollamaTagsSchema = z.object({
  models: z.array(z.object({ name: z.string().trim().min(1) }).passthrough()),
}).passthrough();

function createTimestamp(now?: () => Date): string {
  return (now?.() ?? new Date()).toISOString();
}

export function runRoadmapModuleCheck(now?: () => Date): RoadmapCommandResult {
  const catalog = auditRoadmapModuleCatalog();
  return {
    ok: catalog.ok,
    command: "check-modules",
    code: catalog.ok ? 0 : 2,
    checks: { catalog },
    timestamp: createTimestamp(now),
  };
}

async function probeProvider(config: RoadmapRuntimeConfig, fetchImpl: typeof fetch, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${config.ollamaUrl.replace(/\/+$/, "")}/api/tags`, {
      method: "GET",
      headers: getOllamaHeaders({ Accept: "application/json" }, config.ollamaApiKey),
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        ok: false,
        errorCode: response.status === 401 || response.status === 403 ? "AUTH_FAILED" : "HTTP_ERROR",
        httpStatus: response.status,
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { ok: false, errorCode: "INVALID_JSON" };
    }
    const parsed = ollamaTagsSchema.safeParse(payload);
    if (!parsed.success) return { ok: false, errorCode: "INVALID_JSON" };
    const modelAvailable = parsed.data.models.some((model) => model.name === config.model);
    return modelAvailable
      ? { ok: true, configuredModel: config.model, availableModelCount: parsed.data.models.length }
      : { ok: false, errorCode: "MODEL_NOT_FOUND", configuredModel: config.model, availableModelCount: parsed.data.models.length };
  } catch (error) {
    const timedOut = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    return { ok: false, errorCode: timedOut ? "TIMEOUT" : "NETWORK_ERROR" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runRoadmapDoctor(dependencies: DoctorDependencies = {}): Promise<RoadmapCommandResult> {
  const catalog = auditRoadmapModuleCatalog();
  const runtime = readRoadmapRuntimeConfig(dependencies.env);
  const timestamp = createTimestamp(dependencies.now);

  if (!runtime.ok || !catalog.ok) {
    return {
      ok: false,
      command: "doctor",
      code: 2,
      checks: {
        config: runtime.ok
          ? { ok: true, configuredModel: runtime.config.model, urlConfigured: true, tokenConfigured: true }
          : { ok: false, issues: runtime.issues },
        catalog: { ok: catalog.ok, count: catalog.count, issues: catalog.issues },
        provider: { ok: false, skipped: true },
      },
      timestamp,
    };
  }

  const provider = await probeProvider(runtime.config, dependencies.fetchImpl ?? fetch, dependencies.timeoutMs ?? 10_000);
  const providerOk = provider.ok === true;
  return {
    ok: providerOk,
    command: "doctor",
    code: providerOk ? 0 : 1,
    checks: {
      config: { ok: true, configuredModel: runtime.config.model, urlConfigured: true, tokenConfigured: true },
      catalog: { ok: true, count: catalog.count, issues: [] },
      provider,
    },
    timestamp,
  };
}
