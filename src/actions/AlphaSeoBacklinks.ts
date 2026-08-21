"use server";
import { safeAlphaSeoActionError } from "@/lib/alpha-seo/action-error";
import {
  getAlphaSeoBacklinksOverview,
  listAlphaSeoBacklinks,
  listAlphaSeoReferringDomains,
  listAlphaSeoTopPages,
} from "@/lib/alpha-seo/backlinks/service";
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
export async function ObterOverviewBacklinksAlphaSeo(input: unknown) {
  return execute(() => getAlphaSeoBacklinksOverview(input));
}
export async function ListarBacklinksAlphaSeo(input: unknown) {
  return execute(() => listAlphaSeoBacklinks(input));
}
export async function ListarDominiosReferentesAlphaSeo(input: unknown) {
  return execute(() => listAlphaSeoReferringDomains(input));
}
export async function ListarTopPaginasBacklinksAlphaSeo(input: unknown) {
  return execute(() => listAlphaSeoTopPages(input));
}
