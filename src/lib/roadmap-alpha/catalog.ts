import { z } from "zod";

import db from "@/lib/prisma";
import { MODULOS_REGISTRY, type ModuloRegistryItem } from "@/lib/modulos-registry";

export interface RoadmapModuleSnapshot {
  id: string;
  label: string;
  href: string;
  category: string;
  permission: string | null;
}

export interface RoadmapCatalogIssue {
  code: "DUPLICATE_ID" | "INVALID_ITEM";
  index: number;
  moduleId?: string;
  fields?: string[];
}

export interface RoadmapCatalogAudit {
  ok: boolean;
  count: number;
  snapshot: RoadmapModuleSnapshot[];
  issues: RoadmapCatalogIssue[];
}

const moduleSnapshotSchema = z.object({
  id: z.string().trim().min(1).max(80).refine((value) => !/[\\/]/.test(value)),
  label: z.string().trim().min(1).max(140),
  href: z.string().trim().min(1).max(300).refine((value) => value.startsWith("/PainelAlpha")),
  category: z.string().trim().min(1).max(60),
  permission: z.string().trim().min(1).max(80).nullable(),
}).strict();

function snapshotModule(item: ModuloRegistryItem): RoadmapModuleSnapshot {
  return { id: item.id, label: item.label, href: item.href, category: item.category, permission: item.permission };
}

function normalizedModuleId(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("pt-BR");
}

/** Catálogo completo do Roadmap, sem filtros da sidebar. */
export function getRoadmapModuleCatalog(
  registry: readonly ModuloRegistryItem[] = MODULOS_REGISTRY,
): RoadmapModuleSnapshot[] {
  return registry.map(snapshotModule);
}

/** Auditoria read-only do registry; nunca persiste nem normaliza a fonte. */
export function auditRoadmapModuleCatalog(
  registry: readonly ModuloRegistryItem[] = MODULOS_REGISTRY,
): RoadmapCatalogAudit {
  const snapshot = getRoadmapModuleCatalog(registry);
  const issues: RoadmapCatalogIssue[] = [];
  const ids = new Map<string, number>();

  snapshot.forEach((item, index) => {
    const parsed = moduleSnapshotSchema.safeParse(item);
    if (!parsed.success) {
      issues.push({
        code: "INVALID_ITEM",
        index,
        moduleId: typeof item.id === "string" ? item.id : undefined,
        fields: Array.from(new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "item")))).sort(),
      });
    }

    if (typeof item.id !== "string") return;
    const normalized = normalizedModuleId(item.id);
    if (ids.has(normalized)) {
      issues.push({ code: "DUPLICATE_ID", index, moduleId: item.id, fields: ["id"] });
    } else {
      ids.set(normalized, index);
    }
  });

  return { ok: issues.length === 0, count: snapshot.length, snapshot, issues };
}

export function getRoadmapModuleKeys(): ReadonlySet<string> {
  return new Set(getRoadmapModuleCatalog().map((module) => module.id));
}

/** Snapshot de RoadmapWorkspace ativos no mesmo formato de módulo do Roadmap. */
export async function getRoadmapWorkspaceModules(): Promise<
  RoadmapModuleSnapshot[]
> {
  const workspaces = await db.roadmapWorkspace.findMany({
    where: { archivedAt: null },
    select: { moduleKey: true, label: true },
    orderBy: { createdAt: "asc" },
  });
  return workspaces.map((workspace) => ({
    id: workspace.moduleKey,
    label: workspace.label,
    href: `/PainelAlpha/Roadmap`,
    category: "externo",
    permission: null,
  }));
}

/** Catálogo combinado: MODULOS_REGISTRY (estático) + RoadmapWorkspace ativos (dinâmico). */
export async function getRoadmapModuleCatalogWithWorkspaces(): Promise<
  RoadmapModuleSnapshot[]
> {
  const [internal, external] = await Promise.all([
    getRoadmapModuleCatalog(),
    getRoadmapWorkspaceModules(),
  ]);
  return [...internal, ...external];
}

/**
 * Validação de moduleKey a ser usada em Server Actions, DEPOIS do parse Zod
 * (que não valida mais isso — ver contracts.ts). Aceita tanto módulos
 * internos (MODULOS_REGISTRY) quanto workspaces externos ativos.
 */
export async function isValidRoadmapModuleKey(
  moduleKey: string,
): Promise<boolean> {
  if (getRoadmapModuleKeys().has(moduleKey)) return true;
  const workspace = await db.roadmapWorkspace.findFirst({
    where: { moduleKey, archivedAt: null },
    select: { id: true },
  });
  return Boolean(workspace);
}
