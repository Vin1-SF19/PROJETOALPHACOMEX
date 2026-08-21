"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { alphaSeoAccessErrorMessage } from "@/lib/alpha-seo/project-access";
import {
  dismissAlphaSeoGscNudge,
  getAlphaSeoOnboardingAnswers,
  getAlphaSeoOnboardingChatState,
  saveAlphaSeoOnboardingAnswers,
  saveAlphaSeoOnboardingSite,
} from "@/lib/alpha-seo/onboarding/service";

const BASE_PATH = "/PainelAlpha/AlphaSEO";
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };

async function action<T>(
  operation: () => Promise<T>,
  revalidate = false,
): Promise<ActionResult<T>> {
  try {
    const data = await operation();
    if (revalidate) revalidatePath(BASE_PATH);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Dados inválidos",
        details: error.flatten().fieldErrors,
      };
    }
    const accessMessage = alphaSeoAccessErrorMessage(error);
    if (accessMessage !== "Erro interno do Alpha SEO") {
      return { success: false, error: accessMessage };
    }
    const message = error instanceof Error ? error.message : "";
    if (
      message === "Projeto Alpha SEO não encontrado" ||
      message.startsWith("Informe um domínio")
    ) {
      return { success: false, error: message };
    }
    return { success: false, error: "Erro interno do Alpha SEO" };
  }
}

export async function ObterRespostasOnboardingAlphaSeo(input?: unknown) {
  return action(() => getAlphaSeoOnboardingAnswers(input ?? {}));
}

export async function SalvarRespostasOnboardingAlphaSeo(input: unknown) {
  return action(() => saveAlphaSeoOnboardingAnswers(input), true);
}

export async function DispensarNudgeGscAlphaSeo(input?: unknown) {
  return action(() => dismissAlphaSeoGscNudge(input ?? {}), true);
}

export async function ObterEstadoChatOnboardingAlphaSeo(input?: unknown) {
  return action(() => getAlphaSeoOnboardingChatState(input ?? {}));
}

export async function SalvarSiteOnboardingAlphaSeo(input: unknown) {
  return action(() => saveAlphaSeoOnboardingSite(input), true);
}
