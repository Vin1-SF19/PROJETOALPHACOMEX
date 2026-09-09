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
  nome: z.string().trim().min(1).max(160),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").nullable(),
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
  baseVersion: z.number().int().positive(),
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
            configVersion: true,
            etapas: { select: { id: true, nome: true, cor: true, ordem: true, ativo: true, ehInicial: true, ehFinal: true } },
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
      if (pipeline.configVersion !== proposta.baseVersion) {
        throw new Error("CONFLITO_VERSAO");
      }

      const atual = {
        etapas: pipeline.etapas as EtapaPublicacao[],
        transicoes: pipeline.transicoesEtapa as TransicaoPublicacao[],
        campos: campos as CampoAtualPublicacao[],
      };
      const erros = validarSnapshotPublicacao({ atual, proposto: proposta });
      if (erros.length) throw new Error(`CONFIGURACAO_INVALIDA:${erros.join("|")}`);
      const alteracoes = resumirAlteracoesPublicacao({ atual, proposto: proposta });

      // O CAS precisa ser uma única escrita condicional. Uma leitura seguida de
      // update incondicional permitiria que duas sessões com a mesma base
      // publicassem. Filhos e contador permanecem na mesma transação.
      const cas = await tx.bpmPipeline.updateMany({
        where: {
          id: proposta.pipelineId,
          configVersion: proposta.baseVersion,
        },
        data: { configVersion: { increment: 1 } },
      });
      if (cas.count !== 1) throw new Error("CONFLITO_VERSAO");
      const novaVersao = proposta.baseVersion + 1;
      const etapasAtuaisPorId = new Map(pipeline.etapas.map((item) => [item.id, item]));
      const transicoesAtuaisPorId = new Map(pipeline.transicoesEtapa.map((item) => [item.id, item]));
      const camposAtuaisPorId = new Map(campos.map((item) => [item.id, item]));

      for (const etapa of proposta.etapas) {
        const anterior = etapasAtuaisPorId.get(etapa.id);
        if (!anterior) {
          await tx.bpmEtapa.create({
            data: {
              id: etapa.id,
              pipelineId: proposta.pipelineId,
              nome: etapa.nome,
              cor: etapa.cor,
              ordem: etapa.ordem,
              ativo: etapa.ativo,
              ehInicial: etapa.ehInicial,
              ehFinal: etapa.ehFinal,
            },
          });
        } else if (etapa.nome !== anterior.nome || etapa.cor !== anterior.cor || etapa.ordem !== anterior.ordem || etapa.ativo !== anterior.ativo || etapa.ehInicial !== anterior.ehInicial || etapa.ehFinal !== anterior.ehFinal) {
          await tx.bpmEtapa.update({
            where: { id: etapa.id },
            data: { nome: etapa.nome, cor: etapa.cor, ordem: etapa.ordem, ativo: etapa.ativo, ehInicial: etapa.ehInicial, ehFinal: etapa.ehFinal },
          });
        }
      }
      for (const transicao of proposta.transicoes) {
        const anterior = transicoesAtuaisPorId.get(transicao.id);
        if (!anterior) {
          await tx.bpmTransicaoEtapa.create({
            data: {
              id: transicao.id,
              pipelineId: proposta.pipelineId,
              etapaOrigemId: transicao.etapaOrigemId,
              etapaDestinoId: transicao.etapaDestinoId,
              permitida: transicao.permitida,
              origem: transicao.origem,
            },
          });
        } else if (transicao.permitida !== anterior.permitida || transicao.origem !== anterior.origem) {
          await tx.bpmTransicaoEtapa.update({
            where: { id: transicao.id },
            data: { permitida: transicao.permitida, origem: transicao.origem },
          });
        }
      }
      for (const campo of proposta.campos) {
        const anterior = camposAtuaisPorId.get(campo.id)!;
        if (campo.ativo === anterior.ativo) continue;
        await tx.bpmCampo.update({ where: { id: campo.id }, data: { ativo: campo.ativo } });
      }

      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: proposta.pipelineId,
          adminId: userId,
          campoAlterado: "configuracao_publicada",
          valorAnteriorJson: JSON.stringify({ configVersion: proposta.baseVersion }),
          valorNovoJson: JSON.stringify({ configVersion: novaVersao, alteracoes }),
        },
      });
      return { configVersion: novaVersao, alteracoes };
    }, { isolationLevel: "Serializable" });

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
