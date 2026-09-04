"use server";

import { z } from "zod";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { exigirAcessoBpmCard, exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { criarSlaInstancia, obterStatusSla } from "@/lib/bpm/sla";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  slaConfiguracaoAdminSchema,
  slaConfigIdSchema,
  slaConfigStatusSchema,
  type SlaConfiguracaoAdmin,
} from "@/lib/validations/bpm-sla";

const gatilhoSchema = z.enum([
  "CRIACAO_CARD",
  "ENTRADA_ETAPA",
  "CRIACAO_TAREFA",
  "PRIMEIRA_VISUALIZACAO",
  "TAREFA_CONCLUIDA",
  "MANUAL",
  "CUSTOM",
]);

const criarInstanciaSchema = z.object({
  cardId: z.string().cuid().optional(),
  tarefaId: z.string().cuid().optional(),
  gatilho: gatilhoSchema,
}).refine((dados) => Boolean(dados.cardId) !== Boolean(dados.tarefaId), {
  message: "Informe exatamente um card ou uma tarefa.",
});

const idSchema = z.string().cuid();
const ROTA_ADMIN = "/PainelAlpha/AlphaCRM/admin/pipelines";

function mensagemErro(error: unknown, fallback: string) {
  return error instanceof Error && error.message.includes("administradores") ? error.message : fallback;
}

function pausaRegra(config: { pausaCondicaoJson: string | null }): "NUNCA" | "STANDBY" {
  return config.pausaCondicaoJson?.includes("STANDBY") ? "STANDBY" : "NUNCA";
}

export async function ListarConfiguracoesSlaBpm(pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const parsed = idSchema.safeParse(pipelineId);
    if (!parsed.success) return { success: false, error: parsed.error.flatten(), data: [] };
    await exigirAcessoConfigPipeline(Number(session.user.id), "configurarSla");
    const configs = await db.bpmSlaConfig.findMany({
      where: { pipelineId: parsed.data },
      include: {
        etapa: { select: { nome: true } },
        servicoCatalogo: { select: { nome: true } },
        alertaLimites: { where: { ativo: true }, orderBy: { ordem: "asc" } },
      },
      orderBy: [{ ativa: "desc" }, { nome: "asc" }],
    });
    const data: SlaConfiguracaoAdmin[] = configs.map((config) => ({
      id: config.id,
      pipelineId: config.pipelineId ?? parsed.data,
      nome: config.nome,
      etapaId: config.etapaId,
      etapaNome: config.etapa?.nome ?? null,
      tipoTarefa: config.tipoTarefa,
      tipoProcesso: config.tipoProcesso,
      servicoId: config.servicoId,
      servicoNome: config.servicoCatalogo?.nome ?? null,
      quantidade: config.quantidade,
      unidade: config.unidade,
      inicioMomento: config.inicioMomento,
      pausaRegra: pausaRegra(config),
      ativa: config.ativa,
      alertaLimites: config.alertaLimites.map((limite) => ({
        id: limite.id,
        tipoLimite: limite.tipoLimite,
        valor: limite.valor,
        unidade: limite.unidade,
        statusResultante: limite.statusResultante === "ATRASADO" ? "ATRASADO" : "PROXIMO_VENCIMENTO",
      })),
    }));
    return { success: true, data };
  } catch (error) {
    console.error("[ListarConfiguracoesSlaBpm]", error);
    return { success: false, error: mensagemErro(error, "Erro ao buscar configurações de SLA"), data: [] };
  }
}

export async function SalvarConfiguracaoSlaBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const parsed = slaConfiguracaoAdminSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const userId = Number(session.user.id);
    const dados = parsed.data;
    await exigirAcessoConfigPipeline(userId, "configurarSla");
    const salvo = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarSla", tx);
      if (dados.etapaId) {
        const etapa = await tx.bpmEtapa.findFirst({ where: { id: dados.etapaId, pipelineId: dados.pipelineId }, select: { id: true } });
        if (!etapa) throw new Error("Etapa não encontrada neste pipeline");
      }
      if (dados.servicoId) {
        const servico = await tx.servicosComerciais.findFirst({ where: { id: dados.servicoId, ativo: true }, select: { id: true } });
        if (!servico) throw new Error("Serviço comercial não encontrado");
      }
      if (dados.id) {
        const existente = await tx.bpmSlaConfig.findFirst({ where: { id: dados.id, pipelineId: dados.pipelineId }, select: { id: true } });
        if (!existente) throw new Error("Configuração de SLA não encontrada neste pipeline");
      }
      const alvo = {
        etapaId: dados.escopo === "ETAPA" ? dados.etapaId : null,
        tipoTarefa: dados.escopo === "TAREFA" ? dados.tipoTarefa : null,
        tipoProcesso: dados.escopo === "TIPO_PROCESSO" ? dados.tipoProcesso : null,
        servicoId: dados.escopo === "SERVICO" ? dados.servicoId : null,
      };
      const pausa = dados.pausaRegra === "STANDBY" ? JSON.stringify({ tipo: "ETAPA_STANDBY" }) : null;
      const configData = {
        pipelineId: dados.pipelineId,
        nome: dados.nome,
        quantidade: dados.quantidade,
        unidade: dados.unidade,
        inicioMomento: dados.inicioMomento,
        ativa: dados.ativa,
        pausaCondicaoJson: pausa,
        retomadaCondicaoJson: pausa ? JSON.stringify({ tipo: "SAIDA_STANDBY" }) : null,
        ...alvo,
      };
      const config = dados.id
        ? await tx.bpmSlaConfig.update({ where: { id: dados.id }, data: configData })
        : await tx.bpmSlaConfig.create({ data: { ...configData, criadoPorId: userId } });
      await tx.bpmSlaAlertaLimite.deleteMany({ where: { slaConfigId: config.id } });
      await tx.bpmSlaAlertaLimite.createMany({ data: [
        { slaConfigId: config.id, nome: "Atenção", cor: "AMARELO", tipoLimite: dados.amareloTipo, valor: dados.amareloValor, unidade: dados.amareloTipo === "PERCENTUAL_CONSUMIDO" ? null : dados.amareloUnidade, statusResultante: "PROXIMO_VENCIMENTO", ordem: 1 },
        { slaConfigId: config.id, nome: "Vencido", cor: "VERMELHO", tipoLimite: dados.vermelhoTipo, valor: dados.vermelhoValor, unidade: dados.vermelhoTipo === "PERCENTUAL_CONSUMIDO" ? null : dados.vermelhoUnidade, statusResultante: "ATRASADO", ordem: 2 },
      ] });
      return config;
    });
    revalidatePath(`${ROTA_ADMIN}/${dados.pipelineId}`);
    return { success: true, data: { id: salvo.id } };
  } catch (error) {
    console.error("[SalvarConfiguracaoSlaBpm]", error);
    return { success: false, error: mensagemErro(error, error instanceof Error ? error.message : "Erro ao salvar configuração de SLA") };
  }
}

