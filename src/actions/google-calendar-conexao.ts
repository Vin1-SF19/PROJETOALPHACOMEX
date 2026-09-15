"use server";

import { revalidatePath } from "next/cache";

import { registrarAuditoriaCalendarioAlpha } from "@/lib/google-calendar/auditoria";
import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import { listarCalendarios } from "@/lib/google-calendar/client";
import { mapearComConcorrencia } from "@/lib/google-calendar/concurrency";
import {
  calcularSaudeAgendaAlpha,
  type SaudeAgendaAlpha,
} from "@/lib/google-calendar/health";
import { criarCanalPush } from "@/lib/google-calendar/push-channels";
import { lerAgendaAlphaRuntimeConfig } from "@/lib/google-calendar/runtime-config";
import { orquestrarSincronizacaoCalendario } from "@/lib/google-calendar/sync-orchestrator";
import db from "@/lib/prisma";

const CONCORRENCIA_ATIVACAO = 3;

export interface StatusConexaoCalendarioAlpha {
  conectado: boolean;
  conexaoId?: string;
  emailUsuario?: string;
  status?: "ATIVA" | "DESATIVADA";
  ativadoEm?: string;
  ultimaSincronizacaoEm?: string | null;
  saude?: SaudeAgendaAlpha;
}

/**
 * Status da ativação do Calendário Alpha para o usuário logado. Não existe "conta Google conectada"
 * individual aqui — o acesso real é concedido em bloco pelo Super Admin do Workspace (Domain-Wide
 * Delegation); isto só reflete se o usuário optou por usar o módulo dentro do Painel.
 */
export async function obterStatusConexaoCalendarioAlpha(): Promise<StatusConexaoCalendarioAlpha> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { conectado: false };

  const limiteFilaParada = new Date(Date.now() - 15 * 60 * 1_000);
  const [usuario, conexao] = await Promise.all([
    db.usuarios.findUnique({ where: { id: acesso.userId }, select: { email: true } }),
    db.googleCalendarConexao.findUnique({
      where: { userId: acesso.userId },
      select: {
        id: true,
        status: true,
        ativadoEm: true,
        ultimaSincronizacaoEm: true,
        calendarios: {
          select: {
            visivel: true,
            syncToken: true,
            ultimaSincronizacaoEm: true,
            _count: { select: { eventos: true } },
            pushChannels: {
              where: { status: { in: ["ACTIVE", "CREATING", "ERROR"] } },
              select: { status: true, expiresAt: true },
            },
            pendingOperations: {
              where: {
                OR: [
                  { status: "DEAD_LETTER" },
                  { status: { in: ["PENDING", "RETRY"] }, updatedAt: { lte: limiteFilaParada } },
                ],
              },
              select: { id: true },
            },
          },
        },
      },
    }),
  ]);

  if (!conexao) return { conectado: false, emailUsuario: usuario?.email };

  const conectado = conexao.status === "ATIVA";
  const runtime = lerAgendaAlphaRuntimeConfig();
  const ultimaSincronizacaoVisivel = conexao.calendarios
    .filter((calendario) => calendario.visivel && calendario.ultimaSincronizacaoEm)
    .reduce<Date | null>((maisRecente, calendario) => {
      const atual = calendario.ultimaSincronizacaoEm;
      if (!atual || (maisRecente && atual <= maisRecente)) return maisRecente;
      return atual;
    }, conexao.ultimaSincronizacaoEm);
  return {
    conectado,
    conexaoId: conexao.id,
    emailUsuario: usuario?.email,
    status: conexao.status as StatusConexaoCalendarioAlpha["status"],
    ativadoEm: conexao.ativadoEm.toISOString(),
    ultimaSincronizacaoEm: ultimaSincronizacaoVisivel?.toISOString() ?? null,
    saude: calcularSaudeAgendaAlpha({
      conectado,
      runtime,
      calendarios: conexao.calendarios.map((calendario) => ({
        visivel: calendario.visivel,
        syncToken: calendario.syncToken,
        ultimaSincronizacaoEm: calendario.ultimaSincronizacaoEm,
        eventosEmCache: calendario._count.eventos,
        canais: calendario.pushChannels,
        operacoesComErro: calendario.pendingOperations.length,
      })),
    }),
  };
}

