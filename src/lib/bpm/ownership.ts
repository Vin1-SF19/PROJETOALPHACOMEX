import db from "@/lib/prisma";

import { isAdminRole } from "@/lib/roles";

export type BpmAcao =
  | "visualizar"
  | "editarCard"
  | "moverEtapa"
  | "criarTarefa"
  | "concluirTarefa"
  | "enviarArquivo"
  | "excluirArquivo"
  | "adicionarParticipantes"
  | "excluirCard"
  | "visualizarHistorico";

const PERMISSOES_POR_ROLE: Record<string, BpmAcao[]> = {
  RESPONSAVEL: [
    "visualizar", "editarCard", "moverEtapa", "criarTarefa", "concluirTarefa",
    "enviarArquivo", "excluirArquivo", "adicionarParticipantes",
    "excluirCard", "visualizarHistorico",
  ],
  ADMINISTRADOR: [
    "visualizar", "editarCard", "moverEtapa", "criarTarefa", "concluirTarefa",
    "enviarArquivo", "excluirArquivo", "adicionarParticipantes",
    "excluirCard", "visualizarHistorico",
  ],
  PARTICIPANTE: ["visualizar", "criarTarefa", "concluirTarefa", "visualizarHistorico"],
};

export interface AcessoBpmCard {
  autorizado: boolean;
  isAdminGlobal: boolean;
  role: string | null;
}

/**
 * Fonte única de ownership do módulo Alpha BPM. Nunca confia em role/permissão
 * vinda do cliente — sempre resolve do banco a partir de userId + cardId.
 * Admin/CEO globais têm acesso pleno a qualquer card (mesmo padrão do Blueprint).
 *
 * Regra de negócio (D-042): apenas o responsável do card ou um administrador
 * pode movê-lo de etapa — participantes têm acesso de leitura/colaboração, não de
 * movimentação. Isso é refletido em PERMISSOES_POR_ROLE: só RESPONSAVEL e
 * ADMINISTRADOR têm "moverEtapa".
 */
export async function checarAcessoBpmCard(
  cardId: string,
  userId: number,
  userRoleGlobal: string | null,
  acao: BpmAcao,
): Promise<AcessoBpmCard> {
  if (isAdminRole(userRoleGlobal)) {
    return { autorizado: true, isAdminGlobal: true, role: "ADMINISTRADOR" };
  }

  const membro = await db.bpmCardMembro.findUnique({
    where: { cardId_userId: { cardId, userId } },
    select: { role: true },
  });

  if (!membro) return { autorizado: false, isAdminGlobal: false, role: null };

  const permitido = PERMISSOES_POR_ROLE[membro.role]?.includes(acao) ?? false;
  return { autorizado: permitido, isAdminGlobal: false, role: membro.role };
}

/** Lança erro padronizado se o acesso não for autorizado — usar no início de toda action. */
export async function exigirAcessoBpmCard(
  cardId: string,
  userId: number,
  userRoleGlobal: string | null,
  acao: BpmAcao,
): Promise<AcessoBpmCard> {
  const acesso = await checarAcessoBpmCard(cardId, userId, userRoleGlobal, acao);
  if (!acesso.autorizado) {
    throw new Error("Não autorizado");
  }
  return acesso;
}

export type BpmAcaoPipeline =
  | "visualizarPipeline"
  | "configurarEtapas"
  | "configurarCampos"
  | "configurarSla"
  | "criarPipeline";

/**
 * Ownership de configuração de pipeline (D-031): apenas administradores globais
 * podem criar/editar etapas, campos, SLA e layout de um pipeline — não há papel
 * intermediário aqui, diferente do ownership por card acima.
 */
export function checarAcessoConfigPipeline(
  userRoleGlobal: string | null,
  _acao: BpmAcaoPipeline,
): boolean {
  return isAdminRole(userRoleGlobal);
}

export function exigirAcessoConfigPipeline(
  userRoleGlobal: string | null,
  acao: BpmAcaoPipeline,
): void {
  if (!checarAcessoConfigPipeline(userRoleGlobal, acao)) {
    throw new Error("Não autorizado — apenas administradores configuram pipelines");
  }
}

export { isAdminRole } from "@/lib/roles";
