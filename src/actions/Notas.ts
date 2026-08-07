"use server";
import db from "@/lib/prisma";
import { auth } from "../../auth";
import {
  criarNotaSchema,
  atualizarNotaSchema,
  listarNotasSchema,
  type CriarNotaInput,
  type AtualizarNotaInput,
  type ListarNotasInput,
} from "@/lib/validations/notas";
import {
  podeVisualizarNota,
  podeEditarNota,
  podeArquivarNota,
  podeRestaurarNota,
  podeExcluirNota,
  podeExcluirDefinitivamenteNota,
} from "@/lib/notas/permissoes";
import { isAdminRole } from "@/lib/roles";

async function sessaoUsuario() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: Number(session.user.id), role: session.user.role ?? "" };
}

export async function CriarNota(input: CriarNotaInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = criarNotaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  const dados = parsed.data;

  const titulo = dados.title.trim() || dados.plainText.trim().slice(0, 60) || "Sem título";

  const nota = await db.note.create({
    data: {
      title: titulo,
      contentJson: dados.contentJson ?? {},
      plainText: dados.plainText,
      ownerId: usuario.id,
      createdById: usuario.id,
      visibility: dados.visibility,
      color: dados.color ?? null,
      icon: dados.icon ?? null,
      ...(dados.contexto
        ? {
            contexts: {
              create: {
                moduleKey: dados.contexto.moduleKey,
                entityType: dados.contexto.entityType,
                entityId: dados.contexto.entityId,
                displayName: dados.contexto.displayName,
                internalPath: dados.contexto.internalPath,
                metadata: dados.contexto.metadata ?? undefined,
              },
            },
          }
        : {}),
      versions: {
        create: {
          version: 1,
          title: titulo,
          contentJson: dados.contentJson ?? {},
          plainText: dados.plainText,
          changedById: usuario.id,
          changeSummary: "Criação da nota",
        },
      },
    },
    select: { id: true, title: true, visibility: true, status: true, currentVersion: true },
  });

  return { success: true as const, data: nota };
}

export async function AtualizarNota(input: AtualizarNotaInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = atualizarNotaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  const dados = parsed.data;

  if (!(await podeEditarNota(usuario, dados.id))) {
    return { success: false as const, error: "Sem permissão para editar esta nota" };
  }

  const notaAtual = await db.note.findUnique({
    where: { id: dados.id },
    select: { currentVersion: true, title: true, contentJson: true, plainText: true },
  });
  if (!notaAtual) return { success: false as const, error: "Nota não encontrada" };

  if (notaAtual.currentVersion !== dados.baseVersion) {
    return {
      success: false as const,
      error: "CONFLITO_VERSAO",
      versaoAtual: notaAtual.currentVersion,
    };
  }

  const novaVersao = notaAtual.currentVersion + 1;
  const tituloFinal = dados.title !== undefined ? dados.title.trim() || "Sem título" : notaAtual.title;

  const [notaAtualizada] = await db.$transaction([
    db.note.update({
      where: { id: dados.id },
      data: {
        title: tituloFinal,
        contentJson: dados.contentJson ?? undefined,
        plainText: dados.plainText ?? undefined,
        color: dados.color === undefined ? undefined : dados.color,
        icon: dados.icon === undefined ? undefined : dados.icon,
        isFavorite: dados.isFavorite ?? undefined,
        currentVersion: novaVersao,
        updatedById: usuario.id,
      },
      select: { id: true, title: true, currentVersion: true, updatedAt: true },
    }),
    db.noteVersion.create({
      data: {
        noteId: dados.id,
        version: novaVersao,
        title: tituloFinal,
        contentJson: dados.contentJson ?? notaAtual.contentJson ?? {},
        plainText: dados.plainText ?? notaAtual.plainText,
        changedById: usuario.id,
      },
    }),
  ]);

  return { success: true as const, data: notaAtualizada };
}

export async function ObterNota(noteId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  if (!(await podeVisualizarNota(usuario, noteId))) {
    return { success: false as const, error: "Sem permissão para visualizar esta nota" };
  }

  const nota = await db.note.findUnique({
    where: { id: noteId },
    include: {
      contexts: true,
      tags: { include: { tag: true } },
      owner: { select: { id: true, nome: true } },
    },
  });
  if (!nota || nota.deletedAt) return { success: false as const, error: "Nota não encontrada" };

  return { success: true as const, data: nota };
}

export async function ListarNotas(input?: ListarNotasInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [], total: 0 };

  const parsed = listarNotasSchema.safeParse(input ?? {});
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

  const where = {
    AND: [
      acessoBase,
      { status: filtros.status ?? { not: "LIXEIRA" } },
      filtros.visibility ? { visibility: filtros.visibility } : {},
      filtros.moduleKey ? { contexts: { some: { moduleKey: filtros.moduleKey } } } : {},
      filtros.apenasFavoritas ? { isFavorite: true } : {},
      filtros.busca
        ? { OR: [{ title: { contains: filtros.busca } }, { plainText: { contains: filtros.busca } }] }
        : {},
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
        color: true,
        icon: true,
        updatedAt: true,
        createdAt: true,
        contexts: { select: { moduleKey: true, displayName: true } },
      },
      orderBy: { updatedAt: "desc" },
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

export async function ArquivarNota(noteId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  if (!(await podeArquivarNota(usuario, noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  await db.note.update({
    where: { id: noteId },
    data: { status: "ARQUIVADA", archivedAt: new Date(), updatedById: usuario.id },
  });
  return { success: true as const };
}

export async function RestaurarNota(noteId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  if (!(await podeRestaurarNota(usuario, noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  await db.note.update({
    where: { id: noteId },
    data: { status: "ATIVA", archivedAt: null, deletedAt: null, updatedById: usuario.id },
  });
  return { success: true as const };
}

export async function MoverNotaParaLixeira(noteId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  if (!(await podeExcluirNota(usuario, noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  await db.note.update({
    where: { id: noteId },
    data: { status: "LIXEIRA", deletedAt: new Date(), updatedById: usuario.id },
  });
  return { success: true as const };
}

export async function ExcluirNotaDefinitivamente(noteId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  if (!(await podeExcluirDefinitivamenteNota(usuario, noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  await db.note.delete({ where: { id: noteId } });
  return { success: true as const };
}
