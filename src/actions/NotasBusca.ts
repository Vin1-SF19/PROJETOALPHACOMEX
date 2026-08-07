"use server";
import db from "@/lib/prisma";
import { auth } from "../../auth";
import { isAdminRole } from "@/lib/roles";
import {
  buscarNotasSchema,
  fixarNotaSchema,
  favoritarNotaSchema,
  criarTagSchema,
  aplicarTagSchema,
  type BuscarNotasInput,
  type FixarNotaInput,
  type FavoritarNotaInput,
  type CriarTagInput,
  type AplicarTagInput,
} from "@/lib/validations/notas";
import { podeEditarNota } from "@/lib/notas/permissoes";

async function sessaoUsuario() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: Number(session.user.id), role: session.user.role ?? "" };
}

/**
 * Central de Notas — busca full-text paginada e filtrada no servidor (Seção 14).
 * Contrato próprio, separado de `ListarNotas` (Fase 01, usado pela barra global de abas),
 * pois os consumidores têm necessidades bem diferentes — ver decisions.md.
 */
export async function BuscarNotas(input?: BuscarNotasInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [], total: 0 };

  const parsed = buscarNotasSchema.safeParse(input ?? {});
  if (!parsed.success) return { success: false as const, error: "Filtros inválidos", data: [], total: 0 };
  const filtros = parsed.data;

  const acessoBase = isAdminRole(usuario.role)
    ? {}
    : {
        OR: [
          { ownerId: usuario.id },
          { permissions: { some: { subjectType: "USUARIO", subjectId: String(usuario.id) } } },
          { permissions: { some: { subjectType: "SETOR", subjectId: usuario.role } } },
        ],
      };

  const condicoesSecao: Record<string, object> = {
    RECENTES: { status: { not: "LIXEIRA" } },
    FAVORITAS: { isFavorite: true, status: { not: "LIXEIRA" } },
    FIXADAS: { isPinned: true, status: { not: "LIXEIRA" } },
    COMPARTILHADAS_COMIGO: {
      status: { not: "LIXEIRA" },
      ownerId: { not: usuario.id },
      permissions: {
        some: {
          OR: [
            { subjectType: "USUARIO", subjectId: String(usuario.id) },
            { subjectType: "SETOR", subjectId: usuario.role },
          ],
        },
      },
    },
    CRIADAS_POR_MIM: { ownerId: usuario.id, status: { not: "LIXEIRA" } },
    EQUIPE: { visibility: "EQUIPE", status: { not: "LIXEIRA" } },
    CONTEXTUAIS: { status: { not: "LIXEIRA" }, contexts: { some: {} } },
    ARQUIVADAS: { status: "ARQUIVADA" },
    LIXEIRA: { status: "LIXEIRA" },
  };

  const orderBy =
    filtros.ordenarPor === "CRIACAO"
      ? { createdAt: "desc" as const }
      : filtros.ordenarPor === "TITULO"
        ? { title: "asc" as const }
        : { updatedAt: "desc" as const };

  const where = {
    AND: [
      acessoBase,
      condicoesSecao[filtros.secao],
      filtros.query
        ? {
            OR: [
              { title: { contains: filtros.query } },
              { plainText: { contains: filtros.query } },
              { tags: { some: { tag: { name: { contains: filtros.query } } } } },
            ],
          }
        : {},
      filtros.tagIds?.length ? { tags: { some: { tagId: { in: filtros.tagIds } } } } : {},
      filtros.moduleKey ? { contexts: { some: { moduleKey: filtros.moduleKey } } } : {},
      filtros.entityType ? { contexts: { some: { entityType: filtros.entityType } } } : {},
      filtros.comAnexos ? { attachments: { some: { deletedAt: null } } } : {},
    ],
  };

  const [dados, total] = await Promise.all([
    db.note.findMany({
      where,
      select: {
        id: true,
        title: true,
        visibility: true,
        status: true,
        isFavorite: true,
        isPinned: true,
        color: true,
        icon: true,
        updatedAt: true,
        createdAt: true,
        owner: { select: { id: true, nome: true } },
        contexts: { select: { moduleKey: true, displayName: true } },
        tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
        _count: { select: { attachments: true, comments: true } },
      },
      orderBy: [{ isPinned: "desc" }, orderBy],
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
    db.note.count({ where }),
  ]);

  return {
    success: true as const,
    data: dados,
    total,
    page: filtros.page,
    pageSize: filtros.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filtros.pageSize)),
  };
}

export async function FixarNota(input: FixarNotaInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = fixarNotaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };

  if (!(await podeEditarNota(usuario, parsed.data.noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  if (parsed.data.fixada) {
    const LIMITE_FIXADAS = 10;
    const totalFixadas = await db.note.count({ where: { ownerId: usuario.id, isPinned: true } });
    if (totalFixadas >= LIMITE_FIXADAS) {
      return { success: false as const, error: `Limite de ${LIMITE_FIXADAS} notas fixadas atingido` };
    }
  }

  await db.note.update({ where: { id: parsed.data.noteId }, data: { isPinned: parsed.data.fixada } });
  return { success: true as const };
}

export async function FavoritarNota(input: FavoritarNotaInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = favoritarNotaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };

  if (!(await podeEditarNota(usuario, parsed.data.noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  await db.note.update({ where: { id: parsed.data.noteId }, data: { isFavorite: parsed.data.favorita } });
  return { success: true as const };
}

export async function ListarTagsDisponiveis() {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [] };

  const tags = await db.tag.findMany({
    where: { OR: [{ ownerId: usuario.id }, { setorNome: usuario.role }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });

  return { success: true as const, data: tags };
}

export async function CriarTag(input: CriarTagInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = criarTagSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };

  const existente = await db.tag.findFirst({
    where: { name: parsed.data.name, ownerId: usuario.id, setorNome: null },
  });

  const tag = existente
    ? await db.tag.update({ where: { id: existente.id }, data: { color: parsed.data.color } })
    : await db.tag.create({
        data: { name: parsed.data.name, color: parsed.data.color, ownerId: usuario.id },
      });

  return { success: true as const, data: tag };
}

export async function AplicarTag(input: AplicarTagInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = aplicarTagSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };

  if (!(await podeEditarNota(usuario, parsed.data.noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  await db.noteTag.upsert({
    where: { noteId_tagId: { noteId: parsed.data.noteId, tagId: parsed.data.tagId } },
    create: { noteId: parsed.data.noteId, tagId: parsed.data.tagId },
    update: {},
  });

  return { success: true as const };
}

export async function RemoverTag(input: AplicarTagInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = aplicarTagSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };

  if (!(await podeEditarNota(usuario, parsed.data.noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  await db.noteTag.deleteMany({ where: { noteId: parsed.data.noteId, tagId: parsed.data.tagId } });
  return { success: true as const };
}
