"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import { proximaCorColega } from "@/lib/google-calendar/colegas";
import {
  CALENDARIO_ALPHA_SOLICITACAO_RECEBIDA_EVENT,
  CALENDARIO_ALPHA_SOLICITACAO_RESPONDIDA_EVENT,
  canalCalendarioAlphaDoUsuario,
  type CalendarioAlphaSolicitacaoRecebidaPayload,
  type CalendarioAlphaSolicitacaoRespondidaPayload,
} from "@/lib/google-calendar/notificacoes";
import { pusherServer } from "@/lib/pusher-server.ts";
import db from "@/lib/prisma";

type ResultadoAcao<T> = { success: true; data: T } | { success: false; error: string };

const papelSchema = z.enum(["VISUALIZADOR", "EDITOR"]);

const solicitarCompartilhamentoSchema = z
  .object({
    alvoId: z.number().int().positive(),
    papelPedido: papelSchema,
  })
  .strict();

const solicitacaoIdSchema = z.object({ solicitacaoId: z.string().min(1) }).strict();

async function obterUsuario(userId: number) {
  return db.usuarios.findUnique({ where: { id: userId }, select: { nome: true } });
}

/**
 * Pede para ver/editar a agenda de `alvoId` — não cria acesso direto. `alvoId` recebe uma
 * notificação e precisa aprovar (`aprovarSolicitacao`) antes de qualquer vínculo em
 * GoogleCalendarColegaVisivel existir. Vale para TODOS, inclusive Admin/CEO (decisão de
 * 2026-08-17, reverte o bypass que existia antes — ver `decisions.md`).
 */
export async function solicitarCompartilhamento(alvoId: number, papelPedido: "VISUALIZADOR" | "EDITOR"): Promise<ResultadoAcao<{ id: string }>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = solicitarCompartilhamentoSchema.safeParse({ alvoId, papelPedido });
  if (!validacao.success || validacao.data.alvoId === acesso.userId) {
    return { success: false, error: "Destinatário inválido." };
  }
  const dados = validacao.data;

  const alvo = await db.usuarios.findUnique({ where: { id: dados.alvoId }, select: { id: true, status: true } });
  if (!alvo || alvo.status !== "ATIVO") return { success: false, error: "Colaborador não encontrado." };

  const vinculoExistente = await db.googleCalendarColegaVisivel.findUnique({
    where: { userId_colegaId: { userId: acesso.userId, colegaId: dados.alvoId } },
  });
  if (vinculoExistente) return { success: false, error: "Você já tem acesso à agenda deste colaborador." };

  const pendenteExistente = await db.googleCalendarSolicitacaoCompartilhamento.findFirst({
    where: { solicitanteId: acesso.userId, alvoId: dados.alvoId, status: "PENDENTE" },
  });
  if (pendenteExistente) return { success: false, error: "Você já tem um pedido pendente para este colaborador." };

  const solicitacao = await db.googleCalendarSolicitacaoCompartilhamento.create({
    data: { solicitanteId: acesso.userId, alvoId: dados.alvoId, papelPedido: dados.papelPedido },
    select: { id: true },
  });

  const solicitante = await obterUsuario(acesso.userId);
  const payload: CalendarioAlphaSolicitacaoRecebidaPayload = {
    solicitacaoId: solicitacao.id,
    solicitanteNome: solicitante?.nome ?? "Um colaborador",
    papelPedido: dados.papelPedido,
    createdAt: new Date().toISOString(),
  };
  await pusherServer.trigger(
    canalCalendarioAlphaDoUsuario(dados.alvoId),
    CALENDARIO_ALPHA_SOLICITACAO_RECEBIDA_EVENT,
    payload,
  );

  return { success: true, data: solicitacao };
}

