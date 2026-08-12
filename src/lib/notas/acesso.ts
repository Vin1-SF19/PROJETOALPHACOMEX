import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { isSameRole } from "@/lib/roles";

export interface UsuarioAcessoNota {
  id: number;
  role: string;
}

/**
 * Resolve, entre os `subjectId` de SETOR/ROLE já usados em compartilhamentos de notas, quais
 * são equivalentes ao setor do usuário — tolerando caixa, acentos e pontuação (ex: "TI" vs
 * "T.I"), o mesmo critério que `isSameRole` já aplica em `resolverPapelEfetivo`
 * (src/lib/notas/permissoes.ts). Sem isso, o Prisma faz `=` exato contra `usuario.role` e o
 * compartilhamento com um setor cadastrado com grafia levemente diferente nunca aparece na
 * listagem do destinatário, mesmo que ele consiga abrir a nota tendo o link direto.
 */
async function resolverSubjectIdsDeSetorEquivalentes(role: string): Promise<string[]> {
  if (!role) return [];
  const candidatos = await db.notePermission.findMany({
    where: { subjectType: { in: ["SETOR", "ROLE"] } },
    select: { subjectId: true },
    distinct: ["subjectId"],
  });
  return candidatos.map((c) => c.subjectId).filter((subjectId) => isSameRole(subjectId, role));
}

/**
 * Regra única de visibilidade das notas: propriedade ou compartilhamento explícito.
 * O perfil administrativo não altera este filtro — ele só pode liberar o módulo em si.
 */
export async function criarFiltroAcessoNota(usuario: UsuarioAcessoNota): Promise<Prisma.NoteWhereInput> {
  const setoresEquivalentes = await resolverSubjectIdsDeSetorEquivalentes(usuario.role);

  return {
    OR: [
      { ownerId: usuario.id },
      { permissions: { some: { subjectType: "USUARIO", subjectId: String(usuario.id) } } },
      {
        teamShares: {
          some: {
            team: {
              OR: [{ ownerId: usuario.id }, { members: { some: { userId: usuario.id } } }],
            },
          },
        },
      },
      ...(setoresEquivalentes.length > 0
        ? [
            { permissions: { some: { subjectType: "SETOR" as const, subjectId: { in: setoresEquivalentes } } } },
            { permissions: { some: { subjectType: "ROLE" as const, subjectId: { in: setoresEquivalentes } } } },
          ]
        : []),
    ],
  };
}

/** Notas compartilhadas com qualquer equipe privada da qual o usuário seja dono ou membro. */
export function criarCondicaoAcessoPorEquipe(usuarioId: number): Prisma.NoteWhereInput {
  return {
    teamShares: {
      some: {
        team: {
          OR: [{ ownerId: usuarioId }, { members: { some: { userId: usuarioId } } }],
        },
      },
    },
  };
}

/** Mesma resolução tolerante usada em `criarFiltroAcessoNota`, exposta para montar a condição
 *  "Compartilhadas comigo" (que precisa do filtro de setor isolado, sem o `ownerId`/`USUARIO`). */
export async function resolverCondicaoCompartilhadoPorSetor(
  usuario: UsuarioAcessoNota,
): Promise<Prisma.NotePermissionWhereInput[]> {
  const setoresEquivalentes = await resolverSubjectIdsDeSetorEquivalentes(usuario.role);
  if (setoresEquivalentes.length === 0) return [];
  return [
    { subjectType: "SETOR", subjectId: { in: setoresEquivalentes } },
    { subjectType: "ROLE", subjectId: { in: setoresEquivalentes } },
  ];
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
