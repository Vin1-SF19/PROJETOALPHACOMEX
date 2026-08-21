import { z } from "zod";

const keyword = z.string().trim().min(1).max(700);
const tag = z.string().trim().min(1).max(64);
export const savedKeywordMetricSchema = z.object({
  keyword,
  searchVolume: z.number().int().nonnegative().nullable().optional(),
  cpc: z.number().nonnegative().nullable().optional(),
  competition: z.number().min(0).max(1).nullable().optional(),
  keywordDifficulty: z.number().int().min(0).max(100).nullable().optional(),
  intent: z.string().trim().max(64).nullable().optional(),
  monthlySearches: z.array(z.unknown()).max(120).optional(),
});
export const saveKeywordsInputSchema = z.object({
  projectId: z.string().min(1),
  keywords: z.array(keyword).min(1).max(500),
  locationCode: z.number().int().positive().optional(),
  languageCode: z.string().trim().min(2).max(8).optional(),
  tags: z.array(tag).max(20).default([]),
  tagMode: z.enum(["append", "replace"]).default("append"),
  metrics: z.array(savedKeywordMetricSchema).max(500).default([]),
});
export const listSavedKeywordsInputSchema = z.object({
  projectId: z.string().min(1),
  search: z.string().trim().max(200).optional(),
  includeTerms: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  excludeTerms: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  minVolume: z.number().int().nonnegative().nullable().optional(),
  maxVolume: z.number().int().nonnegative().nullable().optional(),
  minCpc: z.number().nonnegative().nullable().optional(),
  maxCpc: z.number().nonnegative().nullable().optional(),
  minDifficulty: z.number().int().min(0).max(100).nullable().optional(),
  maxDifficulty: z.number().int().min(0).max(100).nullable().optional(),
  tagIds: z.array(z.string().min(1)).max(50).default([]),
  page: z.number().int().positive().default(1),
  limit: z.union([z.literal(50), z.literal(100), z.literal(250)]).default(50),
  sort: z.enum(["createdAt", "keyword"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export const updateSavedKeywordTagsInputSchema = z.object({
  projectId: z.string().min(1),
  savedKeywordIds: z.array(z.string().min(1)).min(1).max(2000),
  addTags: z.array(tag).max(20).default([]),
  removeTagIds: z.array(z.string().min(1)).max(50).default([]),
});
export const removeSavedKeywordsInputSchema = z.object({ projectId: z.string().min(1), savedKeywordIds: z.array(z.string().min(1)).min(1).max(2000) });
export const refreshSavedKeywordMetricsInputSchema = z.object({ projectId: z.string().min(1), savedKeywordIds: z.array(z.string().min(1)).max(2000).optional() });
export const approveSavedKeywordMetricsInputSchema = refreshSavedKeywordMetricsInputSchema.extend({ requestHash: z.string().min(1).max(200) });
export const updateSavedKeywordTagInputSchema = z.object({ projectId: z.string().min(1), tagId: z.string().min(1), name: tag.optional(), color: z.string().trim().max(32).nullable().optional() }).refine((value) => value.name !== undefined || value.color !== undefined);
export const deleteSavedKeywordTagInputSchema = z.object({ projectId: z.string().min(1), tagId: z.string().min(1), force: z.boolean().default(false) });
