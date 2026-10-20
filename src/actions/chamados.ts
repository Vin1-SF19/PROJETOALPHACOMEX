"use server"

import { auth } from "../../auth";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pusherServer } from "@/lib/pusher-server.ts";
import {
  notificarAgendaChamadoAtualizada,
  notificarChamadoAssumido,
  notificarChamadoConcluido,
  notificarMensagemChamado,
  notificarNovoChamado,
} from "@/lib/chamados/notificacoes-server";
import { resumirMensagemChamado } from "@/lib/chamados/notificacoes";
import { isSameRole } from "@/lib/roles";
import { chamadoAcessoSelect, chamadoDestinoEhTI, obterAtorChamados, podeAtenderChamado, podeResponderChamado, podeVerChamado } from "@/lib/chamados/acesso";
import { criarChamadoMultissetorial, ErroCriacaoChamado } from "@/lib/chamados/criacao";
import { canalChatChamado } from "@/lib/chamados/notificacoes";
import {
  concluirTarefaAgendadaDoChamado,
  criarTarefaAgendadaParaChamado,
} from "@/lib/chamados/tarefa-agendada";
import {
  atualizarChamadoStatusSchema,
  criarChamadoSchema,
  primeiraMensagemZod,
} from "@/lib/chamados/schemas";
import {
  concluirChamadoComFeedback,
  ErroConclusaoChamado,
} from "@/lib/chamados/conclusao";

export interface ChamadoOperacionalTI {
  id: number;
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: string;
  status: "ABERTO" | "EM_ATENDIMENTO";
  tecnicoId: number | null;
  tecnicoSolicitadoId: number | null;
  createdAt: string;
  updatedAt: string;
  solicitante: { nome: string; usuario: string };
  tecnico: { id: number; nome: string } | null;
  tecnicoSolicitado: { id: number; nome: string } | null;
  mensagens: Array<{
    id: number;
    texto: string | null;
    createdAt: string;
    autorId: number;
    arquivoUrl: string | null;
    arquivoTipo: string | null;
    autor: { id: number; nome: string; usuario: string };
  }>;
}

export async function listarChamadosAtivosTIAction(): Promise<{
  success: boolean;
  chamados: ChamadoOperacionalTI[];
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, chamados: [], error: "Não autorizado" };
  }
  const ator = await obterAtorChamados(session.user.id);
  if (!ator || !isSameRole(ator.role, "TI")) {
    return { success: false, chamados: [], error: "Permissão insuficiente" };
  }

  try {
    const chamados = await db.chamados.findMany({
      where: { status: { in: ["ABERTO", "EM_ATENDIMENTO"] }, OR: [{ setorDestinoId: null }, { setorDestino: { nome: ator.setorNome ?? "TI" } }] },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        titulo: true,
        descricao: true,
        categoria: true,
        prioridade: true,
        status: true,
        tecnicoId: true,
        tecnicoSolicitadoId: true,
        createdAt: true,
        updatedAt: true,
        solicitante: { select: { nome: true, usuario: true } },
        tecnico: { select: { id: true, nome: true } },
        tecnicoSolicitado: { select: { id: true, nome: true } },
        mensagens: {
          take: 20,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            texto: true,
            createdAt: true,
            autorId: true,
            arquivoUrl: true,
            arquivoTipo: true,
            autor: { select: { id: true, nome: true, usuario: true } },
          },
        },
      },
    });

    return {
      success: true,
      chamados: chamados.map((chamado) => ({
        ...chamado,
        status: chamado.status as ChamadoOperacionalTI["status"],
        createdAt: chamado.createdAt.toISOString(),
        updatedAt: chamado.updatedAt.toISOString(),
        mensagens: chamado.mensagens.toReversed().map((mensagem) => ({
          ...mensagem,
          createdAt: mensagem.createdAt.toISOString(),
        })),
      })),
    };
  } catch (error) {
    console.error("[chamados] Falha ao listar painel operacional de TI", {
      message: error instanceof Error ? error.message : "erro desconhecido",
    });
    return { success: false, chamados: [], error: "Não foi possível carregar os chamados." };
  }
}

