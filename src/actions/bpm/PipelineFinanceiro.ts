"use server";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { FINANCIAL_FIELDS, FINANCIAL_PIPELINE_NAME, FINANCIAL_PIPELINE_SCHEMA_VERSION, FINANCIAL_STAGES } from "@/lib/bpm/pipeline-financeiro";
export async function ConfigurarPipelineFinanceiro(pipelineId: string) {
  try {
    const session = await auth(); if (!session?.user?.id) return { success: false, error: "Não autorizado" }; const userId = Number(session.user.id); await exigirAcessoConfigPipeline(userId, "configurarEtapas");
    const result = await db.$transaction(async (tx) => {
      const pipeline = await tx.bpmPipeline.findUnique({ where: { id: pipelineId }, include: { etapas: { where: { ativo: true }, orderBy: { ordem: "asc" } }, campos: true } }); if (!pipeline || pipeline.nome !== FINANCIAL_PIPELINE_NAME) throw new Error("Pipeline Financeiro não encontrado"); const etapas = [...pipeline.etapas];
      for (const [index, definition] of FINANCIAL_STAGES.entries()) { const existing = etapas[index]; etapas[index] = existing ? await tx.bpmEtapa.update({ where: { id: existing.id }, data: { nome: definition.label, ordem: index } }) : await tx.bpmEtapa.create({ data: { pipelineId, nome: definition.label, ordem: index } }) }
      const stageByKey = new Map(FINANCIAL_STAGES.map((stage, index) => [stage.key, etapas[index]])); const fields = [];
      for (const [ordem, definition] of FINANCIAL_FIELDS.entries()) { const etapa = stageByKey.get(definition.stage); if (!etapa) throw new Error("Etapa financeira não configurada"); const existing = pipeline.campos.find((campo) => campo.nome === definition.label); const data = { etapaId: etapa.id, nome: definition.label, tipo: definition.type, opcoesJson: definition.options ? JSON.stringify(definition.options) : null, obrigatorio: definition.category === "OBRIGATORIO", ordem }; fields.push(existing ? await tx.bpmCampo.update({ where: { id: existing.id }, data }) : await tx.bpmCampo.create({ data: { pipelineId, ...data } })) }
      for (let index = 0; index < FINANCIAL_STAGES.length - 1; index += 1) await tx.bpmEtapaTransicaoPermitida.upsert({ where: { etapaOrigemId_etapaDestinoId: { etapaOrigemId: etapas[index].id, etapaDestinoId: etapas[index + 1].id } }, create: { etapaOrigemId: etapas[index].id, etapaDestinoId: etapas[index + 1].id }, update: {} });
      await tx.bpmPipelineConfigAuditoria.create({ data: { pipelineId, adminId: userId, campoAlterado: "pipeline_financeiro_schema_aplicado", valorNovoJson: JSON.stringify({ schemaVersion: FINANCIAL_PIPELINE_SCHEMA_VERSION, etapas: FINANCIAL_STAGES.length, campos: FINANCIAL_FIELDS.length }) } }); return { etapas, campos: fields };
    });
    revalidatePath(`/PainelAlpha/AlphaCRM/admin/pipelines/${pipelineId}`); revalidatePath(`/PainelAlpha/AlphaCRM/pipeline/${pipelineId}`); await notificarPipelineBpm({ pipelineId, tipo: "PIPELINE_ALTERADO" }); return { success: true, data: result };
  } catch (error) { console.error("[ConfigurarPipelineFinanceiro]", error); return { success: false, error: error instanceof Error ? error.message : "Não foi possível configurar o pipeline Financeiro" } }
}
