import path from "node:path";

import db from "@/lib/prisma";
import { getRoadmapModuleKeys } from "@/lib/roadmap-alpha/catalog";

export interface ProductionWorkspaceScope {
  root: string;
  /** moduleKeys que este worker tem permissão de processar. */
  allowedModuleKeys: ReadonlySet<string>;
  workspaceId: string | null;
}

function normalized(value: string): string {
  return path.win32.normalize(path.win32.resolve(value)).toLowerCase();
}

/**
 * Resolve o escopo de segurança de um worker a partir do seu `root`.
 *
 * root === PainelAlpha (process.cwd() por padrão): escopo é todo o
 * MODULOS_REGISTRY, comportamento idêntico ao worker único de sempre.
 *
 * root === rootPath de um RoadmapWorkspace ativo: escopo é SOMENTE aquele
 * moduleKey — nunca os módulos internos, nunca outro workspace. Este é o
 * ponto crítico de segurança: um worker nunca deve processar objetivo fora
 * do seu próprio escopo, mesmo que a fila global contenha outros.
 */
export async function resolveProductionWorkspaceScope(
  root = process.cwd(),
): Promise<ProductionWorkspaceScope> {
  const painelAlphaRoot = normalized(process.cwd());
  const requestedRoot = normalized(root);

  if (requestedRoot === painelAlphaRoot) {
    return {
      root,
      allowedModuleKeys: getRoadmapModuleKeys(),
      workspaceId: null,
    };
  }

  const workspaces = await db.roadmapWorkspace.findMany({
    where: { archivedAt: null },
    select: { id: true, moduleKey: true, rootPath: true },
  });
  const match = workspaces.find(
    (item) => normalized(item.rootPath) === requestedRoot,
  );

  if (!match) {
    throw new Error("WORKSPACE_ROOT_NOT_REGISTERED");
  }

  return {
    root,
    allowedModuleKeys: new Set([match.moduleKey]),
    workspaceId: match.id,
  };
}
