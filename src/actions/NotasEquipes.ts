"use server";

import { Prisma } from "@prisma/client";
import { auth } from "../../auth";
import db from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server.ts";
import { canalNotasDoUsuario } from "@/lib/notas/notificacoes";
import { normalizarChaveNomeEquipe } from "@/lib/notas/equipes";
import {
  podeAlterarPermissoesNota,
  podeCompartilharNota,
  podeVisualizarNota,
  temAcessoAoModuloNotas,
} from "@/lib/notas/permissoes";
import {
  adicionarMembrosEquipeNotaSchema,
  alterarPapelMembroEquipeNotaSchema,
  compartilharNotaComEquipeSchema,
  criarEquipeNotaSchema,
  equipeNotaAlvoSchema,
  membroEquipeNotaAlvoSchema,
  removerCompartilhamentoEquipeSchema,
  renomearEquipeNotaSchema,
  type AdicionarMembrosEquipeNotaInput,
  type AlterarPapelMembroEquipeNotaInput,
  type CompartilharNotaComEquipeInput,
  type CriarEquipeNotaInput,
  type EquipeNotaAlvoInput,
  type MembroEquipeNotaAlvoInput,
  type RemoverCompartilhamentoEquipeInput,
  type RenomearEquipeNotaInput,
} from "@/lib/validations/notas";

async function sessaoUsuario() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: Number(session.user.id),
    role: session.user.role ?? "",
    nome: session.user.nome ?? "Alguém",
  };
}

async function usuarioComModulo() {
  const usuario = await sessaoUsuario();
  if (!usuario || !(await temAcessoAoModuloNotas(usuario))) return null;
  return usuario;
}

function erroPrisma(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "Já existe uma equipe sua com esse nome ou esse membro já faz parte da equipe";
  }
  console.error("Falha ao gerenciar equipe de notas:", error);
  return "Não foi possível concluir a operação";
}

async function equipeDoDono(teamId: string, ownerId: number) {
  return db.noteTeam.findFirst({ where: { id: teamId, ownerId }, select: { id: true, ownerId: true } });
}

async function equipeDoParticipante(teamId: string, userId: number) {
  return db.noteTeam.findFirst({
    where: { id: teamId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true, ownerId: true, name: true },
  });
}

async function validarUsuariosAtivos(ids: number[]) {
  if (ids.length === 0) return true;
  const total = await db.usuarios.count({ where: { id: { in: ids }, status: "ATIVO" } });
  return total === ids.length;
}

export async function CriarEquipeNota(input: CriarEquipeNotaInput) {
  const usuario = await usuarioComModulo();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  const parsed = criarEquipeNotaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const dados = parsed.data;

  if (dados.members.some((membro) => membro.userId === usuario.id)) {
    return { success: false as const, error: "O criador já é administrador da equipe" };
  }
  if (!(await validarUsuariosAtivos(dados.members.map((membro) => membro.userId)))) {
    return { success: false as const, error: "Há usuários inexistentes ou inativos na seleção" };
  }

  try {
    const equipe = await db.noteTeam.create({
      data: {
        name: dados.name,
        nameKey: normalizarChaveNomeEquipe(dados.name),
        ownerId: usuario.id,
        members: { create: dados.members },
      },
      select: { id: true, name: true },
    });
    return { success: true as const, data: equipe };
  } catch (error) {
    return { success: false as const, error: erroPrisma(error) };
  }
}

export async function ListarMinhasEquipesNota() {
  const usuario = await usuarioComModulo();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [] };

  const equipes = await db.noteTeam.findMany({
    where: { OR: [{ ownerId: usuario.id }, { members: { some: { userId: usuario.id } } }] },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      ownerId: true,
      updatedAt: true,
      owner: { select: { id: true, nome: true } },
      members: {
        orderBy: { createdAt: "asc" },
        select: { id: true, userId: true, role: true, user: { select: { id: true, nome: true, imagemUrl: true } } },
      },
      _count: { select: { shares: true } },
    },
  });

  return {
    success: true as const,
    data: equipes.map((equipe) => ({ ...equipe, isOwner: equipe.ownerId === usuario.id })),
    currentUserId: usuario.id,
  };
}

