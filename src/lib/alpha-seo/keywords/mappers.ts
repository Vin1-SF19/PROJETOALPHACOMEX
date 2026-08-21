import type { AlphaSeoKeywordRow } from "./schemas";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function numberOrNull(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function stringOrNull(value: unknown): string | null { return typeof value === "string" && value.trim() ? value : null; }

export function normalizeKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function mapDataForSeoKeywordItems(results: unknown[], source: string): AlphaSeoKeywordRow[] {
  const rows: AlphaSeoKeywordRow[] = [];
  for (const result of results) {
    const resultRecord = record(result);
    const items = Array.isArray(resultRecord?.items) ? resultRecord.items : [];
    for (const rawItem of items) {
      const item = record(rawItem);
      const keywordData = record(item?.keyword_data);
      const info = record(keywordData?.keyword_info) ?? record(item?.keyword_info);
      const properties = record(keywordData?.keyword_properties) ?? record(item?.keyword_properties);
      const keyword = stringOrNull(keywordData?.keyword) ?? stringOrNull(item?.keyword);
      if (!keyword) continue;
      const monthlySearches = Array.isArray(info?.monthly_searches) ? info.monthly_searches : [];
      rows.push({
        keyword: normalizeKeyword(keyword),
        searchVolume: numberOrNull(info?.search_volume),
        cpc: numberOrNull(info?.cpc),
        competition: numberOrNull(info?.competition),
        keywordDifficulty: numberOrNull(properties?.keyword_difficulty ?? info?.keyword_difficulty),
        intent: stringOrNull(properties?.search_intent ?? item?.search_intent),
        monthlySearches,
        source,
      });
    }
  }
  return rows;
}

export function dedupeKeywordRows(rows: AlphaSeoKeywordRow[], limit: number): AlphaSeoKeywordRow[] {
  const byKeyword = new Map<string, AlphaSeoKeywordRow>();
  for (const row of rows) {
    const existing = byKeyword.get(row.keyword);
    if (!existing || (row.searchVolume ?? -1) > (existing.searchVolume ?? -1)) byKeyword.set(row.keyword, row);
  }
  return [...byKeyword.values()].sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1) || a.keyword.localeCompare(b.keyword)).slice(0, limit);
}

export function mapSerpItems(results: unknown[]) {
  const result = record(results[0]);
  const items = Array.isArray(result?.items) ? result.items : [];
  return items.flatMap((raw) => {
    const item = record(raw);
    if (item?.type !== "organic") return [];
    return [{
      rank: numberOrNull(item.rank_group ?? item.rank_absolute) ?? 0,
      title: stringOrNull(item.title) ?? "",
      url: stringOrNull(item.url) ?? "",
      domain: stringOrNull(item.domain) ?? "",
      description: stringOrNull(item.description) ?? "",
      etv: numberOrNull(item.etv),
      estimatedPaidTrafficCost: numberOrNull(item.estimated_paid_traffic_cost),
    }];
  });
}
