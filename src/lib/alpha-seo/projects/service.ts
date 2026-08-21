import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import {
  requireAlphaSeoModuleAccess,
  requireAlphaSeoProjectAccess,
} from "@/lib/alpha-seo/project-access";
import {
  alphaSeoInviteAcceptSchema,
  alphaSeoInviteCreateSchema,
  alphaSeoInviteRevokeSchema,
  alphaSeoMemberRemoveSchema,
  alphaSeoMemberUpdateSchema,
  alphaSeoOwnershipTransferSchema,
  alphaSeoProjectCreateSchema,
  alphaSeoProjectIdSchema,
  alphaSeoProjectListSchema,
  alphaSeoProjectUpdateSchema,
} from "./schemas";
import { normalizeAlphaSeoDomain, normalizeAlphaSeoEmail } from "./normalize";

const projectSelect = {
  id: true,
  ownerId: true,
  name: true,
  domain: true,
  normalizedDomain: true,
  locationCode: true,
  locationName: true,
  languageCode: true,
  market: true,
  status: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, nome: true, email: true } },
  _count: { select: { members: true, savedKeywords: true, rankConfigs: true, audits: true } },
} satisfies Prisma.AlphaSeoProjectSelect;

function invitationHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function listAlphaSeoProjects(input: unknown) {
  const access = await requireAlphaSeoModuleAccess();
  const parsed = alphaSeoProjectListSchema.parse(input ?? {});
  const status = parsed.archived ? "ARCHIVED" : "ACTIVE";
  const ownership: Prisma.AlphaSeoProjectWhereInput | undefined = access.isAdmin
    ? undefined
    : {
        OR: [
          { ownerId: access.userId },
          { members: { some: { userId: access.userId, active: true } } },
        ],
      };
  const search: Prisma.AlphaSeoProjectWhereInput | undefined = parsed.search
    ? {
        OR: [
          { name: { contains: parsed.search } },
          { normalizedDomain: { contains: parsed.search.toLowerCase() } },
        ],
      }
    : undefined;
  const where: Prisma.AlphaSeoProjectWhereInput = {
    status,
    AND: [ownership, search].filter(
      (condition): condition is Prisma.AlphaSeoProjectWhereInput => Boolean(condition),
    ),
  };
  const [rows, total] = await Promise.all([
    db.alphaSeoProject.findMany({
      where,
      select: projectSelect,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (parsed.page - 1) * parsed.limit,
      take: parsed.limit,
    }),
    db.alphaSeoProject.count({ where }),
  ]);
  return { rows, pagination: { page: parsed.page, limit: parsed.limit, total, totalPages: Math.ceil(total / parsed.limit) } };
}

export async function createAlphaSeoProject(input: unknown) {
  const access = await requireAlphaSeoModuleAccess();
  const parsed = alphaSeoProjectCreateSchema.parse(input);
  const normalizedDomain = normalizeAlphaSeoDomain(parsed.domain);
  return db.$transaction(async (tx) => {
    const project = await tx.alphaSeoProject.create({
      data: {
        ownerId: access.userId,
        name: parsed.name,
        domain: normalizedDomain,
        normalizedDomain,
        locationCode: parsed.locationCode,
        locationName: parsed.locationName ?? null,
        languageCode: parsed.languageCode,
        market: parsed.market.toUpperCase(),
        members: { create: { userId: access.userId, role: "OWNER", active: true } },
        activation: { create: {} },
      },
      select: projectSelect,
    });
    await tx.alphaSeoAuditEvent.create({
      data: {
        projectId: project.id,
        userId: access.userId,
        action: "PROJECT_CREATED",
        entityType: "PROJECT",
        entityId: project.id,
        requestId: crypto.randomUUID(),
        metadata: { domain: normalizedDomain },
      },
    });
    return project;
  });
}

export async function updateAlphaSeoProject(input: unknown) {
  const parsed = alphaSeoProjectUpdateSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess(parsed.projectId, "project:update");
  const data: Prisma.AlphaSeoProjectUpdateInput = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.domain !== undefined) {
    const domain = normalizeAlphaSeoDomain(parsed.domain);
    data.domain = domain;
    data.normalizedDomain = domain;
  }
  if (parsed.locationCode !== undefined) data.locationCode = parsed.locationCode;
  if (parsed.locationName !== undefined) data.locationName = parsed.locationName;
  if (parsed.languageCode !== undefined) data.languageCode = parsed.languageCode;
  if (parsed.market !== undefined) data.market = parsed.market.toUpperCase();
  return db.$transaction(async (tx) => {
    const project = await tx.alphaSeoProject.update({ where: { id: parsed.projectId }, data, select: projectSelect });
    await tx.alphaSeoAuditEvent.create({ data: { projectId: project.id, userId: access.userId, action: "PROJECT_UPDATED", entityType: "PROJECT", entityId: project.id, requestId: crypto.randomUUID() } });
    return project;
  });
}

