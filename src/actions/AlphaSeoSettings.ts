"use server";

import { z } from "zod";
import {
  getAlphaSeoApiKeyStatus,
  getAlphaSeoSamAccessSetupStatus,
} from "@/lib/alpha-seo/config/status";
import {
  alphaSeoAccessErrorMessage,
  requireAlphaSeoModuleAccess,
  requireAlphaSeoProjectAccess,
} from "@/lib/alpha-seo/project-access";
import {
  prewarmAlphaSeoSerpLocations,
  searchAlphaSeoSerpLocations,
} from "@/lib/alpha-seo/serp-locations/service";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };

async function action<T>(operation: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { success: true, data: await operation() };
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
    const code = error instanceof Error ? error.message : "";
    const safeCodes = new Set([
      "DATAFORSEO_NOT_CONFIGURED",
      "DATAFORSEO_AUTH_FAILED",
      "DATAFORSEO_UNAVAILABLE",
      "DATAFORSEO_INVALID_RESPONSE",
      "DATAFORSEO_TASK_FAILED",
    ]);
    return {
      success: false,
      error: safeCodes.has(code) ? code : "Erro interno do Alpha SEO",
    };
  }
}

export async function ObterStatusChaveSeoAlphaSeo() {
  return action(async () => {
    await requireAlphaSeoModuleAccess();
    return getAlphaSeoApiKeyStatus();
  });
}

export async function ObterStatusAcessoSamAlphaSeo(input: unknown) {
  return action(async () => {
    const parsed = z.object({ projectId: z.string().trim().min(1) }).parse(input);
    await requireAlphaSeoProjectAccess({
      projectId: parsed.projectId,
      action: "project:read",
    });
    return getAlphaSeoSamAccessSetupStatus();
  });
}

export async function BuscarLocalizacoesSerpAlphaSeo(input: unknown) {
  return action(() => searchAlphaSeoSerpLocations(input));
}

export async function PreaquecerLocalizacoesSerpAlphaSeo(input: unknown) {
  return action(() => prewarmAlphaSeoSerpLocations(input));
}
