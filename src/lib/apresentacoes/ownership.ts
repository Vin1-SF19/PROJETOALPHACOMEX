import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

/**
 * Sobe até a Apresentação dona do `apresentacaoId` e confirma ownership (autor, colaborador
 * ou admin). Versão canônica — a mesma checagem já existe duplicada localmente em
 * `src/actions/slides.ts`, `src/actions/apresentacao-temas.ts` e 2 Route Handlers; esta versão
 * é usada pela rota de exportação HTML sem tocar nos call sites existentes.
 */
export async function checarOwnershipApresentacao(
  apresentacaoId: string,
  userId: number,
  role?: string | null,
): Promise<boolean> {
  if (isAdminRole(role)) return true;
  const apresentacao = await db.apresentacao.findUnique({
    where: { id: apresentacaoId },
    select: {
      autorId: true,
      colaboradores: { where: { userId }, select: { id: true } },
    },
  });
  if (!apresentacao) return false;
  return apresentacao.autorId === userId || apresentacao.colaboradores.length > 0;
}
