"use server";

import { auth } from "../../auth";
import db from "@/lib/prisma";
import type { Session } from "next-auth";
import { SETOR_GERAL } from "@/lib/pop-acessos";
import { isAdminRole, isSameRole, normalizeRole } from "@/lib/roles";

// ─── Constantes ────────────────────────────────────────────────────────────────

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sessionUser(session: Session | null) {
  return session?.user as { id: string; role: string } | undefined;
}

function ehAdmin(role: string) {
  return isAdminRole(role);
}

// ─── Core: setores acessíveis para um usuário ──────────────────────────────────
// Retorna ['*'] para admin/CEO (wildcard = tudo).
// Demais: próprio setor + "Diretrizes" + acessos extras concedidos.

async function getSetoresAcessiveis(userId: number): Promise<string[]> {
  const user = await db.usuarios.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return [];

  if (ehAdmin(user.role)) return ["*"];

  const extras = await db.popAcesso.findMany({
    where: { usuarioId: userId, podeVer: true, setor: { not: SETOR_GERAL } },
    select: { setor: true },
  });

  const setoresExtras = extras.map((e) => e.setor);
  const setorProprio = normalizeRole(user.role);

  return ["Diretrizes", setorProprio, ...setoresExtras];
}

// ─── getAcessosDoUsuario ───────────────────────────────────────────────────────
// Chamado pela página DocsAlpha (client) via useEffect.
// Retorna tudo que o frontend precisa para renderizar permissões.

export async function getAcessosDoUsuario(): Promise<{
  success: boolean;
  setoresAcessiveis: string[];
  podeUpload: boolean;
  podeGerenciar: boolean;
  ehAdminUser: boolean;
  error?: string;
}> {
  const session = await auth();
  const user = sessionUser(session);

  if (!user?.id) {
    return { success: false, setoresAcessiveis: [], podeUpload: false, podeGerenciar: false, ehAdminUser: false, error: "Não autorizado" };
  }

  const userId = Number(user.id);
  const isAdminUser = ehAdmin(user.role);
  const setoresAcessiveis = await getSetoresAcessiveis(userId);

  if (isAdminUser) {
    return { success: true, setoresAcessiveis, podeUpload: true, podeGerenciar: true, ehAdminUser: true };
  }

  const [acessos, usuarioDB] = await Promise.all([
    db.popAcesso.findMany({
      where: { usuarioId: userId },
      select: { podeUpload: true, podeGerenciar: true },
    }),
    db.usuarios.findUnique({
      where: { id: userId },
      select: { permissoes: true },
    }),
  ]);

  const permissoes = usuarioDB?.permissoes ?? "";
  const podeUpload = acessos.some((a) => a.podeUpload) || permissoes.includes("UpDocumentos");
  const podeGerenciar = acessos.some((a) => a.podeGerenciar) || permissoes.includes("Historico");

  return { success: true, setoresAcessiveis, podeUpload, podeGerenciar, ehAdminUser: false };
}

// ─── getMatrizAcessos ──────────────────────────────────────────────────────────
// Admin only. Retorna todos usuários + seus acessos extras.

export type UsuarioMatriz = {
  id: number;
  nome: string;
  role: string;
  setorProprio: string;
  acessos: { setor: string; podeVer: boolean; podeUpload: boolean; podeGerenciar: boolean }[];
  /** Acesso geral ao botão "Upload" do header do POP (GerenciamentoArquivos). */
  podeUploadGeral: boolean;
  /** Acesso geral ao botão "Gerenciar" do header do POP (HistoricoArquivos). */
  podeGerenciarGeral: boolean;
};

export async function getMatrizAcessos(): Promise<{ success: boolean; data?: UsuarioMatriz[]; error?: string }> {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id || !ehAdmin(user.role)) {
    return { success: false, error: "Acesso restrito a administradores" };
  }

  const usuarios = await db.usuarios.findMany({
    where: { status: "ATIVO" },
    select: {
      id: true,
      nome: true,
      role: true,
      popAcessos: { select: { setor: true, podeVer: true, podeUpload: true, podeGerenciar: true } },
    },
    orderBy: { nome: "asc" },
  });

  const data: UsuarioMatriz[] = usuarios.map((u) => {
    const linhaGeral = u.popAcessos.find((a) => a.setor === SETOR_GERAL);
    return {
      id: u.id,
      nome: u.nome,
      role: u.role,
      setorProprio: normalizeRole(u.role),
      acessos: u.popAcessos.filter((a) => a.setor !== SETOR_GERAL),
      podeUploadGeral: linhaGeral?.podeUpload ?? false,
      podeGerenciarGeral: linhaGeral?.podeGerenciar ?? false,
    };
  });

  return { success: true, data };
}