/**
 * Ativa e prepara o módulo: seleciona a agenda principal quando necessário,
 * executa o primeiro sync e tenta instalar push sem bloquear o uso manual.
 */
export async function ativarCalendarioAlpha(): Promise<{
  success: boolean;
  error?: string;
  warning?: string;
  ativada?: boolean;
}> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const usuario = await db.usuarios.findUnique({ where: { id: acesso.userId }, select: { email: true } });
  if (!usuario?.email) return { success: false, error: "Usuário sem e-mail cadastrado." };

  const conexao = await db.googleCalendarConexao.upsert({
    where: { userId: acesso.userId },
    create: { userId: acesso.userId, status: "ATIVA" },
    update: { status: "ATIVA", desativadoEm: null },
    select: { id: true },
  });

  try {
    let calendarios = await db.googleCalendarSelecionado.findMany({
      where: { conexaoId: conexao.id, visivel: true },
      select: { id: true, googleCalendarId: true, syncToken: true },
    });
    if (calendarios.length === 0) {
      const disponiveis = await listarCalendarios(usuario.email);
      const principal = disponiveis.find((calendario) => calendario.principal) ?? disponiveis[0];
      if (!principal) {
        revalidatePath("/PainelAlpha/CalendarioAlpha");
        return {
          success: false,
          ativada: true,
          error: "A Agenda foi ativada, mas nenhuma agenda foi encontrada na conta Google.",
        };
      }
      const selecionado = await db.googleCalendarSelecionado.upsert({
        where: {
          conexaoId_googleCalendarId: {
            conexaoId: conexao.id,
            googleCalendarId: principal.googleCalendarId,
          },
        },
        create: {
          conexaoId: conexao.id,
          googleCalendarId: principal.googleCalendarId,
          nome: principal.nome,
          corHex: principal.corHex,
          timezone: principal.timezone,
          papelAcesso: principal.papelAcesso,
          visivel: true,
          gravavel: principal.papelAcesso === "owner" || principal.papelAcesso === "writer",
        },
        update: { visivel: true },
        select: { id: true, googleCalendarId: true, syncToken: true },
      });
      calendarios = [selecionado];
    }

    const resultados = await mapearComConcorrencia(
      calendarios,
      CONCORRENCIA_ATIVACAO,
      (calendario) =>
        orquestrarSincronizacaoCalendario({
          userId: acesso.userId,
          calendario,
          emailUsuario: usuario.email,
        }),
    );
    const todosSincronizados = resultados.every(
      (resultado) => resultado.status === "sincronizado",
    );
    if (todosSincronizados) {
      await db.googleCalendarConexao.update({
        where: { id: conexao.id },
        data: { ultimaSincronizacaoEm: new Date() },
      });
    }

    let warning: string | undefined;
    const runtime = lerAgendaAlphaRuntimeConfig();
    if (todosSincronizados && runtime.valid && runtime.pushEnabled && runtime.webhookBaseUrl) {
      const canais = await mapearComConcorrencia(
        calendarios,
        CONCORRENCIA_ATIVACAO,
        async (calendario) => {
          try {
            const existente = await db.googleCalendarPushChannel.findFirst({
              where: {
                calendarioId: calendario.id,
                status: { in: ["ACTIVE", "CREATING"] },
                expiresAt: { gt: new Date() },
              },
              select: { id: true },
            });
            if (!existente) {
              await criarCanalPush(calendario.id, {
                webhookBaseUrl: runtime.webhookBaseUrl!,
              });
            }
            return true;
          } catch {
            return false;
          }
        },
      );
      if (canais.some((canalCriado) => !canalCriado)) {
        warning = "Agenda sincronizada, mas a atualização automática será reparada pela manutenção.";
      }
    }
    if (!todosSincronizados) {
      revalidatePath("/PainelAlpha/CalendarioAlpha");
      return {
        success: false,
        ativada: true,
        error: "A Agenda foi ativada, mas a primeira sincronização não terminou. Tente novamente.",
      };
    }

    await registrarAuditoriaCalendarioAlpha(
      acesso.userId,
      "CALENDARIO_ALPHA_ATIVADO",
      `conta=${usuario.email}`,
    );
    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, warning };
  } catch {
    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return {
      success: false,
      ativada: true,
      error: "A Agenda foi ativada, mas não foi possível concluir a configuração com o Google.",
    };
  }
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
