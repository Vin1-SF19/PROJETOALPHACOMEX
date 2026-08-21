import { z } from "zod";

export const GA4_REPORTS = [
  "organic_landing_pages",
  "page_performance",
  "key_events",
  "search_opportunities",
  "organic_overview",
  "traffic_acquisition",
  "measurement_health",
  "ecommerce_performance",
  "site_search",
  "audience_breakdown",
] as const;
export const ga4ReportSchema = z.enum(GA4_REPORTS);
const DEFINITIONS: Record<
  (typeof GA4_REPORTS)[number],
  { dimensions: string[]; metrics: string[] }
> = {
  organic_landing_pages: {
    dimensions: ["landingPagePlusQueryString"],
    metrics: ["sessions", "engagedSessions", "conversions", "totalRevenue"],
  },
  page_performance: {
    dimensions: ["pagePath"],
    metrics: [
      "screenPageViews",
      "activeUsers",
      "averageSessionDuration",
      "bounceRate",
    ],
  },
  key_events: {
    dimensions: ["eventName"],
    metrics: ["eventCount", "keyEvents", "totalUsers"],
  },
  search_opportunities: {
    dimensions: ["landingPagePlusQueryString"],
    metrics: ["sessions", "engagementRate", "keyEvents"],
  },
  organic_overview: {
    dimensions: ["date"],
    metrics: ["sessions", "activeUsers", "engagedSessions", "keyEvents"],
  },
  traffic_acquisition: {
    dimensions: ["sessionDefaultChannelGroup"],
    metrics: ["sessions", "activeUsers", "engagementRate", "keyEvents"],
  },
  measurement_health: {
    dimensions: ["date"],
    metrics: ["sessions", "activeUsers", "eventCount"],
  },
  ecommerce_performance: {
    dimensions: ["itemName"],
    metrics: [
      "itemsViewed",
      "itemsAddedToCart",
      "itemsPurchased",
      "itemRevenue",
    ],
  },
  site_search: {
    dimensions: ["searchTerm"],
    metrics: ["eventCount", "activeUsers"],
  },
  audience_breakdown: {
    dimensions: ["country", "deviceCategory"],
    metrics: ["activeUsers", "sessions", "engagementRate"],
  },
};
async function googleJson(url: string, token: string, init?: RequestInit) {
  const r = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`GA4_${r.status}`);
  return r.json();
}
export async function listGa4Properties(token: string) {
  const accounts =
    z
      .object({
        accounts: z
          .array(
            z
              .object({ name: z.string(), displayName: z.string() })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .parse(
        await googleJson(
          "https://analyticsadmin.googleapis.com/v1beta/accounts",
          token,
        ),
      ).accounts ?? [];
  const properties = [];
  for (const account of accounts) {
    const raw = z
      .object({
        properties: z
          .array(
            z
              .object({
                name: z.string().regex(/^properties\/\d+$/),
                displayName: z.string(),
                timeZone: z.string().default("UTC"),
                currencyCode: z.string().default("USD"),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .parse(
        await googleJson(
          `https://analyticsadmin.googleapis.com/v1beta/properties?filter=${encodeURIComponent(`parent:${account.name}`)}`,
          token,
        ),
      );
    for (const property of raw.properties ?? [])
      properties.push({
        accountId: account.name,
        accountName: account.displayName,
        ...property,
      });
  }
  return properties;
}
export async function runGa4Report(
  token: string,
  input: {
    propertyId: string;
    report: z.input<typeof ga4ReportSchema>;
    startDate: string;
    endDate: string;
    limit?: number;
  },
) {
  const report = ga4ReportSchema.parse(input.report);
  const propertyId = z
    .string()
    .regex(/^properties\/\d+$/)
    .parse(input.propertyId);
  const range = z
    .object({ startDate: z.string().date(), endDate: z.string().date() })
    .refine((v) => v.startDate <= v.endDate)
    .parse(input);
  const definition = DEFINITIONS[report];
  const raw = await googleJson(
    `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        dateRanges: [range],
        dimensions: definition.dimensions.map((name) => ({ name })),
        metrics: definition.metrics.map((name) => ({ name })),
        limit: Math.min(Math.max(input.limit ?? 100, 1), 10000),
        dimensionFilter:
          report === "organic_landing_pages" || report === "organic_overview"
            ? {
                filter: {
                  fieldName: "sessionDefaultChannelGroup",
                  stringFilter: { matchType: "EXACT", value: "Organic Search" },
                },
              }
            : undefined,
      }),
    },
  );
  const parsed = z
    .object({
      dimensionHeaders: z.array(z.object({ name: z.string() })).default([]),
      metricHeaders: z.array(z.object({ name: z.string() })).default([]),
      rows: z
        .array(
          z.object({
            dimensionValues: z
              .array(z.object({ value: z.string().default("") }))
              .default([]),
            metricValues: z
              .array(z.object({ value: z.string().default("0") }))
              .default([]),
          }),
        )
        .default([]),
      rowCount: z.number().default(0),
    })
    .passthrough()
    .parse(raw);
  return {
    report,
    rowCount: parsed.rowCount,
    rows: parsed.rows.map((row) =>
      Object.fromEntries([
        ...parsed.dimensionHeaders.map((h, i) => [
          h.name,
          row.dimensionValues[i]?.value ?? "",
        ]),
        ...parsed.metricHeaders.map((h, i) => [
          h.name,
          Number(row.metricValues[i]?.value ?? 0),
        ]),
      ]),
    ),
  };
}
