"use server";
import { safeAlphaSeoActionError } from "@/lib/alpha-seo/action-error";
import { z } from "zod";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import {
  applyProjectMemoryUpdates,
  getProjectMemory,
  memoryUpdateSchema,
} from "@/lib/alpha-seo/project-memory/service";

export async function ObterMemoriaAlphaSeo(projectId: string) {
  try {
    await requireAlphaSeoProjectAccess({ projectId, action: "seo:read" });
    return { success: true as const, data: await getProjectMemory(projectId) };
  } catch (error) {
    return {
      success: false as const,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function AtualizarMemoriaAlphaSeo(input: unknown) {
  try {
    const data = z
      .object({
        projectId: z.string().min(1),
        updates: z.array(memoryUpdateSchema).min(1).max(25),
      })
      .strict()
      .parse(input);
    const access = await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "project:update",
      minimumRole: "EDITOR",
    });
    return {
      success: true as const,
      data: await applyProjectMemoryUpdates({
        projectId: data.projectId,
        userId: access.userId,
        author: "USER",
        updates: data.updates,
      }),
    };
  } catch (error) {
    return {
      success: false as const,
      error: safeAlphaSeoActionError(error),
    };
  }
}
