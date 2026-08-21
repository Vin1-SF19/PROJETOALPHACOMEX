"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import {
  addRankKeywordsSchema, approveRankCostSchema, configIdSchema, createRankConfigSchema,
  rankHistorySchema, rankResultsSchema, rankSuggestionsSchema, rankTrendSchema, removeRankKeywordsSchema,
  triggerRankRunSchema, updateRankConfigSchema,
} from "@/lib/alpha-seo/rank-tracking/contracts";
import {
  addRankKeywords, approveRankKeywordMetricsCost, approveRankRunCost, createRankConfig,
  estimateRankKeywordMetricsCost, estimateRankRun, listRankConfigs, refreshRankKeywordMetrics,
  removeRankKeywords, suggestRankKeywords, triggerRankRun, updateRankConfig,
} from "@/lib/alpha-seo/rank-tracking/service";
import { getRankKeywordHistory, getRankResults, getRankTrend } from "@/lib/alpha-seo/rank-tracking/repository";

const path = "/PainelAlpha/AlphaSEO";

export async function ListarRankTrackersAlphaSeo(raw: unknown) {
  return action(async () => { const input = z.object({ projectId: z.string().min(1) }).parse(raw); await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:read" }); return listRankConfigs(input.projectId); });
}

export async function CriarRankTrackerAlphaSeo(raw: unknown) {
  return action(async () => { const input = createRankConfigSchema.parse(raw); await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:execute" }); const result = await createRankConfig(input); revalidatePath(path); return result; });
}

export async function AtualizarRankTrackerAlphaSeo(raw: unknown) {
  return action(async () => { const input = updateRankConfigSchema.parse(raw); await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:execute" }); const result = await updateRankConfig(input); revalidatePath(path); return result; });
}

export async function AdicionarKeywordsRankAlphaSeo(raw: unknown) {
  return action(async () => { const input = addRankKeywordsSchema.parse(raw); await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:execute" }); const result = await addRankKeywords(input); revalidatePath(path); return result; });
}

export async function RemoverKeywordsRankAlphaSeo(raw: unknown) {
  return action(async () => { const input = removeRankKeywordsSchema.parse(raw); await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:execute" }); const result = await removeRankKeywords(input); revalidatePath(path); return result; });
}

export async function EstimarCustoRankAlphaSeo(raw: unknown) {
  return action(async () => { const input = triggerRankRunSchema.omit({ approvalRequestHash: true }).parse(raw); await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:read" }); return estimateRankRun(input); });
}

export async function AprovarCustoRankAlphaSeo(raw: unknown) {
  return action(async () => { const input = approveRankCostSchema.parse(raw); const access = await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:execute" }); return approveRankRunCost({ ...input, userId: access.userId }); });
}

export async function ExecutarRankTrackerAlphaSeo(raw: unknown) {
  return action(async () => { const input = triggerRankRunSchema.parse(raw); const access = await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:execute" }); const result = await triggerRankRun({ ...input, userId: access.userId }); revalidatePath(path); return result; });
}

export async function ObterResultadosRankAlphaSeo(raw: unknown) {
  return action(async () => { const input = rankResultsSchema.parse(raw); await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:read" }); const days = Number(input.comparePeriod.slice(0, -1)); const result = await getRankResults(input.projectId, input.configId, 2_000, days); if (!result) throw new Error("RANK_CONFIG_NOT_FOUND"); return result; });
}

export async function ObterHistoricoKeywordRankAlphaSeo(raw: unknown) {
  return action(async () => { const input = rankHistorySchema.parse(raw); await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:read" }); const result = await getRankKeywordHistory({ projectId: input.projectId, configId: input.configId, keywordId: input.trackingKeywordId, device: input.device, sinceDays: input.sinceDays, limit: input.limit }); if (!result) throw new Error("RANK_KEYWORD_NOT_FOUND"); return result; });
}

export async function ObterTendenciaRankAlphaSeo(raw: unknown) {
  return action(async () => { const input = rankTrendSchema.parse(raw); await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:read" }); const result = await getRankTrend(input); if (!result) throw new Error("RANK_CONFIG_NOT_FOUND"); return result; });
}

export async function SugerirKeywordsRankAlphaSeo(raw: unknown) {
  return action(async () => { const input = rankSuggestionsSchema.parse(raw); const access = await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:execute" }); return suggestRankKeywords({ ...input, access }); });
}

export async function AtualizarMetricasKeywordsRankAlphaSeo(raw: unknown) {
  return action(async () => { const input = configIdSchema.parse(raw); const access = await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:execute" }); const result = await refreshRankKeywordMetrics({ ...input, access }); revalidatePath(path); return result; });
}

export async function EstimarCustoMetricasKeywordsRankAlphaSeo(raw: unknown) {
  return action(async () => { const input = configIdSchema.parse(raw); const access = await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:read" }); return estimateRankKeywordMetricsCost({ ...input, access }); });
}

export async function AprovarCustoMetricasKeywordsRankAlphaSeo(raw: unknown) {
  return action(async () => { const input = configIdSchema.extend({ requestHash: z.string().min(1).max(200) }).parse(raw); const access = await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:execute" }); return approveRankKeywordMetricsCost({ ...input, access }); });
}

async function action<T>(operation: () => Promise<T>): Promise<{ success: true; data: T } | { success: false; error: string; details?: unknown }> {
  try { return { success: true, data: await operation() }; }
  catch (error) { if (error instanceof z.ZodError) return { success: false, error: "Dados invalidos", details: error.flatten().fieldErrors }; return { success: false, error: safeMessage(error) }; }
}

function safeMessage(error: unknown) { const message = error instanceof Error ? error.message : "Erro interno"; return /^[A-Z0-9_]+$/.test(message) ? message : "Erro interno do Alpha SEO"; }
