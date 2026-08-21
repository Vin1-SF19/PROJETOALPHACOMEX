import "server-only";

import { z } from "zod";
import { normalizeRankDomain, type RankDevice } from "./contracts";

export interface RankProviderTask {
  keywordId: string;
  keyword: string;
  device: RankDevice;
}

export interface RankProviderResult extends RankProviderTask {
  position: number | null;
  rankedUrl: string | null;
  serpFeatures: string[];
}

export interface PostedRankProviderTask extends RankProviderTask { providerTaskId: string; }
export interface RankProviderBatchResult { results: RankProviderResult[]; actualMicrosUsd: number; }
export interface RankProviderPostResult { accepted: PostedRankProviderTask[]; rejected: RankProviderTask[]; actualMicrosUsd: number; }
export interface RankProviderCollectResult { completed: RankProviderResult[]; pending: PostedRankProviderTask[]; failed: RankProviderTask[]; }

export interface RankKeywordSuggestion {
  keyword: string;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpcMicros: number | null;
}

export interface RankProvider {
  check(input: { tasks: RankProviderTask[]; domain: string; locationCode: number; locationName?: string | null; languageCode: string; depth: number }): Promise<RankProviderBatchResult>;
  postQueued(input: { tasks: RankProviderTask[]; domain: string; locationCode: number; locationName?: string | null; languageCode: string; depth: number }): Promise<RankProviderPostResult>;
  collectQueued(input: { tasks: PostedRankProviderTask[]; domain: string }): Promise<RankProviderCollectResult>;
}

const providerResponseSchema = z.object({ tasks: z.array(z.object({ id: z.string().optional(), cost: z.number().optional(), result: z.array(z.unknown()).nullable().optional(), status_code: z.number().optional(), status_message: z.string().optional() })).optional() });

export class DataForSeoRankProvider implements RankProvider {
  readonly #authorization: string;

  constructor(login = process.env.DATAFORSEO_LOGIN, password = process.env.DATAFORSEO_PASSWORD) {
    const apiKey = process.env.DATAFORSEO_API_KEY?.trim();
    if (apiKey) {
      this.#authorization = apiKey.startsWith("Basic ") ? apiKey : `Basic ${apiKey}`;
      return;
    }
    if (!login || !password) throw new Error("DATAFORSEO_NOT_CONFIGURED");
    this.#authorization = `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
  }

  async check(input: { tasks: RankProviderTask[]; domain: string; locationCode: number; locationName?: string | null; languageCode: string; depth: number }) {
    const payload = input.tasks.map((task) => ({
      keyword: task.keyword,
      location_code: input.locationName ? undefined : input.locationCode,
      location_name: input.locationName ?? undefined,
      language_code: input.languageCode,
      device: task.device.toLowerCase(),
      depth: input.depth,
      tag: `${task.keywordId}:${task.device}`,
    }));
    const body = await this.#post("/v3/serp/google/organic/live/advanced", payload);
    const target = normalizeRankDomain(input.domain);
    const results = input.tasks.map((task, index) => {
      const taskBody = body.tasks?.[index];
      return mapSerpTask(task, taskBody?.result, target);
    });
    return { results, actualMicrosUsd: micros(body.tasks?.reduce((sum, task) => sum + (task.cost ?? 0), 0) ?? 0) };
  }

  async postQueued(input: { tasks: RankProviderTask[]; domain: string; locationCode: number; locationName?: string | null; languageCode: string; depth: number }) {
    const payload = input.tasks.map((task) => ({
      keyword: task.keyword,
      location_code: input.locationName ? undefined : input.locationCode,
      location_name: input.locationName ?? undefined,
      language_code: input.languageCode,
      device: task.device.toLowerCase(),
      depth: input.depth,
      tag: `${task.keywordId}:${task.device}`,
    }));
    const body = await this.#post("/v3/serp/google/organic/task_post", payload);
    const accepted: PostedRankProviderTask[] = [];
    const rejected: RankProviderTask[] = [];
    input.tasks.forEach((task, index) => {
      const posted = body.tasks?.[index];
      if (posted?.status_code === 20_100 && posted.id) accepted.push({ ...task, providerTaskId: posted.id });
      else rejected.push(task);
    });
    return { accepted, rejected, actualMicrosUsd: micros(body.tasks?.reduce((sum, task) => sum + (task.cost ?? 0), 0) ?? 0) };
  }

