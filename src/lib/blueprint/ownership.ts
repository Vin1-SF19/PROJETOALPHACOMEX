import db from "@/lib/prisma";

import { isAdminRole } from "@/lib/roles";

export type BlueprintAcao =
  | "visualizar"
  | "editarDadosGerais"
  | "editarDocumento"
  | "editarCanvas"
  | "enviarArquivo"
  | "excluirArquivo"
  | "criarRequisito"
  | "alterarStatus"
  | "definirPrioridade"
  | "adicionarParticipantes"
  | "usarIA"
  | "arquivar"
  | "excluir"
  | "visualizarAuditoria";

const PERMISSOES_POR_ROLE: Record<string, BlueprintAcao[]> = {
  PROPRIETARIO: [
    "visualizar", "editarDadosGerais", "editarDocumento", "editarCanvas",
    "enviarArquivo", "excluirArquivo", "criarRequisito", "alterarStatus",
    "definirPrioridade", "adicionarParticipantes", "usarIA", "arquivar",
    "excluir", "visualizarAuditoria",
  ],
  ADMINISTRADOR: [
    "visualizar", "editarDadosGerais", "editarDocumento", "editarCanvas",
    "enviarArquivo", "excluirArquivo", "criarRequisito", "alterarStatus",
    "definirPrioridade", "adicionarParticipantes", "usarIA", "arquivar",
    "visualizarAuditoria",
  ],
  EDITOR: [
    "visualizar", "editarDocumento", "editarCanvas", "enviarArquivo",
    "criarRequisito", "usarIA",
  ],
  COMENTARISTA: ["visualizar", "usarIA"],
  VISUALIZADOR: ["visualizar"],
};

export interface AcessoBlueprint {
  autorizado: boolean;
  isAdminGlobal: boolean;
  role: string | null;
}

/**
 * Fonte única de ownership do módulo Alpha Blueprint. Nunca confia em role/permissão
 * vinda do cliente — sempre resolve do banco a partir de userId + projectId.
 * Admin/CEO globais têm acesso pleno a qualquer projeto (mesmo padrão do resto do painel).
 */
export async function checarAcessoBlueprint(
  projectId: string,
  userId: number,
  userRoleGlobal: string | null,
  acao: BlueprintAcao,
): Promise<AcessoBlueprint> {
  if (isAdminRole(userRoleGlobal)) {
    return { autorizado: true, isAdminGlobal: true, role: "ADMINISTRADOR" };
  }

  const membro = await db.blueprintMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });

  if (!membro) return { autorizado: false, isAdminGlobal: false, role: null };

  const permitido = PERMISSOES_POR_ROLE[membro.role]?.includes(acao) ?? false;
  return { autorizado: permitido, isAdminGlobal: false, role: membro.role };
}

/** Lança erro padronizado se o acesso não for autorizado — usar no início de toda action. */
export async function exigirAcessoBlueprint(
  projectId: string,
  userId: number,
  userRoleGlobal: string | null,
  acao: BlueprintAcao,
): Promise<AcessoBlueprint> {
  const acesso = await checarAcessoBlueprint(projectId, userId, userRoleGlobal, acao);
  if (!acesso.autorizado) {
    throw new Error("Não autorizado");
  }
  return acesso;
}

export { isAdminRole } from "@/lib/roles";
