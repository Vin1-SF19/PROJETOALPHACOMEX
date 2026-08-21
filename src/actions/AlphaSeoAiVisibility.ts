"use server";
import { z } from "zod";
import db from "@/lib/prisma";
import { safeAlphaSeoActionError } from "@/lib/alpha-seo/action-error";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import {
  aiRequestHash,
  aiVisibilityInputSchema,
  executeAiVisibility,
} from "@/lib/alpha-seo/ai-visibility/service";

export async function AprovarCustoAlphaSeoAiVisibility(input: unknown) {
  try {
    const data = z
      .object({
        request: aiVisibilityInputSchema,
      })
      .strict()
      .parse(input);
    const access = await requireAlphaSeoProjectAccess({
      projectId: data.request.projectId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    const requestHash = aiRequestHash(data.request);
    const estimatedMicrosUsd = Math.min(
      20_000_000,
      Math.max(20_000, Math.ceil(data.request.query.length / 4) * 20),
    );
    const approval = await db.alphaSeoCostApproval.upsert({
      where: {
        projectId_userId_operation_requestHash: {
          projectId: data.request.projectId,
          userId: access.userId,
          operation: `AI_VISIBILITY_${data.request.kind}`,
          requestHash,
        },
      },
      create: {
        projectId: data.request.projectId,
        userId: access.userId,
        operation: `AI_VISIBILITY_${data.request.kind}`,
        requestHash,
        estimatedMicrosUsd,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
      update: {
        estimatedMicrosUsd,
        approvedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });
    return {
      success: true,
      data: { approvalId: approval.id, expiresAt: approval.expiresAt },
    };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function ExecutarAlphaSeoAiVisibility(input: unknown) {
  try {
    const data = aiVisibilityInputSchema.parse(input);
    const access = await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    return {
      success: true,
      data: await executeAiVisibility({ userId: access.userId, data }),
    };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function ListarHistoricoAlphaSeoAiVisibility(input: unknown) {
  try {
    const data = z
      .object({
        projectId: z.string().min(1),
        kind: z.enum(["BRAND_LOOKUP", "PROMPT_EXPLORER"]).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      })
      .strict()
      .parse(input);
    await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "seo:read",
    });
    const rows = await db.alphaSeoAiVisibilityRun.findMany({
      where: { projectId: data.projectId, kind: data.kind },
      include: { providerResults: true },
      orderBy: { createdAt: "desc" },
      take: data.limit,
    });
    return { success: true, data: rows };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function EstimarAlphaSeoAiVisibility(input: unknown) {
  try {
    const data = aiVisibilityInputSchema.parse(input);
    await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "seo:read",
    });
    const estimatedMicrosUsd = Math.min(
      20_000_000,
      Math.max(20_000, Math.ceil(data.query.length / 4) * 20),
    );
    return {
      success: true,
      data: {
        requestHash: aiRequestHash(data),
        estimatedMicrosUsd,
        providers: 4,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
