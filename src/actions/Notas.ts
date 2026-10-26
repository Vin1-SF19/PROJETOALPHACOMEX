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
  excluirNotasDefinitivamenteSchema,
  type ExcluirNotasDefinitivamenteInput,
} from "@/lib/validations/notas";
import {
  podeVisualizarNota,
  podeEditarNota,
  podeArquivarNota,
  podeRestaurarNota,
  podeExcluirNota,
  podeExcluirDefinitivamenteNota,
  temAcessoAoModuloNotas,
} from "@/lib/notas/permissoes";
import { criarFiltroAcessoNota, criarFiltroExclusaoLixeira } from "@/lib/notas/acesso";

async function sessaoUsuario() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: Number(session.user.id), role: session.user.role ?? "" };
}

export async function CriarNota(input: CriarNotaInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  if (!(await temAcessoAoModuloNotas(usuario))) {
    return { success: false as const, error: "Sem permissão para o módulo de Notas" };
  }

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
  try {
    const usuario = await sessaoUsuario();
    if (!usuario) return { success: false as const, error: "Não autorizado" };
    const parsed = atualizarNotaSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
    const dados = parsed.data;
    if (!(await podeEditarNota(usuario, dados.id))) {
      return { success: false as const, error: "Sem permissão para editar esta nota" };
    }
    // Remove proxies da travessia RSC antes de persistir Json pelo adapter LibSQL.
    const contentJsonLimpo = dados.contentJson !== undefined
      ? JSON.parse(JSON.stringify(dados.contentJson)) as typeof dados.contentJson : undefined;
    return await db.$transaction(async (tx) => {
      const notaAtual = await tx.note.findUnique({
        where: { id: dados.id },
        select: { currentVersion: true, title: true, contentJson: true, plainText: true, deletedAt: true },
      });
      if (!notaAtual || notaAtual.deletedAt) return { success: false as const, error: "Nota não encontrada" };
      if (notaAtual.currentVersion !== dados.baseVersion) {
        return { success: false as const, error: "CONFLITO_VERSAO", versaoAtual: notaAtual.currentVersion };
      }
      const novaVersao = dados.baseVersion + 1;
      const tituloFinal = dados.title !== undefined ? dados.title.trim() || "Sem título" : notaAtual.title;
      const gravacao = await tx.note.updateMany({
        where: { id: dados.id, currentVersion: dados.baseVersion, deletedAt: null },
        data: {
          title: tituloFinal,
          contentJson: contentJsonLimpo ?? undefined,
          plainText: dados.plainText ?? undefined,
          color: dados.color === undefined ? undefined : dados.color,
          icon: dados.icon === undefined ? undefined : dados.icon,
          isFavorite: dados.isFavorite ?? undefined,
          currentVersion: novaVersao,
          updatedById: usuario.id,
        },
      });
      if (gravacao.count !== 1) return { success: false as const, error: "CONFLITO_VERSAO" };
      await tx.noteVersion.create({
        data: { noteId: dados.id, version: novaVersao, title: tituloFinal,
          contentJson: contentJsonLimpo ?? notaAtual.contentJson ?? {},
          plainText: dados.plainText ?? notaAtual.plainText, changedById: usuario.id },
      });
      const notaAtualizada = await tx.note.findUniqueOrThrow({
        where: { id: dados.id }, select: { id: true, title: true, currentVersion: true, updatedAt: true },
      });
      return { success: true as const, data: notaAtualizada };
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "P2002" || code === "P2034") return { success: false as const, error: "CONFLITO_VERSAO" };
    console.error("[AtualizarNota]", error);
    return { success: false as const, error: "Não foi possível salvar a nota. Tente novamente." };
  }
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

  // O editor client-side (Tiptap) precisa saber antecipadamente se pode aceitar digitação —
  // sem isso, quem só tem papel LEITOR/COMENTARISTA consegue digitar normalmente na tela e só
  // descobre que a edição foi recusada quando o autosave falha silenciosamente no servidor.
  const somenteLeitura = !(await podeEditarNota(usuario, noteId));

  return { success: true as const, data: nota, somenteLeitura };
}

export async function ListarNotas(input?: ListarNotasInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [], total: 0 };
  if (!(await temAcessoAoModuloNotas(usuario))) {
    return { success: false as const, error: "Sem permissão para o módulo de Notas", data: [], total: 0 };
  }

  const parsed = listarNotasSchema.safeParse(input ?? {});
  if (!parsed.success) return { success: false as const, error: "Filtros inválidos", data: [], total: 0 };
  const filtros = parsed.data;

  const acessoBase = await criarFiltroAcessoNota(usuario);

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
  const parsed = excluirNotasDefinitivamenteSchema.safeParse({ noteIds: [noteId] });
  if (!parsed.success) return { success: false as const, error: "Nota inválida" };
  const [noteIdValidado] = parsed.data.noteIds;

  if (!(await podeExcluirDefinitivamenteNota(usuario, noteIdValidado))) {
    return { success: false as const, error: "Sem permissão" };
  }

  const removidas = await db.note.deleteMany({
    where: criarFiltroExclusaoLixeira(usuario.id, [noteIdValidado]),
  });
  if (removidas.count === 0) {
    return { success: false as const, error: "A nota precisa pertencer a você e estar na lixeira" };
  }
  return { success: true as const, count: removidas.count };
}

export async function ExcluirNotasDefinitivamente(input: ExcluirNotasDefinitivamenteInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", count: 0 };

  const parsed = excluirNotasDefinitivamenteSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Seleção inválida", count: 0 };

  const removidas = await db.note.deleteMany({
    where: criarFiltroExclusaoLixeira(usuario.id, parsed.data.noteIds),
  });

  return { success: true as const, count: removidas.count };
}

export async function EsvaziarLixeira() {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", count: 0 };

  const removidas = await db.note.deleteMany({
    where: criarFiltroExclusaoLixeira(usuario.id),
  });

  return { success: true as const, count: removidas.count };
}
