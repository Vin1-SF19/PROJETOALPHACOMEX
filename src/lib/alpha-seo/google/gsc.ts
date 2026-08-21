import { z } from "zod";

export const gscDateRangeSchema = z
  .object({ startDate: z.string().date(), endDate: z.string().date() })
  .refine((v) => v.startDate <= v.endDate, { message: "Período inválido" });
export const gscFilterSchema = z
  .object({
    dimension: z.enum(["query", "page", "country", "device"]),
    operator: z.enum([
      "equals",
      "notEquals",
      "contains",
      "notContains",
      "includingRegex",
      "excludingRegex",
    ]),
    expression: z.string().min(1).max(1000),
  })
  .strict();
export const gscSearchSchema = gscDateRangeSchema.and(
  z
    .object({
      siteUrl: z.string().min(1).max(2048),
      dimensions: z
        .array(
          z.enum([
            "date",
            "query",
            "page",
            "country",
            "device",
            "searchAppearance",
          ]),
        )
        .max(3)
        .default(["date"]),
      filters: z.array(gscFilterSchema).max(20).default([]),
      rowLimit: z.number().int().min(1).max(25_000).default(1000),
      startRow: z.number().int().min(0).default(0),
    })
    .strict(),
);
export type GscRow = {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

async function googleJson(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<unknown> {
  const r = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`GSC_${r.status}`);
  return r.json();
}
export async function listGscSites(token: string) {
  const raw = await googleJson(
    "https://www.googleapis.com/webmasters/v3/sites",
    token,
  );
  return (
    z
      .object({
        siteEntry: z
          .array(
            z
              .object({ siteUrl: z.string(), permissionLevel: z.string() })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .parse(raw).siteEntry ?? []
  );
}
export async function queryGsc(
  token: string,
  input: z.input<typeof gscSearchSchema>,
) {
  const d = gscSearchSchema.parse(input);
  const raw = await googleJson(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(d.siteUrl)}/searchAnalytics/query`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        startDate: d.startDate,
        endDate: d.endDate,
        dimensions: d.dimensions,
        dimensionFilterGroups: d.filters.length
          ? [{ groupType: "and", filters: d.filters }]
          : undefined,
        rowLimit: d.rowLimit,
        startRow: d.startRow,
      }),
    },
  );
  return z
    .object({
      rows: z
        .array(
          z
            .object({
              keys: z.array(z.string()).optional(),
              clicks: z.number().default(0),
              impressions: z.number().default(0),
              ctr: z.number().default(0),
              position: z.number().default(0),
            })
            .passthrough(),
        )
        .default([]),
    })
    .passthrough()
    .parse(raw).rows;
}
export async function inspectGscUrl(
  token: string,
  siteUrl: string,
  inspectionUrl: string,
) {
  const raw = await googleJson(
    "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
    token,
    {
      method: "POST",
      body: JSON.stringify({ siteUrl, inspectionUrl, languageCode: "pt-BR" }),
    },
  );
  return z
    .object({ inspectionResult: z.record(z.string(), z.unknown()) })
    .passthrough()
    .parse(raw).inspectionResult;
}
export function searchTotals(rows: GscRow[]) {
  let clicks = 0,
    impressions = 0,
    weighted = 0;
  for (const row of rows) {
    clicks += row.clicks;
    impressions += row.impressions;
    weighted += row.position * row.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weighted / impressions : 0,
  };
}
export function strikingDistance(rows: GscRow[], limit = 100) {
  const best = new Map<
    string,
    {
      query: string;
      page: string;
      clicks: number;
      impressions: number;
      position: number;
    }
  >();
  for (const row of rows) {
    const [query, page] = row.keys ?? [];
    if (!query || !page) continue;
    const old = best.get(query);
    if (
      !old ||
      row.position < old.position ||
      (row.position === old.position && row.impressions > old.impressions)
    )
      best.set(query, {
        query,
        page,
        clicks: row.clicks,
        impressions: row.impressions,
        position: row.position,
      });
  }
  return [...best.values()]
    .filter((v) => v.position >= 5 && v.position <= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}
export function previousPeriod(startDate: string, endDate: string) {
  const day = 86_400_000;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const length = Math.max(0, end - start);
  return {
    startDate: new Date(start - day - length).toISOString().slice(0, 10),
    endDate: new Date(start - day).toISOString().slice(0, 10),
  };
}
export function rowsToCsv(rows: GscRow[]) {
  const safe = (v: string | number) => {
    const s = String(v);
    const protectedValue = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${protectedValue.replaceAll('"', '""')}"`;
  };
  return [
    "keys,clicks,impressions,ctr,position",
    ...rows.map((r) =>
      [
        safe((r.keys ?? []).join(" | ")),
        r.clicks,
        r.impressions,
        r.ctr,
        r.position,
      ].join(","),
    ),
  ].join("\r\n");
}
