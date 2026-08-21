"use server";
import { safeAlphaSeoActionError } from "@/lib/alpha-seo/action-error";

import {
  approveKeywordResearchCost,
  estimateKeywordResearchCost,
  getAlphaSeoSerpAnalysis,
  researchAlphaSeoKeywords,
} from "@/lib/alpha-seo/keywords/service";

type Result =
  | { success: true; data: unknown }
  | { success: false; error: string; code?: string };
async function execute(operation: () => Promise<unknown>): Promise<Result> {
  try {
    return { success: true, data: await operation() };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
      code: error instanceof Error ? error.name : undefined,
    };
  }
}
export async function EstimarCustoPesquisaPalavrasChaveAlphaSeo(
  input: unknown,
) {
  return execute(() => estimateKeywordResearchCost(input));
}
export async function AprovarCustoPesquisaPalavrasChaveAlphaSeo(
  input: unknown,
) {
  return execute(() => approveKeywordResearchCost(input));
}
export async function PesquisarPalavrasChaveAlphaSeo(input: unknown) {
  return execute(() => researchAlphaSeoKeywords(input));
}
export async function ObterAnaliseSerpAlphaSeo(input: unknown) {
  return execute(() => getAlphaSeoSerpAnalysis(input));
}
