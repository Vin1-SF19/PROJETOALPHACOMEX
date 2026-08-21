"use server";
import { safeAlphaSeoActionError } from "@/lib/alpha-seo/action-error";

import {
  getAlphaSeoDashboardActivation,
  getAlphaSeoDashboardOverview,
  markAlphaSeoDashboardState,
  refreshAlphaSeoDashboardBacklinks,
} from "@/lib/alpha-seo/dashboard/service";
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
export async function ObterAtivacaoDashboardAlphaSeo(input: unknown) {
  return execute(() => getAlphaSeoDashboardActivation(input));
}
export async function ObterOverviewDashboardAlphaSeo(input: unknown) {
  return execute(() => getAlphaSeoDashboardOverview(input));
}
export async function AtualizarSnapshotBacklinksDashboardAlphaSeo(
  input: unknown,
) {
  return execute(() => refreshAlphaSeoDashboardBacklinks(input));
}
export async function MarcarCompetidorDashboardAlphaSeo(input: unknown) {
  return execute(() =>
    markAlphaSeoDashboardState(input, "competitorStepClickedAt"),
  );
}
export async function DispensarMcpDashboardAlphaSeo(input: unknown) {
  return execute(() => markAlphaSeoDashboardState(input, "mcpCardDismissedAt"));
}
export async function DispensarGa4DashboardAlphaSeo(input: unknown) {
  return execute(() => markAlphaSeoDashboardState(input, "ga4CardDismissedAt"));
}