export async function ObterEquipeNota(input: EquipeNotaAlvoInput) {
  const usuario = await usuarioComModulo();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  const parsed = equipeNotaAlvoSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };

  const equipe = await db.noteTeam.findFirst({
    where: {
      id: parsed.data.teamId,
      OR: [{ ownerId: usuario.id }, { members: { some: { userId: usuario.id } } }],
    },
    select: {
      id: true,
      name: true,
      ownerId: true,
      owner: { select: { id: true, nome: true } },
      members: {
        orderBy: { createdAt: "asc" },
        select: { id: true, userId: true, role: true, user: { select: { id: true, nome: true, imagemUrl: true } } },
      },
      _count: { select: { shares: true } },
    },
  });
  if (!equipe) return { success: false as const, error: "Equipe não encontrada" };
  return { success: true as const, data: { ...equipe, isOwner: equipe.ownerId === usuario.id } };
}

export async function RenomearEquipeNota(input: RenomearEquipeNotaInput) {
  const usuario = await usuarioComModulo();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  const parsed = renomearEquipeNotaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  if (!(await equipeDoDono(parsed.data.teamId, usuario.id))) {
    return { success: false as const, error: "Somente o criador pode renomear a equipe" };
  }
  try {
    await db.noteTeam.update({
      where: { id: parsed.data.teamId },
      data: { name: parsed.data.name, nameKey: normalizarChaveNomeEquipe(parsed.data.name) },
    });
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPrisma(error) };
  }
}

export async function AdicionarMembrosEquipeNota(input: AdicionarMembrosEquipeNotaInput) {
  const usuario = await usuarioComModulo();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  const parsed = adicionarMembrosEquipeNotaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const equipe = await equipeDoDono(parsed.data.teamId, usuario.id);
  if (!equipe) return { success: false as const, error: "Somente o criador pode adicionar membros" };
  const ids = parsed.data.members.map((membro) => membro.userId);
  if (ids.includes(usuario.id)) return { success: false as const, error: "O criador já pertence à equipe" };
  if (!(await validarUsuariosAtivos(ids))) {
    return { success: false as const, error: "Há usuários inexistentes ou inativos na seleção" };
  }
  const existentes = await db.noteTeamMember.count({ where: { teamId: equipe.id, userId: { in: ids } } });
  if (existentes > 0) return { success: false as const, error: "Um ou mais usuários já fazem parte da equipe" };
  try {
    await db.noteTeamMember.createMany({
      data: parsed.data.members.map((membro) => ({ teamId: equipe.id, userId: membro.userId, role: membro.role })),
    });
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPrisma(error) };
  }
}

export async function AlterarPapelMembroEquipeNota(input: AlterarPapelMembroEquipeNotaInput) {
  const usuario = await usuarioComModulo();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  const parsed = alterarPapelMembroEquipeNotaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  if (!(await equipeDoDono(parsed.data.teamId, usuario.id))) {
    return { success: false as const, error: "Somente o criador pode alterar funções" };
  }
  const atualizado = await db.noteTeamMember.updateMany({
    where: { teamId: parsed.data.teamId, userId: parsed.data.userId },
    data: { role: parsed.data.role },
  });
  if (atualizado.count === 0) return { success: false as const, error: "Membro não encontrado" };
  return { success: true as const };
}

export async function RemoverMembroEquipeNota(input: MembroEquipeNotaAlvoInput) {
  const usuario = await usuarioComModulo();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  const parsed = membroEquipeNotaAlvoSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  if (!(await equipeDoDono(parsed.data.teamId, usuario.id))) {
    return { success: false as const, error: "Somente o criador pode remover membros" };
  }
  if (parsed.data.userId === usuario.id) return { success: false as const, error: "O criador não pode ser removido" };
  const removido = await db.noteTeamMember.deleteMany({
    where: { teamId: parsed.data.teamId, userId: parsed.data.userId },
  });
  if (removido.count === 0) return { success: false as const, error: "Membro não encontrado" };
  return { success: true as const };
}

export async function SairDaEquipeNota(input: EquipeNotaAlvoInput) {
  const usuario = await usuarioComModulo();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  const parsed = equipeNotaAlvoSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  const equipe = await db.noteTeam.findUnique({ where: { id: parsed.data.teamId }, select: { ownerId: true } });
  if (!equipe) return { success: false as const, error: "Equipe não encontrada" };
  if (equipe.ownerId === usuario.id) return { success: false as const, error: "O criador deve excluir a equipe, não sair dela" };
  const removido = await db.noteTeamMember.deleteMany({ where: { teamId: parsed.data.teamId, userId: usuario.id } });
  if (removido.count === 0) return { success: false as const, error: "Você não faz parte desta equipe" };
  return { success: true as const };
}

