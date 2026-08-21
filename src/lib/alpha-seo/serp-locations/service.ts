import "server-only";

import { z } from "zod";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import { dataForSeoEnvelopeSchema } from "@/lib/alpha-seo/dataforseo/schemas";

export interface AlphaSeoSerpLocation {
  locationCode: number;
  locationName: string;
  locationType: string;
  displayLabel: string;
}

type Environment = Record<string, string | undefined>;

const countryCodeSchema = z.string().trim().regex(/^[A-Za-z]{2}$/);
const searchSchema = z.object({
  projectId: z.string().trim().min(1),
  query: z.string().trim().min(1).max(100),
  countryCode: countryCodeSchema,
});
const prewarmSchema = z.object({
  projectId: z.string().trim().min(1),
  countryCode: countryCodeSchema,
});

const locationItemSchema = z.object({
  location_code: z.number().int().positive(),
  location_name: z.string().trim().min(1),
  location_type: z.string().nullable().optional(),
});

const INCLUDED_LOCATION_TYPES = new Set([
  "City",
  "County",
  "Municipality",
  "DMA Region",
  "Region",
]);
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CACHED_COUNTRIES = 8;
const MAX_LOCATION_ROWS = 100_000;
const cache = new Map<
  string,
  { expiresAt: number; rows: AlphaSeoSerpLocation[] }
>();
const inFlight = new Map<string, Promise<AlphaSeoSerpLocation[]>>();

function authorizationHeader(environment: Environment): string {
  const direct = environment.DATAFORSEO_API_KEY?.trim();
  if (direct) return direct.startsWith("Basic ") ? direct : `Basic ${direct}`;
  const login = environment.DATAFORSEO_LOGIN?.trim();
  const password = environment.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("DATAFORSEO_NOT_CONFIGURED");
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

function formatLocationLabel(name: string): string {
  return name
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function parseAlphaSeoSerpLocations(
  value: unknown,
): AlphaSeoSerpLocation[] {
  const envelope = dataForSeoEnvelopeSchema.parse(value);
  if (envelope.status_code !== 20000) {
    throw new Error("DATAFORSEO_INVALID_RESPONSE");
  }
  const task = envelope.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error("DATAFORSEO_TASK_FAILED");
  }

  return (task.result ?? [])
    .slice(0, MAX_LOCATION_ROWS)
    .map((row) => locationItemSchema.safeParse(row))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
    .filter((row) => INCLUDED_LOCATION_TYPES.has(row.location_type ?? ""))
    .map((row) => ({
      locationCode: row.location_code,
      locationName: row.location_name,
      locationType: row.location_type ?? "",
      displayLabel: formatLocationLabel(row.location_name),
    }));
}

export function searchAlphaSeoSerpLocationRows(
  rows: readonly AlphaSeoSerpLocation[],
  query: string,
  limit = 10,
) {
  const needle = query.trim().toLocaleLowerCase("en-US");
  return rows
    .filter((row) =>
      row.displayLabel.toLocaleLowerCase("en-US").includes(needle),
    )
    .slice(0, Math.max(1, Math.min(limit, 50)));
}

async function fetchCountryLocations(input: {
  countryCode: string;
  fetchImpl?: typeof fetch;
  environment?: Environment;
}) {
  const countryCode = input.countryCode.toLowerCase();
  const cached = cache.get(countryCode);
  if (cached && cached.expiresAt > Date.now()) {
    cache.delete(countryCode);
    cache.set(countryCode, cached);
    return { rows: cached.rows, cached: true };
  }
  cache.delete(countryCode);

  const active = inFlight.get(countryCode);
  if (active) return { rows: await active, cached: true };

  const request = (async () => {
    const response = await (input.fetchImpl ?? fetch)(
      `https://api.dataforseo.com/v3/serp/google/locations/${countryCode}`,
      {
        method: "GET",
        headers: {
          Authorization: authorizationHeader(input.environment ?? process.env),
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("DATAFORSEO_AUTH_FAILED");
      }
      throw new Error("DATAFORSEO_UNAVAILABLE");
    }
    const rows = parseAlphaSeoSerpLocations(await response.json());
    while (cache.size >= MAX_CACHED_COUNTRIES) {
      const oldest = cache.keys().next().value;
      if (typeof oldest !== "string") break;
      cache.delete(oldest);
    }
    cache.set(countryCode, {
      rows,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return rows;
  })().finally(() => inFlight.delete(countryCode));
  inFlight.set(countryCode, request);
  return { rows: await request, cached: false };
}

export async function searchAlphaSeoSerpLocations(input: unknown) {
  const parsed = searchSchema.parse(input);
  await requireAlphaSeoProjectAccess({
    projectId: parsed.projectId,
    action: "project:read",
  });
  const result = await fetchCountryLocations({ countryCode: parsed.countryCode });
  return searchAlphaSeoSerpLocationRows(result.rows, parsed.query);
}

export async function prewarmAlphaSeoSerpLocations(input: unknown) {
  const parsed = prewarmSchema.parse(input);
  await requireAlphaSeoProjectAccess({
    projectId: parsed.projectId,
    action: "project:read",
  });
  const result = await fetchCountryLocations({ countryCode: parsed.countryCode });
  return { warmed: true, count: result.rows.length, cached: result.cached };
}
