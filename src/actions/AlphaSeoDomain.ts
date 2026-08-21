"use server";
import { safeAlphaSeoActionError } from "@/lib/alpha-seo/action-error";
import {
  getAlphaSeoDomainKeywordSuggestions,
  getAlphaSeoDomainOverview,
  listAlphaSeoDomainKeywords,
  listAlphaSeoDomainPages,
} from "@/lib/alpha-seo/domain/service";
type Result =
  { success: true; data: unknown } | { success: false; error: string };
async function execute(operation: () => Promise<unknown>): Promise<Result> {
  try {
    return { success: true, data: await operation() };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function ObterOverviewDominioAlphaSeo(input: unknown) {
  return execute(() => getAlphaSeoDomainOverview(input));
}
export async function ListarPalavrasChaveDominioAlphaSeo(input: unknown) {
  return execute(() => listAlphaSeoDomainKeywords(input));
}
export async function ListarPaginasDominioAlphaSeo(input: unknown) {
  return execute(() => listAlphaSeoDomainPages(input));
}
export async function SugerirPalavrasChaveDominioAlphaSeo(input: unknown) {
  return execute(() => getAlphaSeoDomainKeywordSuggestions(input));
}
