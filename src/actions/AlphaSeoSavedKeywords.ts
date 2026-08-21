"use server";

import { revalidatePath } from "next/cache";
import { safeAlphaSeoActionError } from "@/lib/alpha-seo/action-error";
import {
  approveAlphaSeoSavedKeywordMetricsCost,
  deleteAlphaSeoSavedKeywordTag,
  estimateAlphaSeoSavedKeywordMetricsCost,
  listAlphaSeoSavedKeywords,
  refreshAlphaSeoSavedKeywordMetrics,
  removeAlphaSeoSavedKeywords,
  saveAlphaSeoKeywords,
  updateAlphaSeoSavedKeywordTag,
  updateAlphaSeoSavedKeywordTags,
} from "@/lib/alpha-seo/saved-keywords/service";

type Result =
  { success: true; data: unknown } | { success: false; error: string };
async function execute(
  operation: () => Promise<unknown>,
  mutate = false,
): Promise<Result> {
  try {
    const data = await operation();
    if (mutate) revalidatePath("/PainelAlpha/AlphaSEO");
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function SalvarPalavrasChaveAlphaSeo(input: unknown) {
  return execute(() => saveAlphaSeoKeywords(input), true);
}
export async function ListarPalavrasChaveSalvasAlphaSeo(input: unknown) {
  return execute(() => listAlphaSeoSavedKeywords(input));
}
export async function AtualizarTagsPalavrasChaveAlphaSeo(input: unknown) {
  return execute(() => updateAlphaSeoSavedKeywordTags(input), true);
}
export async function AtualizarTagPalavrasChaveAlphaSeo(input: unknown) {
  return execute(() => updateAlphaSeoSavedKeywordTag(input), true);
}
export async function ExcluirTagPalavrasChaveAlphaSeo(input: unknown) {
  return execute(() => deleteAlphaSeoSavedKeywordTag(input), true);
}
export async function RemoverPalavrasChaveAlphaSeo(input: unknown) {
  return execute(() => removeAlphaSeoSavedKeywords(input), true);
}
export async function AtualizarMetricasPalavrasChaveAlphaSeo(input: unknown) {
  return execute(() => refreshAlphaSeoSavedKeywordMetrics(input), true);
}
export async function EstimarCustoMetricasPalavrasChaveAlphaSeo(input: unknown) {
  return execute(() => estimateAlphaSeoSavedKeywordMetricsCost(input));
}
export async function AprovarCustoMetricasPalavrasChaveAlphaSeo(input: unknown) {
  return execute(() => approveAlphaSeoSavedKeywordMetricsCost(input));
}
