"use server";
import { safeAlphaSeoActionError } from "@/lib/alpha-seo/action-error";
import { createHash } from "node:crypto";
import { z } from "zod";
import db from "@/lib/prisma";
import { requireAlphaSeoModuleAccess, requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import { discoverAlphaSeoSkills } from "@/lib/alpha-seo/skills/catalog";

function samCost(message: string) {
  return {
    requestHash: createHash("sha256").update(message).digest("hex"),
    estimatedMicrosUsd: Math.min(5_000_000, Math.max(5_000, Math.ceil(message.length / 4) * 15)),
  };
}

export async function EstimarCustoAlphaSeoSam(input: unknown) {
  try {
    const data = z.object({ projectId: z.string().min(1), message: z.string().min(1).max(10000) }).strict().parse(input);
    await requireAlphaSeoProjectAccess({ projectId: data.projectId, action: "seo:read" });
    return { success: true, data: samCost(data.message) };
  } catch (error) {
    return { success: false, error: safeAlphaSeoActionError(error) };
  }
}

export async function CriarSessaoAlphaSeoSam(projectId: string) {
  try {
    const access = await requireAlphaSeoProjectAccess({
      projectId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    const session = await db.alphaSeoSamSession.create({
      data: { projectId, userId: access.userId },
      select: { id: true, title: true, status: true, createdAt: true },
    });
    return { success: true, data: session };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function ListarSessoesAlphaSeoSam(projectId: string) {
  try {
    const access = await requireAlphaSeoProjectAccess({
      projectId,
      action: "seo:read",
    });
    const sessions = await db.alphaSeoSamSession.findMany({
      where: { projectId, userId: access.userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { success: true, data: sessions };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function ObterSessaoAlphaSeoSam(input: unknown) {
  try {
    const data = z
      .object({ projectId: z.string().min(1), sessionId: z.string().min(1) })
      .strict()
      .parse(input);
    const access = await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "seo:read",
    });
    const session = await db.alphaSeoSamSession.findFirst({
      where: {
        id: data.sessionId,
        projectId: data.projectId,
        userId: access.userId,
      },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
    });
    if (!session) throw new Error("SAM_SESSION_NOT_FOUND");
    return { success: true, data: session };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function ArquivarSessaoAlphaSeoSam(input: unknown) {
  try {
    const data = z
      .object({ projectId: z.string().min(1), sessionId: z.string().min(1) })
      .strict()
      .parse(input);
    const access = await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    const changed = await db.alphaSeoSamSession.updateMany({
      where: {
        id: data.sessionId,
        projectId: data.projectId,
        userId: access.userId,
      },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    if (changed.count !== 1) throw new Error("SAM_SESSION_NOT_FOUND");
    return { success: true, data: { archived: true } };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function CancelarSessaoAlphaSeoSam(input: unknown) {
  try {
    const data = z
      .object({ projectId: z.string().min(1), sessionId: z.string().min(1) })
      .strict()
      .parse(input);
    const access = await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    const changed = await db.alphaSeoSamSession.updateMany({
      where: {
        id: data.sessionId,
        projectId: data.projectId,
        userId: access.userId,
        status: "ACTIVE",
      },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    return { success: true, data: { cancelled: changed.count === 1 } };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function AprovarCustoAlphaSeoSam(input: unknown) {
  try {
    const data = z
      .object({
        projectId: z.string().min(1),
        message: z.string().min(1).max(10000),
      })
      .strict()
      .parse(input);
    const access = await requireAlphaSeoProjectAccess({
      projectId: data.projectId,
      action: "seo:execute",
      minimumRole: "EDITOR",
    });
    const { requestHash, estimatedMicrosUsd } = samCost(data.message);
    const approval = await db.alphaSeoCostApproval.upsert({
      where: {
        projectId_userId_operation_requestHash: {
          projectId: data.projectId,
          userId: access.userId,
          operation: "SAM_CHAT",
          requestHash,
        },
      },
      create: {
        projectId: data.projectId,
        userId: access.userId,
        operation: "SAM_CHAT",
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
      data: { approvalId: approval.id, expiresAt: approval.expiresAt, estimatedMicrosUsd },
    };
  } catch (error) {
    return {
      success: false,
      error: safeAlphaSeoActionError(error),
    };
  }
}
export async function DescobrirSkillsAlphaSeoSam(query?: string) {
  try {
    await requireAlphaSeoModuleAccess();
    const parsed = z.string().trim().max(100).optional().parse(query);
    return { success: true, data: discoverAlphaSeoSkills(parsed) };
  } catch (error) {
    return { success: false, error: safeAlphaSeoActionError(error) };
  }
}
