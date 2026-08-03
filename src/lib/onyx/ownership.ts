import db from "@/lib/prisma";
import { isAdminRole as hasAdminAccess } from "@/lib/roles";

/**
 * Propriedade de agentes Onyx por usuário do PainelAlpha.
 *
 * Como o Onyx usa UMA conta de serviço (PAT único), todos os agentes vivem sob
 * o mesmo usuário Onyx. Para amarrar cada agente ao usuário do Painel que o
 * criou — sem precisar criar usuários no Onyx — registramos o vínculo na tabela
 * onyx_agent_owner. Listagem e edição/exclusão passam a respeitar o dono.
 */

export function isAdminRole(role: string): boolean {
  return hasAdminAccess(role);
}

/** Registra (ou atualiza) o dono e a visibilidade de um agente. */
export async function recordAgentOwner(
  onyxAgentId: number,
  userId: number,
  agentName?: string,
  isPublic?: boolean,
): Promise<void> {
  await db.onyxAgentOwner.upsert({
    where: { onyxAgentId },
    // userId só é definido na criação; em updates não muda o dono original
    create: { onyxAgentId, userId, agentName: agentName ?? null, isPublic: isPublic ?? false },
    update: { agentName: agentName ?? null, isPublic: isPublic ?? false },
  });
}

/** True se o usuário é dono do agente. */
export async function userOwnsAgent(onyxAgentId: number, userId: number): Promise<boolean> {
  const owner = await db.onyxAgentOwner.findUnique({ where: { onyxAgentId } });
  return !!owner && owner.userId === userId;
}

export interface AgentOwnerInfo {
  userId: number;
  userName: string | null;
  isPublic: boolean;
}

/** Mapa onyxAgentId → dono (nome + visibilidade), para enriquecer a listagem. */
export async function getOwnerInfoMap(): Promise<Map<number, AgentOwnerInfo>> {
  const rows = await db.onyxAgentOwner.findMany({
    select: {
      onyxAgentId: true,
      userId: true,
      isPublic: true,
      user: { select: { nome: true } },
    },
  });
  return new Map(
    rows.map(r => [r.onyxAgentId, { userId: r.userId, userName: r.user?.nome ?? null, isPublic: r.isPublic }]),
  );
}

/** Remove o vínculo de propriedade (após excluir o agente no Onyx). */
export async function removeAgentOwner(onyxAgentId: number): Promise<void> {
  await db.onyxAgentOwner.deleteMany({ where: { onyxAgentId } });
}
