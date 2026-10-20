import "server-only";

import db from "@/lib/prisma";
import { idUsuarioCampoBpm, type OpcaoUsuarioCampoBpm } from "@/lib/bpm/usuarios-campos";

/** Consulta em lote, incluindo usuários inativos já referenciados pelo formulário. */
export async function carregarUsuariosCamposBpm(
  valores: readonly (string | null | undefined)[],
  incluirAtivos: boolean,
  client: Pick<typeof db, "usuarios"> = db,
): Promise<OpcaoUsuarioCampoBpm[]> {
  const ids = [...new Set(valores.map(idUsuarioCampoBpm).filter((id): id is number => id !== null))];
  if (!incluirAtivos && !ids.length) return [];
  const usuarios = await client.usuarios.findMany({
    where: incluirAtivos ? { OR: [{ status: "ATIVO" }, { id: { in: ids } }] } : { id: { in: ids } },
    select: { id: true, nome: true, status: true },
    orderBy: [{ nome: "asc" }, { id: "asc" }],
  });
  return usuarios.map(({ id, nome, status }) => ({ id, nome, ativo: status === "ATIVO" }));
}
