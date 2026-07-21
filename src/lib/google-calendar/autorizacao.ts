import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";

import { auth } from "../../../auth";

export const PERMISSAO_CALENDARIO_ALPHA = "calendarioAlpha";

export type ResultadoAutorizacaoCalendarioAlpha =
  | { autorizado: true; userId: number }
  | {
      autorizado: false;
      userId: number | null;
      status: 401 | 403;
      code: "UNAUTHORIZED" | "FORBIDDEN";
    };

/** Sessão válida + usuário ATIVO + permissão efetiva `calendarioAlpha` — checagem real, nunca só ocultar botão na UI. */
export async function verificarAcessoCalendarioAlpha(): Promise<ResultadoAutorizacaoCalendarioAlpha> {
  const session = await auth();
  const userId = Number(session?.user?.id);

  if (!session?.user?.id || !Number.isSafeInteger(userId) || userId <= 0) {
    return { autorizado: false, userId: null, status: 401, code: "UNAUTHORIZED" };
  }

  const usuarioAtual = await db.usuarios.findUnique({
    where: { id: userId },
    select: { status: true },
  });

  if (usuarioAtual?.status !== "ATIVO") {
    return { autorizado: false, userId, status: 403, code: "FORBIDDEN" };
  }

  const permissoes = await getPermissoesEfetivas(userId);
  if (!permissoes.includes(PERMISSAO_CALENDARIO_ALPHA)) {
    return { autorizado: false, userId, status: 403, code: "FORBIDDEN" };
  }

  return { autorizado: true, userId };
}
