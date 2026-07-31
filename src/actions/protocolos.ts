"use server"

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { notificarChamadoConcluido } from "@/lib/chamados/notificacoes-server";

// Prisma client types não incluem ProtocoloTemplate ainda.
// Após parar dev server: `npx prisma generate` para remover os casts abaixo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const protocoloTemplateModel = (db as any).protocoloTemplate;

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
  if (role !== "Admin" && role !== "CEO") throw new Error("Permissão insuficiente");
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
    if (!session) return { success: false, error: "Não autorizado" };

    const chamado = await db.chamados.findUnique({
      where: { id: chamadoId },
      select: { id: true, titulo: true, usuarioId: true },
    });
    if (!chamado) return { success: false, error: "Chamado não encontrado." };

    const concluidoEm = new Date();
    await db.$executeRawUnsafe(
      `UPDATE chamados SET status = ?, solucao = ?, causa = ?, mensagemFinal = ?, templateId = ?, closedAt = ?, updatedAt = ? WHERE id = ?`,
      "CONCLUIDO",
      dados.solucao.trim(),
      dados.causa.trim() || null,
      dados.mensagemFinal.trim() || null,
      dados.templateId ?? null,
      concluidoEm.toISOString(),
      concluidoEm.toISOString(),
      chamadoId
    );

    await notificarChamadoConcluido(chamado.usuarioId, {
      chamadoId: chamado.id,
      titulo: chamado.titulo,
      solucao: dados.solucao.trim(),
      createdAt: concluidoEm.toISOString(),
    });

    revalidatePath("/PainelAlpha/Chamados");
    return { success: true };
  } catch (e: unknown) {
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
