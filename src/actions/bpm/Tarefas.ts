"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { criarTarefaSchema, concluirTarefaSchema, criarTarefaPresetSchema } from "@/lib/validations/bpm";
import {
  checarAcessoConfigPipeline,
  checarAcessoDiretoriaBpm,
  exigirAcessoBpmCard,
  exigirAcessoBpmPipeline,
  exigirAcessoConfigPipeline,
  exigirAcessoModuloBpm,
} from "@/lib/bpm/ownership";
import { NOME_ETAPA_BOAS_VINDAS } from "@/lib/bpm/boas-vindas";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { tipoTarefaEhValido } from "@/lib/bpm/tarefas-tipo";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

function montarDetalhesTarefa(dados: {
  tipo: string;
  descricao?: string;
  contato?: string;
  telefone?: string;
  emailDestino?: string;
  mensagem?: string;
}) {
  const linhas = [dados.descricao?.trim()].filter((linha): linha is string => Boolean(linha));
  if (dados.tipo === "LIGACAO") {
    linhas.push(`Telefone: ${dados.telefone}`);
    if (dados.contato) linhas.push(`Contato: ${dados.contato}`);
  }
  if (dados.tipo === "WHATSAPP") {
    linhas.push(`Contato: ${dados.contato}`, `Mensagem: ${dados.mensagem}`);
  }
  if (dados.tipo === "EMAIL") {
    linhas.push(`Para: ${dados.emailDestino}`, `Mensagem: ${dados.mensagem}`);
  }
  return linhas.join("\n") || undefined;
}

function tituloTarefaPorTipo(dados: { tipo: string; titulo?: string; contato?: string; telefone?: string; emailDestino?: string }) {
  if (dados.titulo?.trim()) return dados.titulo.trim();
  if (dados.tipo === "LIGACAO") return `Ligação: ${dados.contato?.trim() || dados.telefone}`;
  if (dados.tipo === "WHATSAPP") return `WhatsApp: ${dados.contato}`;
  if (dados.tipo === "EMAIL") return `E-mail: ${dados.emailDestino}`;
  return "Tarefa";
}

export async function CriarTarefaBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = criarTarefaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const {
      cardId,
      tipo,
      responsavelId,
      prazo,
      alertaEm,
      prioridade,
      presetId,
      checklistItens,
    } = parsed.data;
    const titulo = tituloTarefaPorTipo(parsed.data);
    const descricao = montarDetalhesTarefa(parsed.data);
    const checklistJson = tipo === "CHECKLIST" ? JSON.stringify(checklistItens ?? []) : null;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "criarTarefa");

    const tarefa = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "criarTarefa", tx);
      const criada = await tx.bpmTarefa.create({
        data: { cardId, titulo, descricao, responsavelId, prazo, alertaEm, tipo, checklistJson, prioridade, presetId },
      });
      await registrarHistoricoCard(
        {
          cardId,
          acao: "TAREFA_CRIADA",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ tipo, responsavelId, prazo, alertaConfigurado: true }),
        },
        tx,
      );
      return criada;
    });

    revalidatePath(`${ROTA_BASE}/pipeline`);
    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/tarefas`);
    await notificarPipelineBpm({ cardId, tipo: "TAREFA_ALTERADA" });
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

    const card = await db.bpmCard.findUnique({
      where: { id: dados.cardId },
      select: { pipelineId: true },
    });
    if (!card || (preset.pipelineId && preset.pipelineId !== card.pipelineId)) {
      return { success: false, error: "Preset indisponÃ­vel para este card" };
    }

    const template = JSON.parse(preset.templateJson) as {
      titulo: string;
      descricao?: string;
      tipo?: string;
      prazo?: string;
      alertaEm?: string;
      prioridade: string;
    }[];

    const tarefasDoPreset = template.map((item) => {
      const prazo = item.prazo ? new Date(item.prazo) : null;
      const alertaEm = item.alertaEm ? new Date(item.alertaEm) : null;
      if (
        !item.titulo?.trim() ||
        !tipoTarefaEhValido(item.tipo ?? "TAREFA") ||
        !prazo || Number.isNaN(prazo.getTime()) ||
        !alertaEm || Number.isNaN(alertaEm.getTime()) ||
        alertaEm > prazo
      ) {
        return null;
      }
      return { ...item, tipo: item.tipo ?? "TAREFA", prazo, alertaEm };
    });
    if (tarefasDoPreset.some((tarefa) => !tarefa)) {
      return {
        success: false,
        error: "Este preset não possui prazo e alerta válidos para todas as tarefas.",
      };
    }
    const tarefasValidas = tarefasDoPreset.filter((tarefa): tarefa is NonNullable<typeof tarefa> => tarefa !== null);

    const tarefas = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(dados.cardId, userId, session.user.role ?? null, "criarTarefa", tx);
      const criadas = await Promise.all(
        tarefasValidas.map((item) =>
          tx.bpmTarefa.create({
            data: {
              cardId: dados.cardId,
              titulo: item.titulo,
              descricao: item.descricao,
              tipo: item.tipo,
              prazo: item.prazo,
              alertaEm: item.alertaEm,
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
    await notificarPipelineBpm({ cardId: dados.cardId, tipo: "TAREFA_ALTERADA" });
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
      await exigirAcessoBpmCard(tarefa.cardId, userId, session.user.role ?? null, "concluirTarefa", tx);
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
    await notificarPipelineBpm({ cardId: tarefa.cardId, tipo: "TAREFA_ALTERADA" });
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
    await exigirAcessoConfigPipeline(Number(session.user.id), "configurarEtapas");

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
    await exigirAcessoModuloBpm(userId);
    const admin = await checarAcessoConfigPipeline(userId, "visualizarPipeline");
    const diretoria = await checarAcessoDiretoriaBpm(userId);

    let cardIdsPermitidos: string[] | undefined;
    if (!admin) {
      const membros = await db.bpmCardMembro.findMany({
        where: {
          userId,
          ...(diretoria ? {} : { card: { etapa: { nome: { not: NOME_ETAPA_BOAS_VINDAS } } } }),
        },
        select: { cardId: true },
      });
      cardIdsPermitidos = membros.map((m) => m.cardId);
    }

    const tarefas = await db.bpmTarefa.findMany({
      where: {
        ...(filtros?.status ? { status: filtros.status } : {}),
        ...(filtros?.responsavelId ? { responsavelId: filtros.responsavelId } : {}),
        ...(diretoria ? {} : { card: { etapa: { nome: { not: NOME_ETAPA_BOAS_VINDAS } } } }),
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

    const userId = Number(session.user.id);
    await exigirAcessoModuloBpm(userId);
    if (pipelineId) await exigirAcessoBpmPipeline(pipelineId, userId);

    // Sem contexto de pipeline, nunca exponha presets específicos de outros
    // pipelines. A tela que precisa de presets locais sempre informa pipelineId.
    const presets = await db.bpmTarefaPreset.findMany({
      where: pipelineId ? { OR: [{ pipelineId }, { pipelineId: null }] } : { pipelineId: null },
      orderBy: { nome: "asc" },
    });

    return { success: true, data: presets };
  } catch (error) {
    console.error("[ListarTarefaPresetsBpm]", error);
    return { success: false, error: "Erro ao buscar presets", data: [] };
  }
}
