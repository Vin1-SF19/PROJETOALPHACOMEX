"use server";

import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import db from "@/lib/prisma";
import { requireRoadmapAccess } from "@/lib/roadmap-alpha/authorization";
import {
  assertWorkspaceRootPathUsable,
  listWorkspaceDirectories,
} from "@/lib/roadmap-alpha/workspace-browser";

const ROUTE = "/PainelAlpha/Roadmap";

const labelSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(
    /^[\p{L}0-9][\p{L}0-9 .'-]*$/u,
    "Use apenas letras, números, espaço, ponto, hífen ou apóstrofo",
  );
const WINDOWS_RESERVED_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);
const moduleKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Identificador inválido")
  .refine(
    (value) => !WINDOWS_RESERVED_NAMES.has(value),
    "Identificador reservado pelo sistema operacional",
  );
const rootPathSchema = z.string().trim().min(1).max(500);
const workspaceIdSchema = z.string().cuid();

function publicError(error: unknown): string {
  if (
    error instanceof Error &&
    ["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)
  )
    return "Não autorizado";
  if (error instanceof Error && error.message === "WORKSPACE_PATH_INVALID")
    return "Selecione uma pasta válida através do navegador de diretórios";
  if (error instanceof Error && error.message === "WORKSPACE_PATH_UNAVAILABLE")
    return "A pasta selecionada não existe ou não está acessível";
  if (error instanceof Error && error.message === "MODULE_KEY_TAKEN")
    return "Já existe um projeto com este identificador";
  if (error instanceof Error && error.message === "ROOT_PATH_TAKEN")
    return "Já existe um projeto registrado para esta pasta";
  if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND")
    return "Projeto não encontrado";
  return "Não foi possível concluir a operação";
}

export async function NavegarDiretoriosRoadmapWorkspace(
  requestedPath: unknown,
) {
  try {
    await requireRoadmapAccess(true);
    const targetPath =
      typeof requestedPath === "string" && requestedPath.trim()
        ? requestedPath
        : undefined;
    const listing = await listWorkspaceDirectories(targetPath);
    return { success: true as const, listing };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

export async function ListarRoadmapWorkspaces() {
  try {
    const access = await requireRoadmapAccess();
    const workspaces = await db.roadmapWorkspace.findMany({
      where: { archivedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        moduleKey: true,
        label: true,
        rootPath: true,
        status: true,
        createdAt: true,
        createdBy: { select: { id: true, nome: true } },
      },
    });
    return {
      success: true as const,
      canMutate: access.canMutate,
      data: workspaces.map((workspace) => ({
        id: workspace.id,
        moduleKey: workspace.moduleKey,
        label: workspace.label,
        rootPath: access.canMutate ? workspace.rootPath : null,
        status: workspace.status,
        createdAt: workspace.createdAt.toISOString(),
        createdBy: workspace.createdBy,
      })),
    };
  } catch (error) {
    return { success: false as const, error: publicError(error), data: [] };
  }
}

export async function CriarRoadmapWorkspace(payload: unknown) {
  try {
    const access = await requireRoadmapAccess(true);
    const input = z
      .object({
        label: labelSchema,
        moduleKey: moduleKeySchema,
        rootPath: rootPathSchema,
      })
      .strict()
      .parse(payload);
    await assertWorkspaceRootPathUsable(input.rootPath);
    const taken = await db.roadmapWorkspace.findUnique({
      where: { moduleKey: input.moduleKey },
      select: { id: true },
    });
    if (taken) throw new Error("MODULE_KEY_TAKEN");
    const normalizedRootPath = path
      .win32.normalize(path.win32.resolve(input.rootPath))
      .toLowerCase();
    const existingWorkspaces = await db.roadmapWorkspace.findMany({
      where: { archivedAt: null },
      select: { rootPath: true },
    });
    const rootPathTaken = existingWorkspaces.some(
      (item) =>
        path.win32.normalize(path.win32.resolve(item.rootPath)).toLowerCase() ===
        normalizedRootPath,
    );
    if (rootPathTaken) throw new Error("ROOT_PATH_TAKEN");
    const workspace = await db.roadmapWorkspace.create({
      data: {
        moduleKey: input.moduleKey,
        label: input.label,
        rootPath: input.rootPath,
        createdById: access.userId,
      },
      select: { id: true },
    });
    revalidatePath(ROUTE);
    revalidatePath("/PainelAlpha");
    return { success: true as const, id: workspace.id };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { success: false as const, error: "Revise os dados do projeto" };
    return { success: false as const, error: publicError(error) };
  }
}

export async function ArquivarRoadmapWorkspace(workspaceId: unknown) {
  try {
    await requireRoadmapAccess(true);
    const id = workspaceIdSchema.parse(workspaceId);
    const workspace = await db.roadmapWorkspace.findUnique({
      where: { id },
      select: { id: true, archivedAt: true },
    });
    if (!workspace || workspace.archivedAt)
      throw new Error("WORKSPACE_NOT_FOUND");
    await db.roadmapWorkspace.update({
      where: { id },
      data: { archivedAt: new Date(), status: "ARQUIVADO" },
    });
    revalidatePath(ROUTE);
    revalidatePath("/PainelAlpha");
    return { success: true as const };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { success: false as const, error: "Identificador inválido" };
    return { success: false as const, error: publicError(error) };
  }
}