export async function archiveAlphaSeoProject(input: unknown) {
  const { projectId } = alphaSeoProjectIdSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess(projectId, "project:archive");
  if (!access.isAdmin) {
    const activeOwned = await db.alphaSeoProject.count({ where: { ownerId: access.userId, status: "ACTIVE" } });
    if (activeOwned <= 1) throw new Error("Você não pode arquivar seu único projeto ativo");
  }
  return db.$transaction(async (tx) => {
    const project = await tx.alphaSeoProject.update({ where: { id: projectId }, data: { status: "ARCHIVED", archivedAt: new Date() }, select: projectSelect });
    await tx.alphaSeoAuditEvent.create({ data: { projectId, userId: access.userId, action: "PROJECT_ARCHIVED", entityType: "PROJECT", entityId: projectId, requestId: crypto.randomUUID() } });
    return project;
  });
}

export async function restoreAlphaSeoProject(input: unknown) {
  const { projectId } = alphaSeoProjectIdSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess(projectId, "project:archive", { allowArchived: true });
  return db.$transaction(async (tx) => {
    const project = await tx.alphaSeoProject.update({ where: { id: projectId }, data: { status: "ACTIVE", archivedAt: null }, select: projectSelect });
    await tx.alphaSeoAuditEvent.create({ data: { projectId, userId: access.userId, action: "PROJECT_RESTORED", entityType: "PROJECT", entityId: projectId, requestId: crypto.randomUUID() } });
    return project;
  });
}

export async function listAlphaSeoProjectMembers(input: unknown) {
  const { projectId } = alphaSeoProjectIdSchema.parse(input);
  await requireAlphaSeoProjectAccess(projectId, "project:read", { allowArchived: true });
  return db.alphaSeoProjectMember.findMany({
    where: { projectId, active: true },
    select: { id: true, userId: true, role: true, createdAt: true, updatedAt: true, user: { select: { nome: true, email: true, imagemUrl: true } } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    take: 200,
  });
}

export async function inviteAlphaSeoProjectMember(input: unknown) {
  const parsed = alphaSeoInviteCreateSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess(parsed.projectId, "member:manage");
  const normalizedEmail = normalizeAlphaSeoEmail(parsed.email);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + parsed.expiresInHours * 3_600_000);
  const existingUser = await db.usuarios.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
  if (existingUser) {
    const existingMember = await db.alphaSeoProjectMember.findUnique({ where: { projectId_userId: { projectId: parsed.projectId, userId: existingUser.id } }, select: { active: true } });
    if (existingMember?.active) throw new Error("Este usuário já é membro do projeto");
  }
  const invitation = await db.$transaction(async (tx) => {
    const created = await tx.alphaSeoProjectInvitation.create({
      data: { projectId: parsed.projectId, email: parsed.email.trim(), normalizedEmail, role: parsed.role, tokenHash: invitationHash(token), inviterId: access.userId, expiresAt },
      select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true },
    });
    await tx.alphaSeoAuditEvent.create({
      data: { projectId: parsed.projectId, userId: access.userId, action: "MEMBER_INVITED", entityType: "INVITATION", entityId: created.id, requestId: crypto.randomUUID(), metadata: { role: parsed.role } },
    });
    return created;
  });
  return { invitation, token };
}

export async function acceptAlphaSeoProjectInvitation(input: unknown) {
  const parsed = alphaSeoInviteAcceptSchema.parse(input);
  const access = await requireAlphaSeoModuleAccess();
  const now = new Date();
  return db.$transaction(async (tx) => {
    const invitation = await tx.alphaSeoProjectInvitation.findUnique({
      where: { tokenHash: invitationHash(parsed.token) },
      select: { id: true, projectId: true, normalizedEmail: true, role: true, status: true, expiresAt: true },
    });
    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= now) throw new Error("Convite inválido ou expirado");
    if (invitation.normalizedEmail !== normalizeAlphaSeoEmail(access.email)) throw new Error("Este convite pertence a outro e-mail");
    await tx.alphaSeoProjectMember.upsert({
      where: { projectId_userId: { projectId: invitation.projectId, userId: access.userId } },
      create: { projectId: invitation.projectId, userId: access.userId, role: invitation.role, active: true },
      update: { role: invitation.role, active: true },
    });
    await tx.alphaSeoProjectInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED", acceptedById: access.userId, acceptedAt: now } });
    await tx.alphaSeoAuditEvent.create({
      data: { projectId: invitation.projectId, userId: access.userId, action: "MEMBER_INVITATION_ACCEPTED", entityType: "INVITATION", entityId: invitation.id, requestId: crypto.randomUUID(), metadata: { role: invitation.role } },
    });
    return { projectId: invitation.projectId, role: invitation.role };
  });
}

