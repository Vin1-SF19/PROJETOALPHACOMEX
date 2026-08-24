"use server";

import { spawn } from "node:child_process";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import db from "@/lib/prisma";
import { requireRoadmapAccess } from "@/lib/roadmap-alpha/authorization";
import { processIsAlive } from "@/lib/roadmap-alpha/process-check";
import {
  assertWorkspaceRootPathUsable,
  listWorkspaceDirectories,
} from "@/lib/roadmap-alpha/workspace-browser";

/**
 * Mata a árvore inteira do processo (supervisor PowerShell + worker tsx
 * filho), não só o PID salvo. process.kill() sozinho não garante isso no
 * Windows — o supervisor pode morrer deixando o worker órfão, ainda
 * escrevendo no diretório do workspace sem nenhum rastro na UI.
 */
function killProcessTree(pid: number): void {
  try {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
    }).unref();
  } catch {
    // Best-effort — se taskkill falhar, ainda tentamos o kill direto abaixo.
  }
  try {
    process.kill(pid);
  } catch {
    // Processo já pode ter encerrado.
  }
}

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
        workerPid: true,
        workerStartedAt: true,
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
        workerRunning: Boolean(
          workspace.workerPid && processIsAlive(workspace.workerPid),
        ),
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
      select: { id: true, archivedAt: true, workerPid: true },
    });
    if (!workspace || workspace.archivedAt)
      throw new Error("WORKSPACE_NOT_FOUND");
    if (workspace.workerPid && processIsAlive(workspace.workerPid))
      killProcessTree(workspace.workerPid);
    await db.roadmapWorkspace.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        status: "ARQUIVADO",
        workerPid: null,
        workerStartedAt: null,
      },
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

export async function IniciarWorkerRoadmapWorkspace(workspaceId: unknown) {
  try {
    await requireRoadmapAccess(true);
    const id = workspaceIdSchema.parse(workspaceId);
    const workspace = await db.roadmapWorkspace.findUnique({
      where: { id },
      select: {
        id: true,
        archivedAt: true,
        rootPath: true,
        workerPid: true,
      },
    });
    if (!workspace || workspace.archivedAt)
      throw new Error("WORKSPACE_NOT_FOUND");
    if (workspace.workerPid && processIsAlive(workspace.workerPid))
      throw new Error("WORKER_ALREADY_RUNNING");
    await assertWorkspaceRootPathUsable(workspace.rootPath);

    // Reserva atômica do "slot" antes de spawnar — o where garante que só UMA
    // requisição concorrente (ex.: double-click) consegue reservar; a outra
    // recebe reservedCount === 0 e não chega a spawnar processo nenhum.
    const reservation = await db.roadmapWorkspace.updateMany({
      where: { id, workerPid: workspace.workerPid },
      data: { workerPid: -1, workerStartedAt: new Date() },
    });
    if (reservation.count === 0) throw new Error("WORKER_ALREADY_RUNNING");

    const projectRoot = path.resolve(process.cwd());
    const scriptPath = path.resolve(
      projectRoot,
      "scripts",
      "roadmap-production-workspace-worker.ps1",
    );
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-WindowStyle",
          "Hidden",
          "-File",
          scriptPath,
          "-WorkspaceId",
          workspace.id,
          "-WorkerRoot",
          workspace.rootPath,
        ],
        { detached: true, stdio: "ignore", cwd: projectRoot },
      );
      child.unref();
      if (!child.pid) throw new Error("WORKER_SPAWN_FAILED");
    } catch (spawnError) {
      await db.roadmapWorkspace.update({
        where: { id },
        data: { workerPid: null, workerStartedAt: null },
      });
      throw spawnError;
    }

    await db.roadmapWorkspace.update({
      where: { id },
      data: { workerPid: child.pid, workerStartedAt: new Date() },
    });
    revalidatePath(ROUTE);
    return { success: true as const };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { success: false as const, error: "Identificador inválido" };
    if (error instanceof Error && error.message === "WORKER_ALREADY_RUNNING")
      return { success: false as const, error: "O worker já está em execução" };
    return { success: false as const, error: publicError(error) };
  }
}

export async function PararWorkerRoadmapWorkspace(workspaceId: unknown) {
  try {
    await requireRoadmapAccess(true);
    const id = workspaceIdSchema.parse(workspaceId);
    const workspace = await db.roadmapWorkspace.findUnique({
      where: { id },
      select: { id: true, workerPid: true },
    });
    if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");
    if (workspace.workerPid && processIsAlive(workspace.workerPid))
      killProcessTree(workspace.workerPid);
    await db.roadmapWorkspace.update({
      where: { id },
      data: { workerPid: null, workerStartedAt: null },
    });
    revalidatePath(ROUTE);
    return { success: true as const };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { success: false as const, error: "Identificador inválido" };
    return { success: false as const, error: publicError(error) };
  }
}
