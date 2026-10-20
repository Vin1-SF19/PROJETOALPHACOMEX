import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { isAdminRole, isSameRole } from "@/lib/roles";

export type AtorChamados = {
  id: number; nome: string; role: string; setorId: number | null; setorNome: string | null;
  visaoGlobal: boolean; gerenciaCategorias: boolean;
};
export type ChamadoAcesso = {
  usuarioId: number; tecnicoId?: number | null; tecnicoSolicitadoId?: number | null; status?: string;
  setorDestinoId?: number | null;
  setorDestino?: { id: number; nome: string; ativo: boolean; isBase: boolean } | null;
};

/** A sessão identifica o ator; estado e setor são sempre consultados no cadastro. */
export async function obterAtorChamados(userId: number | string | undefined, client: Pick<Prisma.TransactionClient, "usuarios" | "setor"> = db): Promise<AtorChamados | null> {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const usuario = await client.usuarios.findUnique({ where: { id }, select: { id: true, nome: true, role: true, status: true } });
  if (!usuario || usuario.status !== "ATIVO") return null;
  const setores = await client.setor.findMany({ where: { ativo: true, isBase: false }, select: { id: true, nome: true } });
  const correspondentes = setores.filter((setor) => isSameRole(setor.nome, usuario.role));
  // Uma ambiguidade de cadastro não pode encaminhar um atendimento silenciosamente.
  const setor = correspondentes.length === 1 ? correspondentes[0] : null;
  return { id: usuario.id, nome: usuario.nome, role: usuario.role, setorId: setor?.id ?? null, setorNome: setor?.nome ?? null,
    visaoGlobal: isAdminRole(usuario.role), gerenciaCategorias: isSameRole(usuario.role, "TI") };
}

export function chamadoDestinoEhTI(chamado: ChamadoAcesso): boolean {
  return chamado.setorDestinoId == null || isSameRole(chamado.setorDestino?.nome, "TI");
}
export function pertenceAoDestino(ator: AtorChamados, chamado: ChamadoAcesso): boolean {
  if (chamado.setorDestinoId == null) return ator.setorId !== null && isSameRole(ator.setorNome, "TI");
  return chamado.setorDestino?.ativo === true && !chamado.setorDestino.isBase && ator.setorId === chamado.setorDestinoId;
}
export function podeVerChamado(ator: AtorChamados, chamado: ChamadoAcesso): boolean {
  return ator.visaoGlobal || chamado.usuarioId === ator.id || pertenceAoDestino(ator, chamado);
}
/** Administradores podem atender entre setores; atribuição e reserva são verificadas nas ações. */
export function podeAtenderChamado(ator: AtorChamados, chamado: ChamadoAcesso): boolean {
  const destinoValido = chamado.setorDestinoId == null
    || (chamado.setorDestino?.ativo === true && !chamado.setorDestino.isBase);
  return destinoValido && (isAdminRole(ator.role) || pertenceAoDestino(ator, chamado));
}
export function podeAssumirChamado(ator: AtorChamados, chamado: ChamadoAcesso): boolean {
  return podeAtenderChamado(ator, chamado) && chamado.status === "ABERTO" && chamado.tecnicoId == null
    && (chamado.tecnicoSolicitadoId == null || chamado.tecnicoSolicitadoId === ator.id);
}
export function podeConcluirChamado(ator: AtorChamados, chamado: ChamadoAcesso): boolean {
  return podeAtenderChamado(ator, chamado) && chamado.status === "EM_ATENDIMENTO" && chamado.tecnicoId === ator.id;
}
export function podeResponderChamado(ator: AtorChamados, chamado: ChamadoAcesso): boolean {
  return chamado.usuarioId === ator.id || (chamado.tecnicoId === ator.id && podeAtenderChamado(ator, chamado));
}
export function chamadoVisivelWhere(ator: AtorChamados): Prisma.chamadosWhereInput {
  if (ator.visaoGlobal) return {};
  return { OR: [{ usuarioId: ator.id }, ...(ator.setorId === null ? [] : [{ setorDestinoId: ator.setorId, setorDestino: { ativo: true, isBase: false } }]),
    ...(ator.setorId !== null && isSameRole(ator.setorNome, "TI") ? [{ setorDestinoId: null }] : [])] };
}
export const chamadoAcessoSelect = {
  id: true, usuarioId: true, tecnicoId: true, tecnicoSolicitadoId: true, status: true, setorDestinoId: true,
  setorDestino: { select: { id: true, nome: true, ativo: true, isBase: true } },
} satisfies Prisma.chamadosSelect;
