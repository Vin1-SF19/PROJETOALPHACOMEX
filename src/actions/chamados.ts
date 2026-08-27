"use server"

import { auth } from "../../auth";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pusherServer } from "@/lib/pusher-server.ts";
import {
  notificarChamadoConcluido,
  notificarNovoChamado,
} from "@/lib/chamados/notificacoes-server";
import {
  concluirTarefaAgendadaDoChamado,
  criarTarefaAgendadaParaChamado,
} from "@/lib/chamados/tarefa-agendada";

export async function updateChamadosStatus(id: number, novoStatus: string, solucao?: string) {
  const session = await auth();
  if (!session) return { success: false, error: "Não autorizado" };

  try {
    const chamadoAtualizado = await db.chamados.update({
      where: { id },
      data: {
        status: novoStatus,
        ...(solucao && { solucao }),
      },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        usuarioId: true,
        solucao: true,
        updatedAt: true,
      },
    });

    if (novoStatus === "CONCLUIDO") {
      await notificarChamadoConcluido(chamadoAtualizado.usuarioId, {
        chamadoId: chamadoAtualizado.id,
        titulo: chamadoAtualizado.titulo,
        solucao: chamadoAtualizado.solucao ?? undefined,
        createdAt: chamadoAtualizado.updatedAt.toISOString(),
      });
    }

    try {
      const tecnicoId = Number(session.user.id);
      if (novoStatus === "EM_ATENDIMENTO") {
        await criarTarefaAgendadaParaChamado({
          chamado: chamadoAtualizado,
          tecnicoId,
          tecnicoRole: session.user.role,
        });
      }
      if (novoStatus === "CONCLUIDO") {
        await concluirTarefaAgendadaDoChamado({
          chamadoId: chamadoAtualizado.id,
          concluidoEm: chamadoAtualizado.updatedAt,
          tecnicoId,
          tecnicoRole: session.user.role,
        });
      }
    } catch (error) {
      // A mudança de status não pode deixar o chamado preso se o Google falhar.
      console.error("[chamados] Falha na automação da Agenda Alpha", {
        chamadoId: chamadoAtualizado.id,
        status: novoStatus,
        message: error instanceof Error ? error.message : "erro desconhecido",
      });
    }

    revalidatePath("/PainelAlpha/Chamados");
    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true };
  } catch {
    return { success: false, error: "Erro ao atualizar status." };
  }
}

async function avisarNoZap(titulo: string, quem: string, urgencia: string, data: string) {
  const numeroDono = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_API_KEY;

  if (!numeroDono || !apiKey) return;

  const textoFormatado =
    `*🚨 NOVO CHAMADO NO PAINEL*\n\n` +
    `*👤 Autor:* ${quem}\n` +
    `*📅 Data:* ${data}\n` +
    `*🔥 Urgência:* ${urgencia}\n` +
    `*📝 Assunto:* ${titulo}\n\n` +
    `_Enviado por Bibble AI_`;

  const url = `https://api.callmebot.com/whatsapp.php?phone=${numeroDono}&text=${encodeURIComponent(textoFormatado)}&apikey=${apiKey}`;

  try {
    await fetch(url, { method: "GET" });
  } catch {
    // Notificação não-crítica — falha silenciosamente
  }
}

export async function createChamadoAction(formData: FormData) {
  const session = await auth();
  if (!session) return { error: "Sessão expirada. Refaça o login." };

  const titulo = (formData.get("titulo") as string).trim();
  const categoria = formData.get("categoria") as string;
  const prioridade = formData.get("prioridade") as string;
  const descricao = (formData.get("descricao") as string).trim();

  try {
    const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000);
    const duplicado = await db.chamados.findFirst({
      where: {
        usuarioId: Number(session.user.id),
        titulo,
        createdAt: { gte: cincoMinutosAtras },
      },
    });

    if (duplicado) {
      return { error: "Você já enviou um chamado similar recentemente. Aguarde 5 minutos." };
    }

    const novoChamado = await db.chamados.create({
      data: {
        titulo,
        categoria,
        prioridade,
        descricao,
        usuarioId: Number(session.user.id),
        status: "ABERTO",
      },
    });

    const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    await notificarNovoChamado({
      chamadoId: novoChamado.id,
      titulo: novoChamado.titulo,
      usuario: session.user.nome || "Usuário",
      setor: session.user.role || "",
      urgencia: novoChamado.prioridade,
      createdAt: novoChamado.createdAt.toISOString(),
    });

    await avisarNoZap(
      titulo,
      session.user.nome || "Usuário Desconhecido",
      prioridade.toUpperCase(),
      dataFormatada
    );
  } catch (error) {
    console.error("Erro ao criar chamado:", error);
    return { error: "Falha ao registrar chamado no banco de dados." };
  }

  revalidatePath("/PainelAlpha/Chamados");
  redirect("/PainelAlpha/Chamados");
}

export async function enviarMensagemAction(
  chamadoId: number,
  texto?: string,
  arquivoUrl?: string,
  arquivoTipo?: string
) {
  const session = await auth();
  if (!session) return { error: "Não autorizado" };

  try {
    const novaMsg = await db.mensagensChamado.create({
      data: {
        texto: texto || "",
        chamadoId: Number(chamadoId),
        autorId: Number(session.user.id),
        arquivoUrl: arquivoUrl || null,
        arquivoTipo: arquivoTipo || null,
      },
      include: { autor: true },
    });

    await pusherServer.trigger(`chat-${chamadoId}`, "nova-mensagem", novaMsg);
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro no Prisma:", msg);
    return { error: "Erro interno no banco de dados" };
  }
}

export async function marcarComoLidaAction(chamadoId: number, isAdmin: boolean) {
  const session = await auth();
  if (!session) return { error: "Não autorizado" };

  try {
    await db.mensagensChamado.updateMany({
      where: { chamadoId: Number(chamadoId) },
      data: isAdmin ? { lida_admin: true } : { lida_usuario: true },
    });

    revalidatePath("/PainelAlpha/Chamados");
    return { success: true };
  } catch {
    return { error: "Erro ao atualizar" };
  }
}