export async function updateChamadosStatus(id: number, novoStatus: string, solucao?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autorizado" };

  const parsed = atualizarChamadoStatusSchema.safeParse({ chamadoId: id, novoStatus, solucao });
  if (!parsed.success) return { success: false, error: primeiraMensagemZod(parsed.error) };
  if (parsed.data.novoStatus === "EM_ATENDIMENTO") return assumirChamado(parsed.data.chamadoId);

  const tecnicoId = Number(session.user.id);
  if (!Number.isInteger(tecnicoId) || tecnicoId <= 0) {
    return { success: false, error: "Sessão inválida" };
  }

  try {
    const concluidoEm = new Date();
    const chamadoAtualizado = await concluirChamadoComFeedback({
      chamadoId: parsed.data.chamadoId,
      tecnicoId,
      concluidoEm,
      solucao: parsed.data.solucao,
    });

    if (chamadoAtualizado.usuarioId !== tecnicoId) await notificarChamadoConcluido(chamadoAtualizado.usuarioId, {
      chamadoId: chamadoAtualizado.id,
      titulo: chamadoAtualizado.titulo,
      solucao: chamadoAtualizado.solucao ?? undefined,
      createdAt: chamadoAtualizado.closedAt.toISOString(),
    });

    try {
      if (chamadoAtualizado.destinoEhTI) await concluirTarefaAgendadaDoChamado({
        chamadoId: chamadoAtualizado.id,
        concluidoEm,
        tecnicoId,
        tecnicoRole: chamadoAtualizado.tecnicoRole,
      });
    } catch (error) {
      // A mudança de status não pode deixar o chamado preso se o Google falhar.
      console.error("[chamados] Falha na automação da Agenda Alpha", {
        chamadoId: chamadoAtualizado.id,
        status: "CONCLUIDO",
        message: error instanceof Error ? error.message : "erro desconhecido",
      });
    }

    await notificarAgendaChamadoAtualizada(
      [chamadoAtualizado.usuarioId, tecnicoId],
      {
        chamadoId: chamadoAtualizado.id,
        status: "CONCLUIDO",
        updatedAt: chamadoAtualizado.updatedAt.toISOString(),
      },
    );

    revalidatePath("/PainelAlpha/Chamados");
    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true };
  } catch (error) {
    if (error instanceof ErroConclusaoChamado) {
      return { success: false, error: error.message };
    }
    console.error("[chamados] Falha ao finalizar chamado", {
      chamadoId: parsed.data.chamadoId,
      message: error instanceof Error ? error.message : "erro desconhecido",
    });
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
  if (!session?.user?.id) return { error: "Sessão expirada. Refaça o login." };

  const parsed = criarChamadoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: primeiraMensagemZod(parsed.error) };

  try {
    const novoChamado = await criarChamadoMultissetorial(Number(session.user.id), parsed.data);
    await notificarNovoChamado({
      chamadoId: novoChamado.id, titulo: novoChamado.titulo, usuario: novoChamado.autor.nome, usuarioId: novoChamado.autor.id,
      setor: novoChamado.autor.role, setorOrigem: novoChamado.autor.role,
      setorDestinoId: novoChamado.setorDestinoId, setorDestinoNome: novoChamado.setorDestinoNome,
      tecnicoSolicitadoId: novoChamado.tecnicoSolicitadoId,
      urgencia: novoChamado.prioridade, createdAt: novoChamado.createdAt.toISOString(),
    });
    if (isSameRole(novoChamado.setorDestinoNome, "TI")) {
      const dataFormatada = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(novoChamado.createdAt);
      await avisarNoZap(novoChamado.titulo, novoChamado.autor.nome, novoChamado.prioridade, dataFormatada);
    }
  } catch (error) {
    if (error instanceof ErroCriacaoChamado) return { error: error.message };
    console.error("[chamados] Falha ao criar chamado", { message: error instanceof Error ? error.message : "erro desconhecido" });
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
  if (!session?.user?.id) return { error: "Não autorizado" };
  const ator = await obterAtorChamados(session.user.id);
  if (!ator) return { error: "Não autorizado" };
  if (!Number.isInteger(chamadoId) || chamadoId <= 0 || (texto?.length ?? 0) > 1000 || (!texto?.trim() && !arquivoUrl)) return { error: "Dados inválidos" };

  try {
    const autorId = ator.id;
    const chamado = await db.chamados.findUnique({
      where: { id: Number(chamadoId) },
      select: {
        ...chamadoAcessoSelect,
        titulo: true,
        setorDestinoNome: true,
      },
    });
    if (!chamado) return { error: "Chamado não encontrado" };

    const autorEhSolicitante = chamado.usuarioId === autorId;
    if (!podeResponderChamado(ator, chamado)) {
      return { error: "Você não tem acesso a este chamado" };
    }

    const novaMsg = await db.mensagensChamado.create({
      data: {
        texto: texto || "",
        chamadoId: chamado.id,
        autorId,
        arquivoUrl: arquivoUrl || null,
        arquivoTipo: arquivoTipo || null,
      },
      include: { autor: { select: { id: true, nome: true, usuario: true, imagemUrl: true } } },
    });

    try {
      await pusherServer.trigger(canalChatChamado(chamado.id), "nova-mensagem", novaMsg);
    } catch (error) {
      console.error("[Pusher] Falha ao atualizar o chat do chamado:", error);
    }

    const destinatarioAtendimentoId = chamado.tecnicoId ?? chamado.tecnicoSolicitadoId;
    if (autorEhSolicitante && destinatarioAtendimentoId === autorId) return { success: true };
    const destino = autorEhSolicitante
      ? destinatarioAtendimentoId && destinatarioAtendimentoId !== autorId
        ? { usuarioIds: [destinatarioAtendimentoId] }
        : { setorDestinoId: chamado.setorDestinoId, setorDestinoNome: chamado.setorDestino?.nome ?? "TI", excluirUsuarioIds: [autorId] }
      : { usuarioIds: [chamado.usuarioId] };

    await notificarMensagemChamado(destino, {
      mensagemId: novaMsg.id,
      chamadoId: chamado.id,
      titulo: chamado.titulo,
      autorId,
      autorNome: novaMsg.autor.nome,
      texto: resumirMensagemChamado(novaMsg.texto, novaMsg.arquivoTipo),
      createdAt: novaMsg.createdAt.toISOString(),
    });
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro no Prisma:", msg);
    return { error: "Erro interno no banco de dados" };
  }
}