  async collectQueued(input: { tasks: PostedRankProviderTask[]; domain: string }) {
    const target = normalizeRankDomain(input.domain);
    const completed: RankProviderResult[] = [];
    const pending: PostedRankProviderTask[] = [];
    const failed: RankProviderTask[] = [];
    for (let offset = 0; offset < input.tasks.length; offset += 25) {
      const chunk = input.tasks.slice(offset, offset + 25);
      const settled = await Promise.allSettled(chunk.map(async (task) => ({ task, body: await this.#get(`/v3/serp/google/organic/task_get/advanced/${encodeURIComponent(task.providerTaskId)}`) })));
      settled.forEach((outcome, index) => {
        const task = chunk[index];
        if (outcome.status === "rejected") { pending.push(task); return; }
        const providerTask = outcome.value.body.tasks?.[0];
        if (providerTask?.status_code === 20_000 && Array.isArray(providerTask.result)) {
          completed.push(mapSerpTask(task, providerTask.result, target));
          return;
        }
        const message = providerTask?.status_message?.toLowerCase() ?? "";
        if (!providerTask || message.includes("queue") || message.includes("progress") || providerTask.status_code === 40_601) pending.push(task);
        else failed.push(task);
      });
    }
    return { completed, pending, failed };
  }

  async #post(path: string, payload: unknown) {
    const response = await fetch(`https://api.dataforseo.com${path}`, {
      method: "POST",
      headers: { Authorization: this.#authorization, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`DATAFORSEO_HTTP_${response.status}`);
    const parsed = providerResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("DATAFORSEO_INVALID_RESPONSE");
    return parsed.data;
  }

  async #get(path: string) {
    const response = await fetch(`https://api.dataforseo.com${path}`, {
      method: "GET",
      headers: { Authorization: this.#authorization, Accept: "application/json" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`DATAFORSEO_HTTP_${response.status}`);
    const parsed = providerResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("DATAFORSEO_INVALID_RESPONSE");
    return parsed.data;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function mapRankKeywordSuggestions(results: unknown[]): RankKeywordSuggestion[] {
  const result = results[0];
  const items = isRecord(result) && Array.isArray(result.items) ? result.items : [];
  return items.flatMap((item): RankKeywordSuggestion[] => {
    if (!isRecord(item) || typeof item.keyword !== "string") return [];
    const info = isRecord(item.keyword_info) ? item.keyword_info : {};
    const props = isRecord(item.keyword_properties) ? item.keyword_properties : {};
    return [{
      keyword: item.keyword,
      searchVolume: typeof info.search_volume === "number" ? info.search_volume : null,
      keywordDifficulty: typeof props.keyword_difficulty === "number" ? props.keyword_difficulty : null,
      cpcMicros: typeof info.cpc === "number" ? Math.round(info.cpc * 1_000_000) : null,
    }];
  });
}
function micros(usd: number) { return Math.max(0, Math.round(usd * 1_000_000)); }
function mapSerpTask(task: RankProviderTask, rawResult: unknown[] | null | undefined, target: string): RankProviderResult {
  const result = Array.isArray(rawResult) ? rawResult[0] : null;
  const items = isRecord(result) && Array.isArray(result.items) ? result.items : [];
  const organic = items.filter((item): item is Record<string, unknown> => isRecord(item) && item.type === "organic");
  const match = organic.find((item) => typeof item.domain === "string" && domainMatchesTarget(item.domain, target));
  return {
    keywordId: task.keywordId,
    keyword: task.keyword,
    device: task.device,
    position: match && typeof match.rank_absolute === "number" ? match.rank_absolute : null,
    rankedUrl: match && typeof match.url === "string" ? match.url : null,
    serpFeatures: items.filter(isRecord).map((item) => item.type).filter((value): value is string => typeof value === "string" && value !== "organic"),
  };
}
function domainMatchesTarget(candidate: string, target: string) {
  const normalized = normalizeRankDomain(candidate);
  return normalized === target || normalized.endsWith(`.${target}`);
}
