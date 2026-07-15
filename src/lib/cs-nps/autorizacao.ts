import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";

import { auth } from "../../../auth";

export const CS_NPS_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
} as const;

export type ResultadoAutorizacaoCsNps =
  | { autorizado: true; userId: number }
  | {
      autorizado: false;
      userId: number | null;
      status: 401 | 403;
      code: "UNAUTHORIZED" | "FORBIDDEN";
    };

export async function verificarAcessoAdministrativoCsNps(): Promise<ResultadoAutorizacaoCsNps> {
  const session = await auth();
  const userId = Number(session?.user?.id);

  if (!session?.user?.id || !Number.isSafeInteger(userId) || userId <= 0) {
    return {
      autorizado: false,
      userId: null,
      status: 401,
      code: "UNAUTHORIZED",
    };
  }

  const usuarioAtual = await db.usuarios.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  const roleAtual = usuarioAtual?.role.trim().toLowerCase();

  if (
    usuarioAtual?.status !== "ATIVO" ||
    (roleAtual !== "admin" && roleAtual !== "ceo")
  ) {
    return {
      autorizado: false,
      userId,
      status: 403,
      code: "FORBIDDEN",
    };
  }

  const permissoes = await getPermissoesEfetivas(userId);
  if (!permissoes.includes("Cliente")) {
    return {
      autorizado: false,
      userId,
      status: 403,
      code: "FORBIDDEN",
    };
  }

  return { autorizado: true, userId };
}

export async function registrarAuditoriaCsNpsBestEffort(
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
