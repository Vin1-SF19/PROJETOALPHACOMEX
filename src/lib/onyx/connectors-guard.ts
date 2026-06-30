import { auth } from "../../../auth";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { isAdminRole } from "@/lib/onyx/ownership";

/** Permissão de módulo que libera a tela de Conectores IAlpha. */
export const CONECTORES_PERMISSION = "conectoresIAlpha";

export interface ConnectorsAuthResult {
  ok: boolean;
  status: number;
  error?: string;
  userId?: number;
  isAdmin?: boolean;
}

/**
 * Guard das rotas /api/onyx/connectors/*.
 *
 * Conectores mexem na base de RAG GLOBAL do Onyx (afeta todos os agentes), por
 * isso o acesso é restrito a Admin/CEO OU a quem tem a permissão de módulo
 * `conectoresIAlpha` (concedida por setor/override na Gestão de Equipe).
 *
 * O PAT de serviço do Onyx NUNCA chega ao cliente — só estas rotas, já
 * autorizadas, falam com o Onyx.
 */
export async function authorizeConnectors(): Promise<ConnectorsAuthResult> {
  const session = await auth();
  const rawId = session?.user?.id;
  if (!rawId) {
    return { ok: false, status: 401, error: "Não autorizado" };
  }

  const userId = Number(rawId);
  const role = (session.user as { role?: string }).role ?? "";
  const admin = isAdminRole(role);

  if (admin) {
    return { ok: true, status: 200, userId, isAdmin: true };
  }

  const perms = await getPermissoesEfetivas(userId);
  if (perms.includes(CONECTORES_PERMISSION)) {
    return { ok: true, status: 200, userId, isAdmin: false };
  }

  return { ok: false, status: 403, error: "Sem permissão para gerenciar conectores." };
}
