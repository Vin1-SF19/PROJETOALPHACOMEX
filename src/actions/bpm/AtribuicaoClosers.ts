"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmPipeline, exigirAcessoConfigPipeline, usuarioElegivelResponsavelBpm } from "@/lib/bpm/ownership";
import { pipelineEhRevisaoRadar } from "@/lib/bpm/proximo-contato";
import {
  gravarConfiguracaoDistribuicaoClosers,
  lerConfiguracaoDistribuicaoClosers,
} from "@/lib/bpm/closer-distribution";
import { processarAtribuicoesClosersPendentesBpm } from "@/lib/bpm/atribuicao-closers-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { repetirTransacaoOcupada } from "@/lib/bpm/sqlite-busy-retry";

const salvarSchema = z.object({
  pipelineId: z.string().cuid(),
  ativa: z.boolean(),
  usuariosIds: z.array(z.number().int().positive()).max(100),
  versao: z.number().int().nonnegative(),
}).strict();

async function listarCandidatosElegiveis(pipelineId: string) {
  const usuarios = await db.usuarios.findMany({
    where: { status: "ATIVO" },
    select: { id: true, nome: true },
    orderBy: [{ nome: "asc" }, { id: "asc" }],
  });
  const elegiveis = await Promise.all(usuarios.map(async (usuario) =>
    await usuarioElegivelResponsavelBpm(pipelineId, usuario.id) ? usuario : null,
  ));
  return elegiveis.filter((usuario): usuario is NonNullable<typeof usuario> => usuario !== null);
}

export async function LerAtribuicaoClosersBpm(pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    if (!z.string().cuid().safeParse(pipelineId).success) return { success: false as const, error: "Pipeline inválido" };
    await exigirAcessoBpmPipeline(pipelineId, Number(session.user.id));
    const pipeline = await db.bpmPipeline.findUnique({
      where: { id: pipelineId },
      select: { nome: true, configVersion: true, visualizacaoConfigJson: true },
    });
    if (!pipeline || !pipelineEhRevisaoRadar(pipeline.nome)) {
      return { success: false as const, error: "A distribuição automática está disponível apenas em Revisão de Radar." };
    }
    const [usuarios, configuracao] = await Promise.all([
      listarCandidatosElegiveis(pipelineId),
      Promise.resolve(lerConfiguracaoDistribuicaoClosers(pipeline.visualizacaoConfigJson)),
    ]);
    return {
      success: true as const,
      data: {
        ativa: configuracao.ativa,
        usuariosIds: configuracao.usuariosIds,
        usuarios,
        versao: pipeline.configVersion,
      },
    };
  } catch {
    return { success: false as const, error: "Não foi possível carregar a configuração de atribuição." };
  }
}

export async function SalvarAtribuicaoClosersBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarEtapas");
    const parsed = salvarSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, error: "Configuração inválida" };
    const { pipelineId, ativa, versao } = parsed.data;
    const usuariosIds = [...new Set(parsed.data.usuariosIds)];
    if (ativa && usuariosIds.length === 0) {
      return { success: false as const, error: "Selecione ao menos um closer para ativar a distribuição." };
    }
    const pipeline = await db.bpmPipeline.findUnique({
      where: { id: pipelineId },
      select: { nome: true },
    });
    if (!pipeline || !pipelineEhRevisaoRadar(pipeline.nome)) {
      return { success: false as const, error: "A distribuição automática está disponível apenas em Revisão de Radar." };
    }
    if (ativa) {
      const elegibilidades = await Promise.all(usuariosIds.map(async (id) =>
        await usuarioElegivelResponsavelBpm(pipelineId, id),
      ));
      if (elegibilidades.some((elegivel) => !elegivel)) {
        return { success: false as const, error: "Selecione apenas closers ativos e elegíveis neste pipeline." };
      }
    }

    const resultado = await repetirTransacaoOcupada(() => db.$transaction(async (tx) => {
      const anterior = await tx.bpmPipeline.findUnique({
        where: { id: pipelineId },
        select: { nome: true, configVersion: true, visualizacaoConfigJson: true },
      });
      if (!anterior || !pipelineEhRevisaoRadar(anterior.nome)) throw new Error("PIPELINE_INVALIDO");
      if (anterior.configVersion !== versao) throw new Error("CONFLITO");
      const configAnterior = lerConfiguracaoDistribuicaoClosers(anterior.visualizacaoConfigJson);
      const novaConfiguracao = {
        ativa,
        usuariosIds,
        ultimoUsuarioId: usuariosIds.includes(configAnterior.ultimoUsuarioId ?? -1)
          ? configAnterior.ultimoUsuarioId
          : null,
      };
      const atualizado = await tx.bpmPipeline.updateMany({
        where: { id: pipelineId, configVersion: versao },
        data: {
          configVersion: { increment: 1 },
          visualizacaoConfigJson: gravarConfiguracaoDistribuicaoClosers(
            anterior.visualizacaoConfigJson,
            novaConfiguracao,
          ),
        },
      });
      if (atualizado.count !== 1) throw new Error("CONFLITO");
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId,
          adminId: userId,
          campoAlterado: "distribuicao_automatica_closers",
          valorAnteriorJson: JSON.stringify({ ativa: configAnterior.ativa, usuariosIds: configAnterior.usuariosIds }),
          valorNovoJson: JSON.stringify({ ativa, usuariosIds }),
        },
      });
      return versao + 1;
    }));
    revalidatePath("/PainelAlpha/AlphaCRM", "layout");
    try { await processarAtribuicoesClosersPendentesBpm(); }
    catch (error) { console.error("[SalvarAtribuicaoClosersBpm] Pendências continuam na fila", error instanceof Error ? error.name : "unknown"); }
    try { await notificarPipelineBpm({ pipelineId, tipo: "PIPELINE_ALTERADO" }); } catch { /* O polling também atualiza o quadro. */ }
    return { success: true as const, versao: resultado };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "";
    if (mensagem === "CONFLITO") return { success: false as const, error: "A configuração mudou. Recarregue antes de publicar." };
    if (mensagem === "Não autorizado" || mensagem.startsWith("Não autorizado —")) return { success: false as const, error: "Não autorizado" };
    return { success: false as const, error: "Não foi possível salvar a configuração de atribuição." };
  }
}
