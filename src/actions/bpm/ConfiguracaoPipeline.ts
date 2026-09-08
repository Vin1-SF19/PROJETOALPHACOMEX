"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import db from "@/lib/prisma";
import { auth } from "../../../auth";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  resumirAlteracoesPublicacao,
  validarSnapshotPublicacao,
  type CampoAtualPublicacao,
  type EtapaPublicacao,
  type TransicaoPublicacao,
} from "@/lib/bpm/pipeline-config-publicacao";

const etapaSchema = z.object({
  id: z.string().min(1).max(120),
  ordem: z.number().int().min(0).max(10_000),
  ativo: z.boolean(),
  ehInicial: z.boolean(),
  ehFinal: z.boolean(),
}).strict();

const transicaoSchema = z.object({
  id: z.string().min(1).max(120),
  etapaOrigemId: z.string().min(1).max(120),
  etapaDestinoId: z.string().min(1).max(120),
  permitida: z.boolean(),
  origem: z.enum(["MANUAL", "AUTOMACAO", "AMBOS"]),
}).strict();

const publicacaoSchema = z.object({
  pipelineId: z.string().min(1).max(120),
  versaoEsperada: z.string().datetime({ offset: true }),
  etapas: z.array(etapaSchema).max(250),
  transicoes: z.array(transicaoSchema).max(62_500),
  campos: z.array(z.object({ id: z.string().min(1).max(120), ativo: z.boolean() }).strict()).max(2_000),
}).strict();

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

export async function PublicarConfiguracaoPipelineBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = publicacaoSchema.safeParse(dados);
    if (!parsed.success) return { success: false as const, error: parsed.error.flatten() };
    const proposta = parsed.data;

    const resultado = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarEtapas", tx);
      const [pipeline, campos] = await Promise.all([
        tx.bpmPipeline.findUnique({
          where: { id: proposta.pipelineId },
          select: {
            id: true,
            updatedAt: true,
            etapas: { select: { id: true, ordem: true, ativo: true, ehInicial: true, ehFinal: true } },
            transicoesEtapa: {
              select: { id: true, etapaOrigemId: true, etapaDestinoId: true, permitida: true, origem: true },
            },
          },
        }),
        tx.bpmCampo.findMany({
          where: {
            OR: [
              { pipelineId: proposta.pipelineId },
              { pipelinesAssociados: { some: { pipelineId: proposta.pipelineId } } },
            ],
          },
          select: {
            id: true,
            nome: true,
            tipo: true,
            ativo: true,
            fonteEntidade: true,
            fonteAtributo: true,
            opcoesJson: true,
            opcoes: { select: { ativo: true } },
          },
        }),
      ]);
      if (!pipeline) throw new Error("PIPELINE_NAO_ENCONTRADO");
      if (pipeline.updatedAt.toISOString() !== proposta.versaoEsperada) throw new Error("CONFLITO_VERSAO");

      const atual = {
        etapas: pipeline.etapas as EtapaPublicacao[],
        transicoes: pipeline.transicoesEtapa as TransicaoPublicacao[],
        campos: campos as CampoAtualPublicacao[],
      };
      const erros = validarSnapshotPublicacao({ atual, proposto: proposta });
      if (erros.length) throw new Error(`CONFIGURACAO_INVALIDA:${erros.join("|")}`);
      const alteracoes = resumirAlteracoesPublicacao({ atual, proposto: proposta });

      const novaVersao = new Date(Math.max(Date.now(), pipeline.updatedAt.getTime() + 1));
      const cas = await tx.bpmPipeline.updateMany({
        where: { id: proposta.pipelineId, updatedAt: pipeline.updatedAt },
        data: { updatedAt: novaVersao },
      });
      if (cas.count !== 1) throw new Error("CONFLITO_VERSAO");

      for (const etapa of proposta.etapas) {
        const anterior = pipeline.etapas.find((item) => item.id === etapa.id)!;
        if (etapa.ordem === anterior.ordem && etapa.ativo === anterior.ativo && etapa.ehInicial === anterior.ehInicial && etapa.ehFinal === anterior.ehFinal) continue;
        await tx.bpmEtapa.update({
          where: { id: etapa.id },
          data: { ordem: etapa.ordem, ativo: etapa.ativo, ehInicial: etapa.ehInicial, ehFinal: etapa.ehFinal },
        });
      }
      for (const transicao of proposta.transicoes) {
        const anterior = pipeline.transicoesEtapa.find((item) => item.id === transicao.id)!;
        if (transicao.permitida === anterior.permitida && transicao.origem === anterior.origem) continue;
        await tx.bpmTransicaoEtapa.update({
          where: { id: transicao.id },
          data: { permitida: transicao.permitida, origem: transicao.origem },
        });
      }
      for (const campo of proposta.campos) {
        const anterior = campos.find((item) => item.id === campo.id)!;
        if (campo.ativo === anterior.ativo) continue;
        await tx.bpmCampo.update({ where: { id: campo.id }, data: { ativo: campo.ativo } });
      }

      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: proposta.pipelineId,
          adminId: userId,
          campoAlterado: "configuracao_publicada",
          valorAnteriorJson: JSON.stringify({ versao: pipeline.updatedAt.toISOString() }),
          valorNovoJson: JSON.stringify({ versao: novaVersao.toISOString(), alteracoes }),
        },
      });
      return { versao: novaVersao.toISOString(), alteracoes };
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${proposta.pipelineId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${proposta.pipelineId}`);
    try {
      await notificarPipelineBpm({ pipelineId: proposta.pipelineId, tipo: "PIPELINE_ALTERADO" });
    } catch (error) {
      console.error("[PublicarConfiguracaoPipelineBpm:notificacao_pos_commit]", error);
    }
    return { success: true as const, data: resultado };
  } catch (error) {
    if (error instanceof Error && error.message === "CONFLITO_VERSAO") {
      return { success: false as const, conflict: true as const, error: "A configuração mudou desde o carregamento. Recarregue antes de publicar." };
    }
    if (error instanceof Error && error.message.startsWith("CONFIGURACAO_INVALIDA:")) {
      return { success: false as const, error: error.message.slice("CONFIGURACAO_INVALIDA:".length).split("|") };
    }
    if (error instanceof Error && error.message === "PIPELINE_NAO_ENCONTRADO") {
      return { success: false as const, error: "Pipeline não encontrado" };
    }
    console.error("[PublicarConfiguracaoPipelineBpm]", error instanceof Error ? error.name : "erro");
    return { success: false as const, error: "Erro ao publicar configuração" };
  }
}
