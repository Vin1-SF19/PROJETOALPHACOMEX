import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

import { auth } from "../../../auth";

export const MESCLAGEM_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
} as const;

export const PERMISSAO_MESCLAGEM = "mesclagemPlanilhas";

export type ResultadoAutorizacaoMesclagem =
  | { autorizado: true; userId: number }
  | {
      autorizado: false;
      userId: number | null;
      status: 401 | 403;
      code: "UNAUTHORIZED" | "FORBIDDEN";
    };

export async function verificarAcessoMesclagem(): Promise<ResultadoAutorizacaoMesclagem> {
  const session = await auth();
  const userId = Number(session?.user?.id);

  if (!session?.user?.id || !Number.isSafeInteger(userId) || userId <= 0) {
    return { autorizado: false, userId: null, status: 401, code: "UNAUTHORIZED" };
  }

  const usuarioAtual = await db.usuarios.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (usuarioAtual?.status !== "ATIVO") {
    return { autorizado: false, userId, status: 403, code: "FORBIDDEN" };
  }

  if (!isAdminRole(usuarioAtual.role)) {
    const permissoes = await getPermissoesEfetivas(userId);
    if (permissoes.includes(PERMISSAO_MESCLAGEM)) return { autorizado: true, userId };
    return { autorizado: false, userId, status: 403, code: "FORBIDDEN" };
  }

  return { autorizado: true, userId };
}

export async function registrarAuditoriaMesclagemBestEffort(
  userId: number,
  acao: string,
  detalhes: string,
): Promise<void> {
  try {
    await db.auditoria.create({
      data: { userId, acao, detalhes },
      select: { id: true },
    });
  } catch {
    // Auditoria não deve expor dados nem alterar o resultado da operação.
  }
}
