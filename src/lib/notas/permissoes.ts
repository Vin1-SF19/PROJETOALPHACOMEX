import db from "@/lib/prisma";
import { isAdminRole, isSameRole } from "@/lib/roles";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { MODULOS_REGISTRY } from "@/lib/modulos-registry";
import type { RolePermissaoNota } from "@/lib/validations/notas";

interface UsuarioContexto {
  id: number;
  role: string;
}

interface NotaComRelacoes {
  ownerId: number;
  createdById: number;
  deletedAt: Date | null;
  permissions: { subjectType: string; subjectId: string; role: string }[];
  contexts: { moduleKey: string }[];
}

/**
 * Resolve o papel efetivo do usuário sobre a nota (dono conta como ADMIN implícito).
 * Retorna null se não houver nenhum acesso.
 */
async function resolverPapelEfetivo(
  usuario: UsuarioContexto,
  nota: NotaComRelacoes,
): Promise<RolePermissaoNota | "OWNER" | null> {
  if (isAdminRole(usuario.role)) return "ADMIN";
  if (nota.ownerId === usuario.id) return "OWNER";

  for (const permissao of nota.permissions) {
    if (permissao.subjectType === "USUARIO" && permissao.subjectId === String(usuario.id)) {
      return permissao.role as RolePermissaoNota;
    }
    if (permissao.subjectType === "SETOR" && isSameRole(permissao.subjectId, usuario.role)) {
      return permissao.role as RolePermissaoNota;
    }
    if (permissao.subjectType === "ROLE" && isSameRole(permissao.subjectId, usuario.role)) {
      return permissao.role as RolePermissaoNota;
    }
  }

  return null;
}

/**
 * Nota vinculada a um módulo restrito só é visível a quem também tem a permissão daquele
 * módulo (herança de permissão contextual — Seção 8.1 do prompt original). Admin/CEO/TI
 * sempre bypassam (mesmo padrão do resto do painel).
 */
async function respeitaPermissaoDeContexto(
  usuario: UsuarioContexto,
  nota: NotaComRelacoes,
): Promise<boolean> {
  if (isAdminRole(usuario.role)) return true;
  if (nota.contexts.length === 0) return true;

  const permissoesEfetivas = await getPermissoesEfetivas(usuario.id);

  return nota.contexts.every((contexto) => {
    const modulo = MODULOS_REGISTRY.find((m) => m.id === contexto.moduleKey);
    if (!modulo) return true; // moduleKey não corresponde a módulo com permissão restrita conhecida
    if (!modulo.permission) return true;
    return permissoesEfetivas.includes(modulo.permission);
  });
}

async function carregarNotaComRelacoes(noteId: string): Promise<NotaComRelacoes | null> {
  return db.note.findUnique({
    where: { id: noteId },
    select: {
      ownerId: true,
      createdById: true,
      deletedAt: true,
      permissions: { select: { subjectType: true, subjectId: true, role: true } },
      contexts: { select: { moduleKey: true } },
    },
  });
}

async function checarAcesso(
  usuario: UsuarioContexto,
  noteId: string,
  papeisAceitos: (RolePermissaoNota | "OWNER" | "ADMIN")[],
): Promise<boolean> {
  const nota = await carregarNotaComRelacoes(noteId);
  if (!nota) return false;

  const papel = await resolverPapelEfetivo(usuario, nota);
  if (!papel) return false;
  if (papel === "OWNER" || papel === "ADMIN") {
    return respeitaPermissaoDeContexto(usuario, nota);
  }
  if (!papeisAceitos.includes(papel)) return false;

  return respeitaPermissaoDeContexto(usuario, nota);
}

export async function podeVisualizarNota(usuario: UsuarioContexto, noteId: string): Promise<boolean> {
  return checarAcesso(usuario, noteId, ["LEITOR", "COMENTARISTA", "EDITOR", "ADMIN"]);
}

export async function podeEditarNota(usuario: UsuarioContexto, noteId: string): Promise<boolean> {
  return checarAcesso(usuario, noteId, ["EDITOR", "ADMIN"]);
}

export async function podeComentarNota(usuario: UsuarioContexto, noteId: string): Promise<boolean> {
  return checarAcesso(usuario, noteId, ["COMENTARISTA", "EDITOR", "ADMIN"]);
}

export async function podeCompartilharNota(usuario: UsuarioContexto, noteId: string): Promise<boolean> {
  return checarAcesso(usuario, noteId, ["ADMIN"]);
}

export async function podeAlterarPermissoesNota(usuario: UsuarioContexto, noteId: string): Promise<boolean> {
  return checarAcesso(usuario, noteId, ["ADMIN"]);
}

export async function podeArquivarNota(usuario: UsuarioContexto, noteId: string): Promise<boolean> {
  return checarAcesso(usuario, noteId, ["EDITOR", "ADMIN"]);
}

export async function podeRestaurarNota(usuario: UsuarioContexto, noteId: string): Promise<boolean> {
  return checarAcesso(usuario, noteId, ["EDITOR", "ADMIN"]);
}

export async function podeExcluirNota(usuario: UsuarioContexto, noteId: string): Promise<boolean> {
  return checarAcesso(usuario, noteId, ["ADMIN"]);
}

export async function podeExcluirDefinitivamenteNota(
  usuario: UsuarioContexto,
  noteId: string,
): Promise<boolean> {
  if (isAdminRole(usuario.role)) return true;
  const nota = await carregarNotaComRelacoes(noteId);
  if (!nota) return false;
  return nota.ownerId === usuario.id;
}

export async function podeConsultarHistoricoNota(usuario: UsuarioContexto, noteId: string): Promise<boolean> {
  return checarAcesso(usuario, noteId, ["LEITOR", "COMENTARISTA", "EDITOR", "ADMIN"]);
}

export async function podeRestaurarVersaoNota(usuario: UsuarioContexto, noteId: string): Promise<boolean> {
  return checarAcesso(usuario, noteId, ["EDITOR", "ADMIN"]);
}
