"use server";

import { revalidatePath } from "next/cache";

import { registrarAuditoriaCalendarioAlpha } from "@/lib/google-calendar/auditoria";
import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import db from "@/lib/prisma";

export interface StatusConexaoCalendarioAlpha {
  conectado: boolean;
  conexaoId?: string;
  emailUsuario?: string;
  status?: "ATIVA" | "DESATIVADA";
  ativadoEm?: string;
  ultimaSincronizacaoEm?: string | null;
}

/**
 * Status da ativação do Calendário Alpha para o usuário logado. Não existe "conta Google conectada"
 * individual aqui — o acesso real é concedido em bloco pelo Super Admin do Workspace (Domain-Wide
 * Delegation); isto só reflete se o usuário optou por usar o módulo dentro do Painel.
 */
export async function obterStatusConexaoCalendarioAlpha(): Promise<StatusConexaoCalendarioAlpha> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { conectado: false };

  const [usuario, conexao] = await Promise.all([
    db.usuarios.findUnique({ where: { id: acesso.userId }, select: { email: true } }),
    db.googleCalendarConexao.findUnique({
      where: { userId: acesso.userId },
      select: { id: true, status: true, ativadoEm: true, ultimaSincronizacaoEm: true },
    }),
  ]);

  if (!conexao) return { conectado: false, emailUsuario: usuario?.email };

  return {
    conectado: conexao.status === "ATIVA",
    conexaoId: conexao.id,
    emailUsuario: usuario?.email,
    status: conexao.status as StatusConexaoCalendarioAlpha["status"],
    ativadoEm: conexao.ativadoEm.toISOString(),
    ultimaSincronizacaoEm: conexao.ultimaSincronizacaoEm?.toISOString() ?? null,
  };
}

/** Ativa o módulo para o usuário logado — operação puramente local, sem chamada ao Google. */
export async function ativarCalendarioAlpha(): Promise<{ success: boolean; error?: string }> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const usuario = await db.usuarios.findUnique({ where: { id: acesso.userId }, select: { email: true } });
  if (!usuario?.email) return { success: false, error: "Usuário sem e-mail cadastrado." };

  await db.googleCalendarConexao.upsert({
    where: { userId: acesso.userId },
    create: { userId: acesso.userId, status: "ATIVA" },
    update: { status: "ATIVA", desativadoEm: null },
  });

  await registrarAuditoriaCalendarioAlpha(acesso.userId, "CALENDARIO_ALPHA_ATIVADO", `conta=${usuario.email}`);

  revalidatePath("/PainelAlpha/CalendarioAlpha");
  return { success: true };
}

/** Desativa o módulo para o usuário logado. Não revoga o Domain-Wide Delegation (isso só o Super Admin faz no Workspace). */
export async function desativarCalendarioAlpha(): Promise<{ success: boolean; error?: string }> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const conexao = await db.googleCalendarConexao.findUnique({ where: { userId: acesso.userId }, select: { id: true } });
  if (!conexao) return { success: true }; // idempotente — já desativado

  await db.googleCalendarConexao.update({
    where: { id: conexao.id },
    data: { status: "DESATIVADA", desativadoEm: new Date() },
  });

  await registrarAuditoriaCalendarioAlpha(acesso.userId, "CALENDARIO_ALPHA_DESATIVADO");

  revalidatePath("/PainelAlpha/CalendarioAlpha");
  return { success: true };
}
