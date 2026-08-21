import "server-only";

import { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import {
  requireAlphaSeoModuleAccess,
  requireAlphaSeoProjectAccess,
  type AlphaSeoModuleAccess,
} from "@/lib/alpha-seo/project-access";
import { normalizeAlphaSeoDomain } from "@/lib/alpha-seo/projects/normalize";
import {
  alphaSeoOnboardingAnswersSchema,
  alphaSeoOnboardingContextSchema,
  alphaSeoOnboardingSiteSchema,
} from "./contracts";

async function requireOptionalProject(
  access: AlphaSeoModuleAccess,
  projectId: string | undefined,
) {
  if (!projectId) return;
  await requireAlphaSeoProjectAccess({
    projectId,
    userId: access.userId,
    action: "project:read",
  });
}

export async function getAlphaSeoOnboardingAnswers(input: unknown = {}) {
  const parsed = alphaSeoOnboardingContextSchema.parse(input);
  const access = await requireAlphaSeoModuleAccess();
  await requireOptionalProject(access, parsed.projectId);

  const [onboarding, user] = await Promise.all([
    db.alphaSeoUserOnboarding.findUnique({
      where: { userId: access.userId },
      select: {
        activeProjectId: true,
        interestedFeatures: true,
        workFor: true,
        clientWebsiteCount: true,
        foundVia: true,
        mcpSetupIntent: true,
        completedAt: true,
        gscNudgeDismissedAt: true,
      },
    }),
    db.usuarios.findUnique({
      where: { id: access.userId },
      select: { primeiroAcessoEm: true },
    }),
  ]);

  const features = Array.isArray(onboarding?.interestedFeatures)
    ? onboarding.interestedFeatures.filter(
        (value): value is string => typeof value === "string",
      )
    : [];

  return {
    activeProjectId: onboarding?.activeProjectId ?? null,
    completedAt: onboarding?.completedAt ?? null,
    gscNudgeDismissedAt: onboarding?.gscNudgeDismissedAt ?? null,
    userCreatedAt: user?.primeiroAcessoEm?.toISOString() ?? null,
    answers: {
      interestedFeatures: features,
      workFor: onboarding?.workFor ?? null,
      clientWebsiteCount: onboarding?.clientWebsiteCount ?? null,
      foundVia: onboarding?.foundVia ?? null,
      mcpSetupIntent: onboarding?.mcpSetupIntent ?? null,
    },
  };
}

export async function saveAlphaSeoOnboardingAnswers(input: unknown) {
  const parsed = alphaSeoOnboardingAnswersSchema.parse(input);
  const access = await requireAlphaSeoModuleAccess();
  await requireOptionalProject(access, parsed.projectId);

  const completedAt = parsed.completed ? new Date() : undefined;
  const update: Prisma.AlphaSeoUserOnboardingUpdateInput = {
    ...(parsed.projectId
      ? { activeProject: { connect: { id: parsed.projectId } } }
      : {}),
    ...(parsed.interestedFeatures !== undefined
      ? { interestedFeatures: parsed.interestedFeatures }
      : {}),
    ...(parsed.workFor !== undefined ? { workFor: parsed.workFor } : {}),
    ...(parsed.clientWebsiteCount !== undefined
      ? { clientWebsiteCount: parsed.clientWebsiteCount }
      : {}),
    ...(parsed.foundVia !== undefined ? { foundVia: parsed.foundVia } : {}),
    ...(parsed.mcpSetupIntent !== undefined
      ? { mcpSetupIntent: parsed.mcpSetupIntent }
      : {}),
    ...(completedAt
      ? { completedAt, gscNudgeDismissedAt: completedAt }
      : {}),
  };

  await db.alphaSeoUserOnboarding.upsert({
    where: { userId: access.userId },
    create: {
      userId: access.userId,
      activeProjectId: parsed.projectId,
      interestedFeatures: parsed.interestedFeatures ?? [],
      workFor: parsed.workFor,
      clientWebsiteCount: parsed.clientWebsiteCount,
      foundVia: parsed.foundVia,
      mcpSetupIntent: parsed.mcpSetupIntent,
      completedAt,
      gscNudgeDismissedAt: completedAt,
    },
    update,
  });

  return { ok: true };
}

export async function dismissAlphaSeoGscNudge(input: unknown = {}) {
  const parsed = alphaSeoOnboardingContextSchema.parse(input);
  const access = await requireAlphaSeoModuleAccess();
  await requireOptionalProject(access, parsed.projectId);
  const now = new Date();

  await db.alphaSeoUserOnboarding.upsert({
    where: { userId: access.userId },
    create: {
      userId: access.userId,
      activeProjectId: parsed.projectId,
      interestedFeatures: [],
      gscNudgeDismissedAt: now,
    },
    update: {
      ...(parsed.projectId
        ? { activeProject: { connect: { id: parsed.projectId } } }
        : {}),
      gscNudgeDismissedAt: now,
    },
  });

  return { ok: true };
}

export async function getAlphaSeoOnboardingChatState(input: unknown = {}) {
  const parsed = alphaSeoOnboardingContextSchema.parse(input);
  const access = await requireAlphaSeoModuleAccess();

  if (parsed.projectId) {
    await requireAlphaSeoProjectAccess({
      projectId: parsed.projectId,
      userId: access.userId,
      action: "project:read",
    });
  }

  let projectId = parsed.projectId;
  if (projectId === undefined) {
    const onboarding = await db.alphaSeoUserOnboarding.findUnique({
      where: { userId: access.userId },
      select: { activeProjectId: true },
    });
    if (onboarding?.activeProjectId) {
      const active = await db.alphaSeoProject.findFirst({
        where: {
          id: onboarding.activeProjectId,
          status: "ACTIVE",
          OR: [
            { ownerId: access.userId },
            { members: { some: { userId: access.userId, active: true } } },
          ],
        },
        select: { id: true },
      });
      projectId = active?.id;
    }
  }

  if (!projectId) {
    const project = await db.alphaSeoProject.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          { ownerId: access.userId },
          { members: { some: { userId: access.userId, active: true } } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    projectId = project?.id;
  }

  if (!projectId) throw new Error("Projeto Alpha SEO não encontrado");
  if (!parsed.projectId) {
    await requireAlphaSeoProjectAccess({
      projectId,
      userId: access.userId,
      action: "project:read",
    });
  }
  const project = await db.alphaSeoProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      domain: true,
      locationCode: true,
      locationName: true,
      languageCode: true,
      market: true,
    },
  });
  if (!project) throw new Error("Projeto Alpha SEO não encontrado");

  return { projectId: project.id, domain: project.domain, project };
}

