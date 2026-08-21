import db from "@/lib/prisma";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  FINANCIAL_FIELDS,
  FINANCIAL_PIPELINE_NAME,
  FINANCIAL_STAGES,
  financialStageKeyFromLabel,
  hasConfiguredFinancialPipeline,
} from "@/lib/bpm/pipeline-financeiro";

export interface SchemaFinanceiroResult {
  applied: boolean;
  etapas?: Array<{ id: string; nome: string; ordem: number; slaDias: number | null; ativo: boolean }>;
  campos?: Array<{ id: string; etapaId: string | null; nome: string; tipo: string; obrigatorio: boolean; ordem: number }>;
}

/**
 * Garante que um pipeline "Financeiro" tenha o schema de 5 etapas aplicado.
 * Idempotente: se o schema já está configurado, não faz nada.
 * Não exige permissão de admin — é uma operação de integridade de dados.
 */
export async function garantirSchemaFinanceiro(pipelineId: string): Promise<SchemaFinanceiroResult> {
  const pipeline = await db.bpmPipeline.findUnique({
    where: { id: pipelineId },
    include: {
      etapas: { where: { ativo: true }, orderBy: { ordem: "asc" } },
      campos: true,
    },
  });

  if (!pipeline || pipeline.nome !== FINANCIAL_PIPELINE_NAME) {
    return { applied: false };
  }

  if (hasConfiguredFinancialPipeline(pipeline.etapas, pipeline.campos)) {
    return { applied: false };
  }

  const result = await db.$transaction(async (tx) => {
    const etapasAtivas = [...pipeline.etapas];
    const etapasUsadas = new Set<string>();
    const stageByKey = new Map<string, (typeof etapasAtivas)[number]>();

    for (const [index, definition] of FINANCIAL_STAGES.entries()) {
      const candidatasSemanticas = etapasAtivas.filter(
        (etapa) => !etapasUsadas.has(etapa.id) && financialStageKeyFromLabel(etapa.nome) === definition.key
      );
      const existing =
        candidatasSemanticas.find((etapa) => etapa.nome === definition.label)
        ?? candidatasSemanticas[0]
        ?? etapasAtivas.find((etapa) => !etapasUsadas.has(etapa.id) && financialStageKeyFromLabel(etapa.nome) === null);

      const etapa = existing
        ? await tx.bpmEtapa.update({ where: { id: existing.id }, data: { nome: definition.label, ordem: index } })
        : await tx.bpmEtapa.create({ data: { pipelineId, nome: definition.label, ordem: index } });

      etapasUsadas.add(etapa.id);
      stageByKey.set(definition.key, etapa);
    }

    const etapas = FINANCIAL_STAGES.map((definition) => {
      const etapa = stageByKey.get(definition.key);
      if (!etapa) throw new Error("Etapa financeira não configurada");
      return etapa;
    });

    const etapasExcedentes = etapasAtivas.filter((etapa) => !etapasUsadas.has(etapa.id));
    if (etapasExcedentes.length > 0) {
      for (const etapaExcedente of etapasExcedentes) {
        const chaveDestino = financialStageKeyFromLabel(etapaExcedente.nome) ?? "concluidos";
        const etapaDestino = stageByKey.get(chaveDestino);
        if (!etapaDestino) throw new Error("Etapa financeira de destino não configurada");
        await tx.bpmCard.updateMany({ where: { etapaId: etapaExcedente.id }, data: { etapaId: etapaDestino.id } });
      }
      await tx.bpmEtapa.updateMany({
        where: { id: { in: etapasExcedentes.map((etapa) => etapa.id) } },
        data: { ativo: false },
      });
    }

    const fields = [];
    for (const [ordem, definition] of FINANCIAL_FIELDS.entries()) {
      const etapa = stageByKey.get(definition.stage);
      if (!etapa) throw new Error("Etapa financeira não configurada");
      const existing = pipeline.campos.find((campo) => campo.nome === definition.label);
      const data = {
        etapaId: etapa.id,
        nome: definition.label,
        tipo: definition.type,
        opcoesJson: definition.options ? JSON.stringify(definition.options) : null,
        obrigatorio: definition.category === "OBRIGATORIO",
        ordem,
      };
      fields.push(
        existing
          ? await tx.bpmCampo.update({ where: { id: existing.id }, data })
          : await tx.bpmCampo.create({ data: { pipelineId, ...data } })
      );
    }

    for (let index = 0; index < FINANCIAL_STAGES.length - 1; index += 1) {
      await tx.bpmEtapaTransicaoPermitida.upsert({
        where: {
          etapaOrigemId_etapaDestinoId: {
            etapaOrigemId: etapas[index].id,
            etapaDestinoId: etapas[index + 1].id,
          },
        },
        create: { etapaOrigemId: etapas[index].id, etapaDestinoId: etapas[index + 1].id },
        update: {},
      });
    }

    return { etapas, campos: fields };
  });

  await notificarPipelineBpm({ pipelineId, tipo: "PIPELINE_ALTERADO" });
  return { applied: true, etapas: result.etapas, campos: result.campos };
}
