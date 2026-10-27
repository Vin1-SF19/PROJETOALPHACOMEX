"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoConfigPipeline, listarUsuariosVinculaveisBpm } from "@/lib/bpm/ownership";
import { gravarRegrasAcessoPipeline, lerRegrasAcessoPipeline, possuiAcessoAnteriorAberto, regrasAcessoPipelineSchema } from "@/lib/bpm/acesso-pipeline";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const entradaSchema = z.object({
  pipelineId: z.string().cuid(), versao: z.number().int().nonnegative(), regras: regrasAcessoPipelineSchema,
}).strict();

export async function LerAcessosPipelineBpm(pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    await exigirAcessoConfigPipeline(Number(session.user.id), "configurarEtapas");
    if (!z.string().cuid().safeParse(pipelineId).success) return { success: false as const, error: "Funil inválido" };
    const [pipeline, setores, usuarios] = await Promise.all([
      db.bpmPipeline.findUnique({ where: { id: pipelineId }, select: {
        configVersion: true, visualizacaoConfigJson: true,
        setores: { select: { setor: { select: { id: true, nome: true, ativo: true } } } },
      } }),
      db.setor.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
      listarUsuariosVinculaveisBpm(),
    ]);
    if (!pipeline) return { success: false as const, error: "Funil não encontrado" };
    return { success: true as const, data: {
      setores, usuarios, versao: pipeline.configVersion,
      regras: lerRegrasAcessoPipeline(pipeline.visualizacaoConfigJson, pipeline.setores.map(({ setor }) => setor)),
      acessoAnteriorAberto: possuiAcessoAnteriorAberto(pipeline.visualizacaoConfigJson, pipeline.setores.map(({ setor }) => setor)),
    } };
  } catch { return { success: false as const, error: "Não foi possível carregar os acessos do funil." }; }
}

export async function SalvarAcessosPipelineBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarEtapas");
    const parsed = entradaSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, error: "Configuração de acesso inválida" };
    const { pipelineId, versao, regras } = parsed.data;
    const setorIds = regras.filter((regra) => regra.tipo === "SETOR").map((regra) => regra.id);
    const usuarioIds = regras.filter((regra) => regra.tipo === "USUARIO").map((regra) => regra.id);
    await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarEtapas", tx);
      const [anterior, setoresValidos, usuarios] = await Promise.all([
        tx.bpmPipeline.findUnique({ where: { id: pipelineId }, select: {
          visualizacaoConfigJson: true, setores: { select: { setor: { select: { id: true, nome: true, ativo: true } } } },
        } }),
        tx.setor.count({ where: { id: { in: setorIds }, ativo: true } }),
        listarUsuariosVinculaveisBpm(tx),
      ]);
      if (!anterior) throw new Error("Funil não encontrado");
      if (setoresValidos !== setorIds.length) throw new Error("Selecione setores ativos e disponíveis.");
      if (usuarioIds.some((id) => !usuarios.some((usuario) => usuario.id === id))) throw new Error("Selecione usuários ativos com acesso ao CRM.");
      const visualizacaoConfigJson = gravarRegrasAcessoPipeline(anterior.visualizacaoConfigJson, regras);
      const updated = await tx.bpmPipeline.updateMany({ where: { id: pipelineId, configVersion: versao },
        data: { configVersion: { increment: 1 }, visualizacaoConfigJson } });
      if (updated.count !== 1) throw new Error("CONFLITO");
      await tx.bpmPipelineSetor.deleteMany({ where: { pipelineId } });
      if (setorIds.length) await tx.bpmPipelineSetor.createMany({ data: setorIds.map((setorId) => ({ pipelineId, setorId })) });
      await tx.bpmPipelineConfigAuditoria.create({ data: {
        pipelineId, adminId: userId, campoAlterado: "acessos_pipeline",
        valorAnteriorJson: JSON.stringify(lerRegrasAcessoPipeline(anterior.visualizacaoConfigJson, anterior.setores.map(({ setor }) => setor))),
        valorNovoJson: JSON.stringify(regras),
      } });
    });
    revalidatePath("/PainelAlpha/AlphaCRM", "layout");
    try { await notificarPipelineBpm({ pipelineId, tipo: "PIPELINE_ALTERADO" }); } catch { /* O polling reaplica a política salva. */ }
    return { success: true as const, versao: versao + 1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { success: false as const, error: message === "CONFLITO" ? "A configuração mudou. Recarregue antes de salvar."
      : ["Funil não encontrado", "Selecione setores ativos e disponíveis.", "Selecione usuários ativos com acesso ao CRM."].includes(message)
        ? message : "Não foi possível salvar os acessos do funil." };
  }
}