/** Solicitações PENDENTES recebidas pelo usuário logado (para aprovar/recusar). */
export async function listarSolicitacoesPendentesRecebidas() {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false as const, error: "Não autorizado." };

  const solicitacoes = await db.googleCalendarSolicitacaoCompartilhamento.findMany({
    where: { alvoId: acesso.userId, status: "PENDENTE" },
    include: { solicitante: { select: { id: true, nome: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return { success: true as const, data: solicitacoes };
}

/** Solicitações que o usuário logado enviou (para acompanhar status). */
export async function listarMinhasSolicitacoesEnviadas() {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false as const, error: "Não autorizado." };

  const solicitacoes = await db.googleCalendarSolicitacaoCompartilhamento.findMany({
    where: { solicitanteId: acesso.userId },
    include: { alvo: { select: { id: true, nome: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return { success: true as const, data: solicitacoes };
}

/** Aprova um pedido: cria (ou reativa) o vínculo em GoogleCalendarColegaVisivel com o papel pedido. */
export async function aprovarSolicitacao(solicitacaoId: string): Promise<{ success: boolean; error?: string }> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = solicitacaoIdSchema.safeParse({ solicitacaoId });
  if (!validacao.success) return { success: false, error: "Solicitação inválida." };

  const solicitacao = await db.googleCalendarSolicitacaoCompartilhamento.findUnique({
    where: { id: validacao.data.solicitacaoId },
  });
  if (!solicitacao || solicitacao.alvoId !== acesso.userId || solicitacao.status !== "PENDENTE") {
    return { success: false, error: "Solicitação não encontrada ou já respondida." };
  }

  const totalAtual = await db.googleCalendarColegaVisivel.count({ where: { userId: solicitacao.solicitanteId } });

  await db.$transaction([
    db.googleCalendarSolicitacaoCompartilhamento.update({
      where: { id: solicitacao.id },
      data: { status: "ACEITO", respondidoEm: new Date() },
    }),
    db.googleCalendarColegaVisivel.upsert({
      where: { userId_colegaId: { userId: solicitacao.solicitanteId, colegaId: solicitacao.alvoId } },
      create: {
        userId: solicitacao.solicitanteId,
        colegaId: solicitacao.alvoId,
        papel: solicitacao.papelPedido,
        cor: proximaCorColega(totalAtual),
        visivel: true,
      },
      update: { papel: solicitacao.papelPedido, visivel: true },
    }),
  ]);

  const alvo = await obterUsuario(acesso.userId);
  const payload: CalendarioAlphaSolicitacaoRespondidaPayload = {
    solicitacaoId: solicitacao.id,
    alvoNome: alvo?.nome ?? "O colaborador",
    status: "ACEITO",
    papelPedido: solicitacao.papelPedido as "VISUALIZADOR" | "EDITOR",
    createdAt: new Date().toISOString(),
  };
  await pusherServer.trigger(
    canalCalendarioAlphaDoUsuario(solicitacao.solicitanteId),
    CALENDARIO_ALPHA_SOLICITACAO_RESPONDIDA_EVENT,
    payload,
  );

  revalidatePath("/PainelAlpha/CalendarioAlpha");
  return { success: true };
}

/** Recusa um pedido — nenhum vínculo é criado. */
export async function recusarSolicitacao(solicitacaoId: string): Promise<{ success: boolean; error?: string }> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = solicitacaoIdSchema.safeParse({ solicitacaoId });
  if (!validacao.success) return { success: false, error: "Solicitação inválida." };

  const solicitacao = await db.googleCalendarSolicitacaoCompartilhamento.findUnique({
    where: { id: validacao.data.solicitacaoId },
  });
  if (!solicitacao || solicitacao.alvoId !== acesso.userId || solicitacao.status !== "PENDENTE") {
    return { success: false, error: "Solicitação não encontrada ou já respondida." };
  }

  await db.googleCalendarSolicitacaoCompartilhamento.update({
    where: { id: solicitacao.id },
    data: { status: "RECUSADO", respondidoEm: new Date() },
  });

  const alvo = await obterUsuario(acesso.userId);
  const payload: CalendarioAlphaSolicitacaoRespondidaPayload = {
    solicitacaoId: solicitacao.id,
    alvoNome: alvo?.nome ?? "O colaborador",
    status: "RECUSADO",
    papelPedido: solicitacao.papelPedido as "VISUALIZADOR" | "EDITOR",
    createdAt: new Date().toISOString(),
  };
  await pusherServer.trigger(
    canalCalendarioAlphaDoUsuario(solicitacao.solicitanteId),
    CALENDARIO_ALPHA_SOLICITACAO_RESPONDIDA_EVENT,
    payload,
  );

  revalidatePath("/PainelAlpha/CalendarioAlpha");
  return { success: true };
}