export async function enviarMensagemChamadoAtendidoTIAction(chamadoId: number, texto: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autorizado" };
  const ator = await obterAtorChamados(session.user.id);
  if (!ator || !isSameRole(ator.role, "TI")) {
    return { success: false, error: "Permissão insuficiente" };
  }

  const tecnicoId = Number(session.user.id);
  const chamadoIdNormalizado = Number(chamadoId);
  const textoNormalizado = texto.trim();
  if (
    !Number.isInteger(tecnicoId)
    || tecnicoId <= 0
    || !Number.isInteger(chamadoIdNormalizado)
    || chamadoIdNormalizado <= 0
    || textoNormalizado.length === 0
    || textoNormalizado.length > 1000
  ) {
    return { success: false, error: "Dados inválidos" };
  }

  const chamado = await db.chamados.findUnique({
    where: { id: chamadoIdNormalizado },
    select: chamadoAcessoSelect,
  });
  if (!chamado) return { success: false, error: "Chamado não encontrado" };
  if (!chamadoDestinoEhTI(chamado) || !podeResponderChamado(ator, chamado) || chamado.status !== "EM_ATENDIMENTO" || chamado.tecnicoId !== tecnicoId) {
    return {
      success: false,
      error: "Somente o técnico responsável pode responder por este painel.",
    };
  }

  return enviarMensagemAction(chamadoIdNormalizado, textoNormalizado);
}