export async function saveAlphaSeoOnboardingSite(input: unknown) {
  const parsed = alphaSeoOnboardingSiteSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess({
    projectId: parsed.projectId,
    action: "project:update",
    minimumRole: "EDITOR",
  });
  const domain = normalizeAlphaSeoDomain(parsed.domain);
  if (!domain) throw new Error("Informe um domínio válido");

  const current = await db.alphaSeoProject.findUnique({
    where: { id: parsed.projectId },
    select: { languageCode: true, market: true },
  });
  if (!current) throw new Error("Projeto Alpha SEO não encontrado");

  await db.$transaction(async (tx) => {
    await tx.alphaSeoProject.update({
      where: { id: parsed.projectId },
      data: {
        domain,
        normalizedDomain: domain,
        locationCode: parsed.locationCode,
        locationName: parsed.locationName,
        languageCode: parsed.languageCode ?? current.languageCode,
        market: (parsed.market ?? current.market).toUpperCase(),
      },
      select: { id: true },
    });
    await tx.alphaSeoUserOnboarding.upsert({
      where: { userId: access.userId },
      create: {
        userId: access.userId,
        activeProjectId: parsed.projectId,
        interestedFeatures: [],
      },
      update: { activeProjectId: parsed.projectId },
      select: { userId: true },
    });
    await tx.alphaSeoAuditEvent.create({
      data: {
        projectId: parsed.projectId,
        userId: access.userId,
        action: "ONBOARDING_SITE_UPDATED",
        entityType: "PROJECT",
        entityId: parsed.projectId,
        requestId: crypto.randomUUID(),
        metadata: {
          locationCode: parsed.locationCode,
          locationName: parsed.locationName ?? null,
        },
      },
      select: { id: true },
    });
  });

  return { ok: true };
}