export async function AtivarDesativarConfiguracaoSlaBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const parsed = slaConfigStatusSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    await exigirAcessoConfigPipeline(Number(session.user.id), "configurarSla");
    const atualizada = await db.bpmSlaConfig.updateMany({ where: { id: parsed.data.id, pipelineId: parsed.data.pipelineId }, data: { ativa: parsed.data.ativa } });
    if (atualizada.count !== 1) return { success: false, error: "Configuração de SLA não encontrada" };
    revalidatePath(`${ROTA_ADMIN}/${parsed.data.pipelineId}`);
    return { success: true };
  } catch (error) {
    console.error("[AtivarDesativarConfiguracaoSlaBpm]", error);
    return { success: false, error: mensagemErro(error, "Erro ao atualizar configuração de SLA") };
  }
}

export async function ExcluirConfiguracaoSlaBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const parsed = slaConfigIdSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarSla");
    await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarSla", tx);
      const config = await tx.bpmSlaConfig.findFirst({ where: { id: parsed.data.id, pipelineId: parsed.data.pipelineId }, select: { id: true, _count: { select: { instancias: true } } } });
      if (!config) throw new Error("Configuração de SLA não encontrada");
      if (config._count.instancias > 0) throw new Error("Este SLA já possui histórico. Desative-o para preservar a auditoria.");
      await tx.bpmSlaConfig.delete({ where: { id: config.id } });
    });
    revalidatePath(`${ROTA_ADMIN}/${parsed.data.pipelineId}`);
    return { success: true };
  } catch (error) {
    console.error("[ExcluirConfiguracaoSlaBpm]", error);
    return { success: false, error: mensagemErro(error, error instanceof Error ? error.message : "Erro ao excluir configuração de SLA") };
  }
}

async function contextoTarefa(tarefaId: string) {
  return db.bpmTarefa.findUnique({ where: { id: tarefaId }, select: { cardId: true } });
}

export async function CriarSlaInstancia(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const parsed = criarInstanciaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const tarefa = parsed.data.tarefaId ? await contextoTarefa(parsed.data.tarefaId) : null;
    const cardId = parsed.data.cardId ?? tarefa?.cardId;
    if (!cardId) return { success: false, error: "Tarefa não encontrada" };
    await exigirAcessoBpmCard(cardId, Number(session.user.id), session.user.role ?? null, "editarCard");
    const instancia = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardId, Number(session.user.id), session.user.role ?? null, "editarCard", tx);
      return criarSlaInstancia(
        { cardId: parsed.data.cardId, tarefaId: parsed.data.tarefaId },
        parsed.data.gatilho,
        tx,
      );
    });
    return {
      success: true,
      data: instancia
        ? { id: instancia.id, status: instancia.status, deadline: instancia.deadline }
        : null,
    };
  } catch (error) {
    console.error("[CriarSlaInstancia]", error);
    return { success: false, error: error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao criar SLA" };
  }
}

export async function ObterStatusSlaCard(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const parsed = idSchema.safeParse(cardId);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    await exigirAcessoBpmCard(parsed.data, Number(session.user.id), session.user.role ?? null, "visualizar");
    const data = await obterStatusSla({ cardId: parsed.data });
    if (data.some((item) => item.statusAlterado)) {
      await notificarPipelineBpm({ cardId: parsed.data, tipo: "SLA_STATUS_ALTERADO" });
    }
    return { success: true, data };
  } catch (error) {
    console.error("[ObterStatusSlaCard]", error);
    return { success: false, error: error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao consultar SLA" };
  }
}

export async function ObterStatusSlaTarefa(tarefaId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const parsed = idSchema.safeParse(tarefaId);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const tarefa = await contextoTarefa(parsed.data);
    if (!tarefa) return { success: false, error: "Tarefa não encontrada" };
    await exigirAcessoBpmCard(tarefa.cardId, Number(session.user.id), session.user.role ?? null, "visualizar");
    const data = await obterStatusSla({ tarefaId: parsed.data });
    if (data.some((item) => item.statusAlterado)) {
      await notificarPipelineBpm({ cardId: tarefa.cardId, tipo: "SLA_STATUS_ALTERADO" });
    }
    return { success: true, data };
  } catch (error) {
    console.error("[ObterStatusSlaTarefa]", error);
    return { success: false, error: error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao consultar SLA" };
  }
}
