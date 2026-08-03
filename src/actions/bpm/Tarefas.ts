"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { criarTarefaSchema, concluirTarefaSchema, criarTarefaPresetSchema } from "@/lib/validations/bpm";
import { exigirAcessoBpmCard, isAdminRole } from "@/lib/bpm/ownership";
import { registrarHistoricoCard } from "./Cards";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

export async function CriarTarefaBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = criarTarefaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, titulo, descricao, responsavelId, prazo, prioridade, presetId } = parsed.data;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "criarTarefa");

    const tarefa = await db.$transaction(async (tx) => {
      const criada = await tx.bpmTarefa.create({
        data: { cardId, titulo, descricao, responsavelId, prazo, prioridade, presetId },
      });
      await registrarHistoricoCard(
        {
          cardId,
          acao: "TAREFA_CRIADA",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ titulo, responsavelId, prazo }),
        },
        tx,
      );
      return criada;
    });

    revalidatePath(`${ROTA_BASE}/pipeline`);
    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/tarefas`);
    return { success: true, data: tarefa };
  } catch (error) {
    console.error("[CriarTarefaBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao criar tarefa";
    return { success: false, error: msg };
  }
}

/**
 * Aplica um preset de tarefa a um card, conforme D-026: o preset pode gerar
 * uma única tarefa, várias tarefas, ou um fluxo — configurável via UI (tipoGeracao
 * do preset), não fixado em código. Aqui apenas materializamos o template já configurado.
 */
export async function AplicarPresetTarefaBpm(dados: { cardId: string; presetId: string }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoBpmCard(dados.cardId, userId, session.user.role ?? null, "criarTarefa");

    const preset = await db.bpmTarefaPreset.findUnique({ where: { id: dados.presetId } });
    if (!preset) return { success: false, error: "Preset não encontrado" };

    const template = JSON.parse(preset.templateJson) as {
      titulo: string;
      descricao?: string;
      prioridade: string;
    }[];

    const tarefas = await db.$transaction(async (tx) => {
      const criadas = await Promise.all(
        template.map((item) =>
          tx.bpmTarefa.create({
            data: {
              cardId: dados.cardId,
              titulo: item.titulo,
              descricao: item.descricao,
              prioridade: item.prioridade,
              presetId: preset.id,
            },
          }),
        ),
      );
      await registrarHistoricoCard(
        {
          cardId: dados.cardId,
          acao: "PRESET_APLICADO",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ presetId: preset.id, quantidade: criadas.length }),
        },
        tx,
      );
      return criadas;
    });

    revalidatePath(`${ROTA_BASE}/pipeline`);
    return { success: true, data: tarefas };
  } catch (error) {
    console.error("[AplicarPresetTarefaBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao aplicar preset";
    return { success: false, error: msg };
  }
}

export async function ConcluirTarefaBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = concluirTarefaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { tarefaId } = parsed.data;

    const tarefa = await db.bpmTarefa.findUnique({ where: { id: tarefaId } });
    if (!tarefa) return { success: false, error: "Tarefa não encontrada" };

    await exigirAcessoBpmCard(tarefa.cardId, userId, session.user.role ?? null, "concluirTarefa");

    await db.$transaction(async (tx) => {
      await tx.bpmTarefa.update({
        where: { id: tarefaId },
        data: { status: "CONCLUIDA", concluidaEm: new Date() },
      });
      await registrarHistoricoCard(
        {
          cardId: tarefa.cardId,
          acao: "TAREFA_CONCLUIDA",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ titulo: tarefa.titulo }),
        },
        tx,
      );
    });

    revalidatePath(`${ROTA_BASE}/pipeline`);
    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/tarefas`);
    return { success: true };
  } catch (error) {
    console.error("[ConcluirTarefaBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao concluir tarefa";
    return { success: false, error: msg };
  }
}

export async function CriarTarefaPresetBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = criarTarefaPresetSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { pipelineId, nome, descricao, tipoGeracao, template } = parsed.data;

    const preset = await db.bpmTarefaPreset.create({
      data: { pipelineId, nome, descricao, tipoGeracao, templateJson: JSON.stringify(template) },
    });

    return { success: true, data: preset };
  } catch (error) {
    console.error("[CriarTarefaPresetBpm]", error);
    return { success: false, error: "Erro ao criar preset" };
  }
}

/**
 * Central de tarefas (Fase 3, DOMAIN.md/FEATURES.md): visão agregada cross-card.
 * Admin vê todas as tarefas; usuário comum só vê tarefas de cards onde é
 * BpmCardMembro (mesma regra de ownership do dashboard).
 */
export async function ListarTarefasGlobaisBpm(filtros?: { status?: string; responsavelId?: number }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);
    const admin = isAdminRole(session.user.role ?? null);

    let cardIdsPermitidos: string[] | undefined;
    if (!admin) {
      const membros = await db.bpmCardMembro.findMany({
        where: { userId },
        select: { cardId: true },
      });
      cardIdsPermitidos = membros.map((m) => m.cardId);
    }

    const tarefas = await db.bpmTarefa.findMany({
      where: {
        ...(filtros?.status ? { status: filtros.status } : {}),
        ...(filtros?.responsavelId ? { responsavelId: filtros.responsavelId } : {}),
        ...(cardIdsPermitidos ? { cardId: { in: cardIdsPermitidos } } : {}),
      },
      include: {
        card: {
          select: {
            id: true,
            empresa: { select: { id: true, razaoSocial: true } },
            pipeline: { select: { id: true, nome: true } },
          },
        },
        responsavel: { select: { id: true, nome: true } },
      },
      orderBy: [{ status: "asc" }, { prazo: "asc" }],
    });

    return { success: true, data: tarefas };
  } catch (error) {
    console.error("[ListarTarefasGlobaisBpm]", error);
    return { success: false, error: "Erro ao buscar tarefas", data: [] };
  }
}

export async function ListarTarefaPresetsBpm(pipelineId?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };

    const presets = await db.bpmTarefaPreset.findMany({
      where: pipelineId ? { OR: [{ pipelineId }, { pipelineId: null }] } : undefined,
      orderBy: { nome: "asc" },
    });

    return { success: true, data: presets };
  } catch (error) {
    console.error("[ListarTarefaPresetsBpm]", error);
    return { success: false, error: "Erro ao buscar presets", data: [] };
  }
}