export async function updateAlphaSeoProjectMember(input: unknown) {
  const parsed = alphaSeoMemberUpdateSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess(parsed.projectId, "member:manage");
  const project = await db.alphaSeoProject.findUnique({ where: { id: parsed.projectId }, select: { ownerId: true } });
  if (project?.ownerId === parsed.memberUserId) throw new Error("O papel do proprietário não pode ser alterado");
  return db.$transaction(async (tx) => {
    const member = await tx.alphaSeoProjectMember.update({ where: { projectId_userId: { projectId: parsed.projectId, userId: parsed.memberUserId } }, data: { role: parsed.role, active: true }, select: { id: true, userId: true, role: true, active: true, updatedAt: true } });
    await tx.alphaSeoAuditEvent.create({ data: { projectId: parsed.projectId, userId: access.userId, action: "MEMBER_ROLE_UPDATED", entityType: "MEMBER", entityId: member.id, requestId: crypto.randomUUID(), metadata: { role: parsed.role } } });
    return member;
  });
}

export async function removeAlphaSeoProjectMember(input: unknown) {
  const parsed = alphaSeoMemberRemoveSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess(parsed.projectId, "member:manage");
  const project = await db.alphaSeoProject.findUnique({ where: { id: parsed.projectId }, select: { ownerId: true } });
  if (project?.ownerId === parsed.memberUserId) throw new Error("O proprietário não pode ser removido");
  return db.$transaction(async (tx) => {
    const result = await tx.alphaSeoProjectMember.updateMany({ where: { projectId: parsed.projectId, userId: parsed.memberUserId, active: true }, data: { active: false } });
    if (result.count === 1) await tx.alphaSeoAuditEvent.create({ data: { projectId: parsed.projectId, userId: access.userId, action: "MEMBER_REMOVED", entityType: "MEMBER", entityId: String(parsed.memberUserId), requestId: crypto.randomUUID() } });
    return { removed: result.count === 1 };
  });
}

export async function transferAlphaSeoProjectOwnership(input: unknown) {
  const parsed = alphaSeoOwnershipTransferSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess(parsed.projectId, "member:manage");
  return db.$transaction(async (tx) => {
    const project = await tx.alphaSeoProject.findUnique({ where: { id: parsed.projectId }, select: { ownerId: true } });
    if (!project) throw new Error("Projeto não encontrado");
    if (project.ownerId === parsed.newOwnerUserId) throw new Error("Este usuário já é o proprietário");
    const nextOwner = await tx.alphaSeoProjectMember.findUnique({ where: { projectId_userId: { projectId: parsed.projectId, userId: parsed.newOwnerUserId } }, select: { id: true, active: true } });
    if (!nextOwner?.active) throw new Error("O novo proprietário precisa ser membro ativo do projeto");
    await tx.alphaSeoProject.update({ where: { id: parsed.projectId }, data: { ownerId: parsed.newOwnerUserId } });
    await tx.alphaSeoProjectMember.update({ where: { projectId_userId: { projectId: parsed.projectId, userId: parsed.newOwnerUserId } }, data: { role: "OWNER", active: true } });
    await tx.alphaSeoProjectMember.upsert({
      where: { projectId_userId: { projectId: parsed.projectId, userId: project.ownerId } },
      create: { projectId: parsed.projectId, userId: project.ownerId, role: parsed.previousOwnerRole, active: true },
      update: { role: parsed.previousOwnerRole, active: true },
    });
    await tx.alphaSeoAuditEvent.create({ data: { projectId: parsed.projectId, userId: access.userId, action: "PROJECT_OWNERSHIP_TRANSFERRED", entityType: "PROJECT", entityId: parsed.projectId, requestId: crypto.randomUUID(), metadata: { previousOwnerId: project.ownerId, newOwnerId: parsed.newOwnerUserId, previousOwnerRole: parsed.previousOwnerRole } } });
    return { projectId: parsed.projectId, previousOwnerId: project.ownerId, ownerId: parsed.newOwnerUserId };
  });
}

export async function revokeAlphaSeoProjectInvitation(input: unknown) {
  const parsed = alphaSeoInviteRevokeSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess(parsed.projectId, "member:manage");
  return db.$transaction(async (tx) => {
    const result = await tx.alphaSeoProjectInvitation.updateMany({ where: { id: parsed.invitationId, projectId: parsed.projectId, status: "PENDING" }, data: { status: "REVOKED", revokedAt: new Date() } });
    if (result.count === 1) await tx.alphaSeoAuditEvent.create({ data: { projectId: parsed.projectId, userId: access.userId, action: "MEMBER_INVITATION_REVOKED", entityType: "INVITATION", entityId: parsed.invitationId, requestId: crypto.randomUUID() } });
    return { revoked: result.count === 1 };
  });
}
