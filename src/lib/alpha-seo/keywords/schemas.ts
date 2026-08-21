import { z } from "zod";

const keywordSchema = z.string().trim().min(1).max(700);
export const keywordResearchInputSchema = z.object({
  projectId: z.string().min(1),
  keywords: z.array(keywordSchema).min(1).max(200),
  locationCode: z.number().int().positive().optional(),
  languageCode: z.string().trim().min(2).max(8).optional(),
  resultLimit: z.union([z.literal(150), z.literal(300), z.literal(500)]).default(150),
  mode: z.enum(["auto", "related", "suggestions", "ideas"]).default("auto"),
  clickstream: z.boolean().default(false),
});
export const keywordSerpInputSchema = z.object({
  projectId: z.string().min(1),
  keyword: keywordSchema,
  locationCode: z.number().int().positive().optional(),
  languageCode: z.string().trim().min(2).max(8).optional(),
});
export const keywordCostApprovalSchema = z.object({
  request: keywordResearchInputSchema,
});

export interface AlphaSeoKeywordRow {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  keywordDifficulty: number | null;
  intent: string | null;
  monthlySearches: unknown[];
  source: string;
}