// ─── salvarAcessos ─────────────────────────────────────────────────────────────
// Admin only. Recebe lista completa de acessos extras para um usuário.
// Faz upsert/delete — NUNCA toca o setor próprio.

export type AcessoPayload = {
  usuarioId: number;
  setor: string;
  podeVer: boolean;
  podeUpload: boolean;
  podeGerenciar: boolean;
};

export async function salvarAcessos(
  payload: AcessoPayload[],
  usuariosAfetados?: number[]
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id || !ehAdmin(user.role)) {
    return { success: false, error: "Acesso restrito a administradores" };
  }

  const adminId = Number(user.id);

  // Rate limit simples: máx 500 operações por chamada
  if (payload.length > 500) {
    return { success: false, error: "Payload excede limite de operações" };
  }

  // Merge payload userIds com usuariosAfetados (usuários sem novos acessos que precisam de deleteMany)
  const idsNoPayload = new Set(payload.map((p) => p.usuarioId));
  const todosIds = new Set([...idsNoPayload, ...(usuariosAfetados ?? [])]);
  const usuariosEnvolvidos = [...todosIds];

  // Validar que nenhum acesso tenta tocar o setor próprio do usuário alvo
  const usuariosDB = await db.usuarios.findMany({
    where: { id: { in: usuariosEnvolvidos } },
    select: { id: true, role: true },
  });
  const setorMap = new Map(usuariosDB.map((u) => [u.id, u.role]));

  for (const item of payload) {
    if (item.setor === SETOR_GERAL) continue; // linha reservada — não é setor de conteúdo
    const setorProprio = setorMap.get(item.usuarioId);
    if (setorProprio && isSameRole(item.setor, setorProprio)) {
      return { success: false, error: `Setor próprio não pode ser alterado via PopAcesso (usuário ${item.usuarioId})` };
    }
  }

  // Agrupar por usuário: deletar todos extras atuais e reinserir
  for (const usuarioId of usuariosEnvolvidos) {
    const itensDoUsuario = payload.filter((p) => p.usuarioId === usuarioId);

    await db.popAcesso.deleteMany({ where: { usuarioId } });

    if (itensDoUsuario.length > 0) {
      await db.popAcesso.createMany({
        data: itensDoUsuario.map((item) => ({
          usuarioId: item.usuarioId,
          setor: item.setor,
          podeVer: item.podeVer,
          podeUpload: item.podeUpload,
          podeGerenciar: item.podeGerenciar,
          concedidoPor: adminId,
        })),
      });
    }
  }

  return { success: true };
}

// ─── concederAcesso ────────────────────────────────────────────────────────────

export async function concederAcesso(
  usuarioId: number,
  setor: string,
  perms: { podeVer?: boolean; podeUpload?: boolean; podeGerenciar?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id || !ehAdmin(user.role)) {
    return { success: false, error: "Acesso restrito a administradores" };
  }

  // Bloquear setor próprio
  const alvo = await db.usuarios.findUnique({ where: { id: usuarioId }, select: { role: true } });
  if (alvo && isSameRole(setor, alvo.role)) {
    return { success: false, error: "Setor próprio sempre acessível — não precisa de registro" };
  }

  await db.popAcesso.upsert({
    where: { usuarioId_setor: { usuarioId, setor } },
    create: {
      usuarioId,
      setor,
      podeVer: perms.podeVer ?? true,
      podeUpload: perms.podeUpload ?? false,
      podeGerenciar: perms.podeGerenciar ?? false,
      concedidoPor: Number(user.id),
    },
    update: {
      podeVer: perms.podeVer ?? true,
      podeUpload: perms.podeUpload ?? false,
      podeGerenciar: perms.podeGerenciar ?? false,
      concedidoPor: Number(user.id),
    },
  });

  return { success: true };
}

// ─── revogarAcesso ─────────────────────────────────────────────────────────────

export async function revogarAcesso(
  usuarioId: number,
  setor: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const user = sessionUser(session);
  if (!user?.id || !ehAdmin(user.role)) {
    return { success: false, error: "Acesso restrito a administradores" };
  }

  // Bloquear revogação do setor próprio
  const alvo = await db.usuarios.findUnique({ where: { id: usuarioId }, select: { role: true } });
  if (alvo && isSameRole(setor, alvo.role)) {
    return { success: false, error: "Não é possível revogar o acesso ao setor próprio" };
  }

  await db.popAcesso.deleteMany({ where: { usuarioId, setor } });

  return { success: true };
}

