import type { Prisma } from "@prisma/client";

export interface UsuarioAcessoNota {
  id: number;
  role: string;
}

/**
 * Regra única de visibilidade das notas: propriedade ou compartilhamento explícito.
 * O perfil administrativo não altera este filtro — ele só pode liberar o módulo em si.
 */
export function criarFiltroAcessoNota(usuario: UsuarioAcessoNota): Prisma.NoteWhereInput {
  return {
    OR: [
      { ownerId: usuario.id },
      { permissions: { some: { subjectType: "USUARIO", subjectId: String(usuario.id) } } },
      { permissions: { some: { subjectType: "SETOR", subjectId: usuario.role } } },
      { permissions: { some: { subjectType: "ROLE", subjectId: usuario.role } } },
    ],
  };
}

/** Filtro obrigatório para qualquer exclusão permanente; nunca aceita nota fora da lixeira ou de outro dono. */
export function criarFiltroExclusaoLixeira(
  ownerId: number,
  noteIds?: string[],
): Prisma.NoteWhereInput {
  return {
    ownerId,
    status: "LIXEIRA",
    ...(noteIds ? { id: { in: noteIds } } : {}),
  };
}
