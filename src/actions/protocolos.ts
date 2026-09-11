"use server"

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { isAdminRole } from "@/lib/roles";
import {
  notificarAgendaChamadoAtualizada,
  notificarChamadoConcluido,
} from "@/lib/chamados/notificacoes-server";
import { concluirTarefaAgendadaDoChamado } from "@/lib/chamados/tarefa-agendada";
import {
  finalizarComProtocoloSchema,
  primeiraMensagemZod,
} from "@/lib/chamados/schemas";
import {
  concluirChamadoComFeedback,
  ErroConclusaoChamado,
} from "@/lib/chamados/conclusao";

const protocoloTemplateModel = db.protocoloTemplate;

export type ProtocoloTemplate = {
  id: number;
  nome: string;
  categoria: string;
  template: string;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
};

async function requireAdmin() {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const role = session.user.role;
  if (!isAdminRole(role)) throw new Error("Permissão insuficiente");
  return session;
}

export async function listarTemplates(categoria?: string): Promise<ProtocoloTemplate[]> {
  try {
    const templates = await protocoloTemplateModel.findMany({
      where: {
        ativo: true,
        ...(categoria && categoria !== "TODOS" ? { categoria } : {}),
      },
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    });
    return templates as ProtocoloTemplate[];
  } catch {
    return [];
  }
}

export async function listarTodosTemplates(): Promise<ProtocoloTemplate[]> {
  try {
    const templates = await protocoloTemplateModel.findMany({
      orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    });
    return templates as ProtocoloTemplate[];
  } catch {
    return [];
  }
}

export async function criarTemplate(dados: { nome: string; categoria: string; template: string }) {
  try {
    await requireAdmin();
    if (!dados.nome.trim() || !dados.template.trim()) {
      return { success: false, error: "Nome e template são obrigatórios." };
    }
    const novo = await protocoloTemplateModel.create({
      data: {
        nome: dados.nome.trim(),
        categoria: dados.categoria,
        template: dados.template.trim(),
      },
    });
    revalidatePath("/PainelAlpha/GestaoProtocolos");
    return { success: true, data: novo as ProtocoloTemplate };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao criar template." };
  }
}

export async function atualizarTemplate(
  id: number,
  dados: { nome: string; categoria: string; template: string; ativo: boolean }
) {
  try {
    await requireAdmin();
    await protocoloTemplateModel.update({
      where: { id },
      data: {
        nome: dados.nome.trim(),
        categoria: dados.categoria,
        template: dados.template.trim(),
        ativo: dados.ativo,
      },
    });
    revalidatePath("/PainelAlpha/GestaoProtocolos");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao atualizar." };
  }
}

export async function excluirTemplate(id: number) {
  try {
    await requireAdmin();
    await protocoloTemplateModel.delete({ where: { id } });
    revalidatePath("/PainelAlpha/GestaoProtocolos");
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao excluir." };
  }
}

export async function finalizarComProtocolo(
  chamadoId: number,
  dados: {
    solucao: string;
    causa: string;
    mensagemFinal: string;
    templateId?: number;
  }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    if (!isAdminRole(session.user.role)) return { success: false, error: "Permissão insuficiente" };

    const parsed = finalizarComProtocoloSchema.safeParse({ chamadoId, ...dados });
    if (!parsed.success) return { success: false, error: primeiraMensagemZod(parsed.error) };

    const tecnicoId = Number(session.user.id);
    if (!Number.isInteger(tecnicoId) || tecnicoId <= 0) {
      return { success: false, error: "Sessão inválida" };
    }

    const concluidoEm = new Date();
    const chamado = await concluirChamadoComFeedback({
      chamadoId: parsed.data.chamadoId,
      tecnicoId,
      concluidoEm,
      solucao: parsed.data.solucao,
      causa: parsed.data.causa || null,
      mensagemFinal: parsed.data.mensagemFinal || null,
      templateId: parsed.data.templateId ?? null,
    });

    try {
      await concluirTarefaAgendadaDoChamado({
        chamadoId: chamado.id,
        concluidoEm,
        tecnicoId,
        tecnicoRole: chamado.tecnicoRole,
      });
    } catch (error) {
      // O fechamento do chamado é a fonte de verdade e não pode ser revertido
      // por uma indisponibilidade momentânea da API do Google Tasks.
      console.error("[chamados] Falha ao concluir tarefa da Agenda Alpha pelo protocolo", {
        chamadoId: chamado.id,
        tecnicoId,
        message: error instanceof Error ? error.message : "erro desconhecido",
      });
    }

    await notificarChamadoConcluido(chamado.usuarioId, {
      chamadoId: chamado.id,
      titulo: chamado.titulo,
      solucao: parsed.data.solucao,
      createdAt: chamado.closedAt.toISOString(),
    });
    await notificarAgendaChamadoAtualizada(
      [chamado.usuarioId, tecnicoId],
      {
        chamadoId: chamado.id,
        status: "CONCLUIDO",
        updatedAt: concluidoEm.toISOString(),
      },
    );

    revalidatePath("/PainelAlpha/Chamados");
    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true };
  } catch (e: unknown) {
    if (e instanceof ErroConclusaoChamado) return { success: false, error: e.message };
    return { success: false, error: e instanceof Error ? e.message : "Erro ao finalizar chamado." };
  }
}

export async function salvarWhatsAppLog(dados: {
  chamadoId: number;
  usuarioId: number;
  telefone: string;
  mensagem: string;
}) {
  try {
    const session = await auth();
    if (!session) return { success: false, error: "Não autorizado" };

    const enviadoPorId = Number(session.user.id);

    await db.$executeRawUnsafe(
      `INSERT INTO whatsapp_log (chamadoId, usuarioId, telefone, mensagem, enviadoPorId, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      dados.chamadoId,
      dados.usuarioId,
      dados.telefone,
      dados.mensagem,
      enviadoPorId,
      new Date().toISOString()
    );

    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao salvar log." };
  }
}

export async function buscarTelefoneSolicitante(chamadoId: number): Promise<string | null> {
  try {
    type Row = { telefone: string | null; telefone_corporativo: string | null };
    const rows = await db.$queryRawUnsafe<Row[]>(
      `SELECT u.telefone, u.telefone_corporativo FROM chamados c JOIN usuarios u ON u.id = c.usuarioId WHERE c.id = ?`,
      chamadoId
    );
    if (!rows[0]) return null;
    return rows[0].telefone_corporativo || rows[0].telefone || null;
  } catch {
    return null;
  }
}