export async function assumirChamado(id: number) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autorizado" };
  const ator = await obterAtorChamados(session.user.id);
  if (!ator) return { success: false, error: "Permissão insuficiente" };

  const chamadoId = Number(id);
  const tecnicoId = Number(session.user.id);
  if (!Number.isInteger(chamadoId) || chamadoId <= 0 || !Number.isInteger(tecnicoId) || tecnicoId <= 0) {
    return { success: false, error: "Dados inválidos" };
  }

  try {
    const atribuicaoResultado = await db.$transaction(async (tx) => {
      const atorAtual = await obterAtorChamados(tecnicoId, tx);
      if (!atorAtual) return { error: "Permissão insuficiente" };
      const chamado = await tx.chamados.findUnique({
        where: { id: chamadoId },
        select: {
          ...chamadoAcessoSelect, titulo: true, descricao: true, solucao: true, updatedAt: true,
          tecnicoSolicitado: { select: { nome: true } },
        },
      });
      if (!chamado) return { error: "Chamado não encontrado" };
      if (!podeAtenderChamado(atorAtual, chamado)) return { error: "Somente administradores ou colaboradores ativos do setor de destino podem assumir chamados de um setor ativo." };
      if (chamado.tecnicoId !== null) return { error: "Chamado já foi assumido por outro técnico" };
      if (chamado.status !== "ABERTO") return { error: "Chamado não está em estado inicial" };
      if (chamado.tecnicoSolicitadoId !== null && chamado.tecnicoSolicitadoId !== tecnicoId) {
        const nome = chamado.tecnicoSolicitado?.nome?.trim() || "o responsável solicitado";
        return { error: `O solicitante pediu que ${nome} realizasse este chamado. Somente esse usuário pode assumir.` };
      }
      const atribuicao = await tx.chamados.updateMany({
        where: { id: chamadoId, tecnicoId: null, status: "ABERTO", tecnicoSolicitadoId: chamado.tecnicoSolicitadoId, setorDestinoId: chamado.setorDestinoId },
        data: { status: "EM_ATENDIMENTO", tecnicoId },
      });
      if (atribuicao.count !== 1) return { error: "Chamado já foi assumido por outro técnico" };
      return { chamado, ator: atorAtual };
    }, { isolationLevel: "Serializable" });
    if (atribuicaoResultado.error || !atribuicaoResultado.chamado || !atribuicaoResultado.ator) return { success: false, error: atribuicaoResultado.error ?? "Erro ao assumir chamado." };
    const { chamado, ator: atorResponsavel } = atribuicaoResultado;

    const atendimentoIniciadoEm = new Date();
    if (chamado.usuarioId !== tecnicoId) await notificarChamadoAssumido(chamado.usuarioId, {
      chamadoId,
      titulo: chamado.titulo,
      tecnicoNome: atorResponsavel.nome,
      createdAt: atendimentoIniciadoEm.toISOString(),
    });

    let agendaAtualizadaEm = chamado.updatedAt;
    try {
      const atualizado = await db.chamados.findUnique({
        where: { id: chamadoId },
        select: { id: true, titulo: true, descricao: true, usuarioId: true, solucao: true, updatedAt: true },
      });
      if (atualizado && chamadoDestinoEhTI(chamado)) {
        agendaAtualizadaEm = atualizado.updatedAt;
        await criarTarefaAgendadaParaChamado({
          chamado: atualizado,
          tecnicoId,
          tecnicoRole: atorResponsavel.role,
        });
      }
    } catch (e) {
      console.error("[chamados] Falha na automação da Agenda Alpha ao assumir", {
        chamadoId,
        message: e instanceof Error ? e.message : "erro desconhecido",
      });
    }

    await notificarAgendaChamadoAtualizada(
      [chamado.usuarioId, tecnicoId],
      {
        chamadoId,
        status: "EM_ATENDIMENTO",
        updatedAt: agendaAtualizadaEm.toISOString(),
      },
    );

    revalidatePath("/PainelAlpha/Chamados");
    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return {
      success: true,
      chamado: { id: chamadoId, status: "EM_ATENDIMENTO", tecnicoId },
    };
  } catch {
    return { success: false, error: "Erro ao assumir chamado." };
  }
}

export async function marcarComoLidaAction(chamadoId: number, ..._legacy: [] | [boolean]) {
  void _legacy;
  const session = await auth();
  const ator = await obterAtorChamados(session?.user?.id);
  if (!ator) return { error: "Não autorizado" };
  if (!Number.isInteger(chamadoId) || chamadoId <= 0) return { error: "Dados inválidos" };
  try {
    const chamado = await db.chamados.findUnique({ where: { id: chamadoId }, select: chamadoAcessoSelect });
    if (!chamado || !podeVerChamado(ator, chamado)) return { error: "Você não tem acesso a este chamado" };
    // Observadores globais não marcam mensagens como lidas em nome do atendimento.
    if (!podeResponderChamado(ator, chamado)) return { success: true };
    await db.mensagensChamado.updateMany({
      where: { chamadoId, autorId: { not: ator.id } },
      data: chamado.usuarioId === ator.id ? { lida_usuario: true } : { lida_admin: true },
    });
    revalidatePath("/PainelAlpha/Chamados");
    return { success: true };
  } catch {
    return { error: "Erro ao atualizar" };
  }
}