export async function ExcluirEquipeNota(input: EquipeNotaAlvoInput) {
  const usuario = await usuarioComModulo();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  const parsed = equipeNotaAlvoSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  if (!(await equipeDoDono(parsed.data.teamId, usuario.id))) {
    return { success: false as const, error: "Somente o criador pode excluir a equipe" };
  }
  await db.noteTeam.delete({ where: { id: parsed.data.teamId } });
  return { success: true as const };
}

export async function BuscarUsuariosParaEquipeNota(query: string) {
  const usuario = await usuarioComModulo();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [] };
  const termo = query.trim().slice(0, 80);
  if (termo.length < 2) return { success: true as const, data: [] };
  const usuarios = await db.usuarios.findMany({
    where: {
      status: "ATIVO",
      id: { not: usuario.id },
      OR: [{ nome: { contains: termo } }, { usuario: { contains: termo } }],
    },
    orderBy: { nome: "asc" },
    take: 20,
    select: { id: true, nome: true, imagemUrl: true, role: true },
  });
  return { success: true as const, data: usuarios };
}

export async function CompartilharNotaComEquipe(input: CompartilharNotaComEquipeInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  const parsed = compartilharNotaComEquipeSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  if (!(await podeCompartilharNota(usuario, parsed.data.noteId))) {
    return { success: false as const, error: "Sem permissão para compartilhar esta nota" };
  }
  const equipe = await equipeDoParticipante(parsed.data.teamId, usuario.id);
  if (!equipe) return { success: false as const, error: "Equipe não encontrada" };
  const nota = await db.note.findUnique({
    where: { id: parsed.data.noteId },
    select: { title: true, visibility: true },
  });
  if (!nota) return { success: false as const, error: "Nota não encontrada" };

  await db.$transaction([
    db.noteTeamShare.upsert({
      where: { noteId_teamId: { noteId: parsed.data.noteId, teamId: equipe.id } },
      create: { noteId: parsed.data.noteId, teamId: equipe.id, createdById: usuario.id },
      update: {},
    }),
    ...(nota.visibility === "PRIVADA"
      ? [db.note.update({ where: { id: parsed.data.noteId }, data: { visibility: "EQUIPE" } })]
      : []),
  ]);

  const destinatarios = await db.noteTeam.findUnique({
    where: { id: equipe.id },
    select: { ownerId: true, members: { select: { userId: true } } },
  });
  const ids = new Set([destinatarios?.ownerId, ...(destinatarios?.members.map((membro) => membro.userId) ?? [])]);
  ids.delete(undefined);
  ids.delete(usuario.id);
  await Promise.all(
    [...ids].map(async (userId) => {
      try {
        await pusherServer.trigger(canalNotasDoUsuario(userId as number), "nota-compartilhada", {
          noteId: parsed.data.noteId,
          noteTitle: nota.title,
          tipo: "EQUIPE",
          mensagem: `compartilhou a nota "${nota.title || "Sem título"}" com a equipe ${equipe.name}`,
          autorNome: usuario.nome,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Falha ao notificar membro da equipe de notas:", error);
      }
    }),
  );
  return { success: true as const };
}

export async function RemoverCompartilhamentoEquipeNota(input: RemoverCompartilhamentoEquipeInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };
  const parsed = removerCompartilhamentoEquipeSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  const share = await db.noteTeamShare.findUnique({ where: { id: parsed.data.shareId }, select: { noteId: true } });
  if (!share) return { success: false as const, error: "Compartilhamento não encontrado" };
  if (!(await podeAlterarPermissoesNota(usuario, share.noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }
  await db.noteTeamShare.delete({ where: { id: parsed.data.shareId } });
  return { success: true as const };
}

export async function ListarCompartilhamentosEquipeNota(noteId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [] };
  if (!(await podeVisualizarNota(usuario, noteId))) {
    return { success: false as const, error: "Sem permissão", data: [] };
  }
  const shares = await db.noteTeamShare.findMany({
    where: { noteId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      teamId: true,
      createdAt: true,
      team: { select: { name: true, owner: { select: { nome: true } }, _count: { select: { members: true } } } },
    },
  });
  return {
    success: true as const,
    data: shares.map((share) => ({
      id: share.id,
      teamId: share.teamId,
      teamName: share.team.name,
      ownerName: share.team.owner.nome,
      memberCount: share.team._count.members + 1,
      createdAt: share.createdAt,
    })),
  };
}
