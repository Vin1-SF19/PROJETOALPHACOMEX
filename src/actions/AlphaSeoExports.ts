"use server";
import { safeAlphaSeoActionError } from "@/lib/alpha-seo/action-error";
import {
  exportAlphaSeoCsv,
  exportAlphaSeoGoogleSheets,
} from "@/lib/alpha-seo/exports/service";
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
export async function ExportarCsvAlphaSeo(input: unknown) {
  return execute(() => exportAlphaSeoCsv(input));
}
export async function ExportarGoogleSheetsAlphaSeo(input: unknown) {
  return execute(() => exportAlphaSeoGoogleSheets(input));
}
