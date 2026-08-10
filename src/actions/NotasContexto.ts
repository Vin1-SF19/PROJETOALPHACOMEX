"use server";
import db from "@/lib/prisma";
import { auth } from "../../auth";
import { vincularContextoSchema, removerContextoSchema, type VincularContextoInput, type RemoverContextoInput } from "@/lib/validations/notas";
import { podeEditarNota, podeVisualizarNota } from "@/lib/notas/permissoes";
import { isAdminRole } from "@/lib/roles";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { MODULOS_REGISTRY, MODULOS_VINCULAVEIS } from "@/lib/modulos-registry";

async function sessaoUsuario() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: Number(session.user.id), role: session.user.role ?? "" };
}

/**
 * Confirma que a entidade referenciada REALMENTE existe naquele módulo antes de gravar o
 * vínculo — evita NoteContext apontando para um registro forjado/inexistente (Seção 30 do
 * prompt original). Cada módulo integrado precisa de um caso próprio aqui; módulos ainda não
 * integrados (fora do escopo desta fase) caem no fallback conservador de rejeitar o vínculo,
 * nunca aceitar sem checar.
 */
async function entidadeReferenciadaExiste(moduleKey: string, entityType: string, entityId: string): Promise<boolean> {
  const idNumerico = Number(entityId);
  if (!Number.isSafeInteger(idNumerico)) return false;

  if (moduleKey === "chamados" && entityType === "chamado") {
    const chamado = await db.chamados.findUnique({ where: { id: idNumerico }, select: { id: true } });
    return chamado !== null;
  }

  return false;
}

export async function VincularContextoNota(input: VincularContextoInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = vincularContextoSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  const dados = parsed.data;

  if (!(await podeEditarNota(usuario, dados.noteId))) {
    return { success: false as const, error: "Sem permissão para vincular esta nota" };
  }

  const modulo = MODULOS_REGISTRY.find((m) => m.id === dados.moduleKey);
  if (!modulo) {
    return { success: false as const, error: "Módulo desconhecido" };
  }
  if (!isAdminRole(usuario.role) && modulo.permission) {
    const permissoes = await getPermissoesEfetivas(usuario.id);
    if (!permissoes.includes(modulo.permission)) {
      return { success: false as const, error: "Sem permissão para vincular a este módulo" };
    }
  }

  if (!(await entidadeReferenciadaExiste(dados.moduleKey, dados.entityType, dados.entityId))) {
    return { success: false as const, error: "Registro referenciado não encontrado" };
  }

  const contexto = await db.noteContext.create({
    data: {
      noteId: dados.noteId,
      moduleKey: dados.moduleKey,
      entityType: dados.entityType,
      entityId: dados.entityId,
      displayName: dados.displayName,
      internalPath: dados.internalPath,
      metadata: dados.metadata ?? undefined,
    },
  });

  return { success: true as const, data: contexto };
}

export async function RemoverContextoNota(input: RemoverContextoInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = removerContextoSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };

  const contexto = await db.noteContext.findUnique({
    where: { id: parsed.data.contextId },
    select: { noteId: true },
  });
  if (!contexto) return { success: false as const, error: "Contexto não encontrado" };

  if (!(await podeEditarNota(usuario, contexto.noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  await db.noteContext.delete({ where: { id: parsed.data.contextId } });
  return { success: true as const };
}

interface ContagemContextoParams {
  moduleKey: string;
  entityType: string;
  entityId: string;
}

/**
 * Alimenta o NotesContextBadge — sempre filtrado por permissão, nunca uma contagem bruta.
 * Seção 12.1: "Não revelar contagem de notas que o usuário não pode visualizar."
 */
export async function ObterContagemNotasContexto({ moduleKey, entityType, entityId }: ContagemContextoParams) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", total: 0, privadas: 0, compartilhadas: 0, temFixada: false };

  const notas = await db.note.findMany({
    where: {
      status: { not: "LIXEIRA" },
      contexts: { some: { moduleKey, entityType, entityId } },
    },
    select: { id: true, ownerId: true, visibility: true, isPinned: true, updatedAt: true },
  });

  const visiveis = [];
  for (const nota of notas) {
    if (await podeVisualizarNota(usuario, nota.id)) visiveis.push(nota);
  }

  return {
    success: true as const,
    total: visiveis.length,
    privadas: visiveis.filter((n) => n.ownerId === usuario.id && n.visibility === "PRIVADA").length,
    compartilhadas: visiveis.filter((n) => n.visibility === "COMPARTILHADA" || n.visibility === "EQUIPE").length,
    temFixada: visiveis.some((n) => n.isPinned),
    ultimaAtualizacao: visiveis.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]?.updatedAt ?? null,
  };
}

interface RegistroVinculavel {
  entityId: string;
  displayName: string;
  internalPath: string;
}

export async function BuscarRegistrosVinculaveis(input: { moduleKey: string; query: string }) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [] };

  const moduloVinculavel = MODULOS_VINCULAVEIS.find((m) => m.moduleKey === input.moduleKey);
  if (!moduloVinculavel) return { success: false as const, error: "Módulo desconhecido", data: [] };

  const modulo = MODULOS_REGISTRY.find((m) => m.id === input.moduleKey);
  if (!modulo) return { success: false as const, error: "Módulo desconhecido", data: [] };
  if (!isAdminRole(usuario.role) && modulo.permission) {
    const permissoes = await getPermissoesEfetivas(usuario.id);
    if (!permissoes.includes(modulo.permission)) {
      return { success: false as const, error: "Sem permissão para consultar este módulo", data: [] };
    }
  }

  const query = input.query.trim();
  if (query.length < 1) return { success: true as const, data: [] as RegistroVinculavel[] };

  if (input.moduleKey === "chamados") {
    const idNumerico = Number(query);
    const chamados = await db.chamados.findMany({
      where: Number.isSafeInteger(idNumerico)
        ? { OR: [{ id: idNumerico }, { titulo: { contains: query } }] }
        : { titulo: { contains: query } },
      select: { id: true, titulo: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return {
      success: true as const,
      data: chamados.map((chamado) => ({
        entityId: String(chamado.id),
        displayName: `#${chamado.id} — ${chamado.titulo}`,
        internalPath: "/PainelAlpha/Chamados",
      })) as RegistroVinculavel[],
    };
  }

  return { success: true as const, data: [] as RegistroVinculavel[] };
}

export async function ListarNotasDoContexto({ moduleKey, entityType, entityId }: ContagemContextoParams) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [] };

  const notas = await db.note.findMany({
    where: {
      status: { not: "LIXEIRA" },
      contexts: { some: { moduleKey, entityType, entityId } },
    },
    select: { id: true, title: true, visibility: true, isPinned: true, isFavorite: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const visiveis = [];
  for (const nota of notas) {
    if (await podeVisualizarNota(usuario, nota.id)) visiveis.push(nota);
  }

  return { success: true as const, data: visiveis };
}
