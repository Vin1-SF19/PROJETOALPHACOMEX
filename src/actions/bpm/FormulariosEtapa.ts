"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "../../../auth";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import db from "@/lib/prisma";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const componenteSchema = z
  .object({
    chave: z.string().trim().min(1).max(100),
    tipo: z.enum(["CAMPO", "CHECKLIST", "CAPABILITY"]),
    campoId: z.string().trim().min(1).nullable(),
    capability: z.string().trim().max(100).nullable(),
    configJson: z.string().trim().max(20_000).nullable(),
  })
  .superRefine((componente, context) => {
    if (componente.tipo === "CAMPO" && !componente.campoId) {
      context.addIssue({ code: "custom", path: ["campoId"], message: "Componente CAMPO exige campoId." });
    }
    if (componente.tipo === "CAPABILITY" && !componente.capability) {
      context.addIssue({ code: "custom", path: ["capability"], message: "Componente CAPABILITY exige capability." });
    }
  });

const salvarFormularioSchema = z
  .object({
    pipelineId: z.string().trim().min(1),
    etapaId: z.string().trim().min(1),
    ativo: z.boolean(),
    secoes: z
      .array(
        z.object({
          chave: z.string().trim().min(1).max(100),
          titulo: z.string().trim().min(1).max(120),
          componentes: z.array(componenteSchema).max(100),
        }),
      )
      .max(30),
  })
  .superRefine((formulario, context) => {
    const chavesSecao = formulario.secoes.map((secao) => secao.chave);
    if (new Set(chavesSecao).size !== chavesSecao.length) {
      context.addIssue({ code: "custom", path: ["secoes"], message: "As chaves das seções devem ser únicas." });
    }
    formulario.secoes.forEach((secao, indice) => {
      const chaves = secao.componentes.map((componente) => componente.chave);
      if (new Set(chaves).size !== chaves.length) {
        context.addIssue({ code: "custom", path: ["secoes", indice, "componentes"], message: "As chaves dos componentes devem ser únicas na seção." });
      }
    });
  });

const formularioInclude = {
  secoes: {
    orderBy: { ordem: "asc" as const },
    include: {
      componentes: {
        orderBy: { ordem: "asc" as const },
        include: { campo: { select: { id: true, nome: true, tipo: true } } },
      },
    },
  },
};

export async function SalvarFormularioEtapaBpm(input: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return { success: false, error: "Não autorizado" } as const;
    const parsed = salvarFormularioSchema.safeParse(input);
    if (!parsed.success)
      return { success: false, error: parsed.error.flatten() } as const;
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCampos");
    const { pipelineId, etapaId, ativo, secoes } = parsed.data;

    const formulario = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarCampos", tx);
      const etapa = await tx.bpmEtapa.findFirst({
        where: { id: etapaId, pipelineId },
        select: {
          id: true,
          formulario: {
            include: {
              secoes: {
                include: { componentes: true },
                orderBy: { ordem: "asc" },
              },
            },
          },
        },
      });
      if (!etapa) throw new Error("ETAPA_FORA_PIPELINE");

      const campoIds = [
        ...new Set(
          secoes.flatMap((secao) =>
            secao.componentes.flatMap((componente) =>
              componente.campoId ? [componente.campoId] : [],
            ),
          ),
        ),
      ];
      if (campoIds.length > 0) {
        const camposValidos = await tx.bpmCampo.count({
          where: {
            id: { in: campoIds },
            ativo: true,
            etapaConfiguracoes: { some: { etapaId } },
            OR: [
              { pipelineId },
              { pipelinesAssociados: { some: { pipelineId } } },
            ],
          },
        });
        if (camposValidos !== campoIds.length)
          throw new Error("CAMPO_FORA_FORMULARIO_ETAPA");
      }

      const anterior = etapa.formulario;
      const base = anterior
        ? await tx.bpmEtapaFormulario.update({
            where: { id: anterior.id },
            data: { ativo, versao: { increment: 1 } },
          })
        : await tx.bpmEtapaFormulario.create({ data: { etapaId, ativo } });
      await tx.bpmFormularioSecao.deleteMany({
        where: { formularioId: base.id },
      });
      for (const [ordemSecao, secao] of secoes.entries()) {
        await tx.bpmFormularioSecao.create({
          data: {
            formularioId: base.id,
            chave: secao.chave,
            titulo: secao.titulo,
            ordem: ordemSecao,
            componentes: {
              create: secao.componentes.map((componente, ordem) => ({
                chave: componente.chave,
                tipo: componente.tipo,
                campoId:
                  componente.tipo === "CAMPO" ? componente.campoId : null,
                capability:
                  componente.tipo === "CAPABILITY"
                    ? componente.capability
                    : null,
                configJson: componente.configJson,
                ordem,
              })),
            },
          },
        });
      }
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId,
          adminId: userId,
          campoAlterado: "formulario_etapa",
          valorAnteriorJson: anterior ? JSON.stringify(anterior) : null,
          valorNovoJson: JSON.stringify({ etapaId, ativo, secoes }),
        },
      });
      return tx.bpmEtapaFormulario.findUniqueOrThrow({
        where: { id: base.id },
        include: formularioInclude,
      });
    });

    revalidatePath(`/PainelAlpha/AlphaCRM/admin/pipelines/${pipelineId}`);
    try {
      await notificarPipelineBpm({ pipelineId, tipo: "PIPELINE_ALTERADO" });
    } catch (error) {
      console.error("[SalvarFormularioEtapaBpm:notificacao]", error);
    }
    return { success: true, data: formulario } as const;
  } catch (error) {
    console.error("[SalvarFormularioEtapaBpm]", error);
    const mensagem =
      error instanceof Error &&
      ["ETAPA_FORA_PIPELINE", "CAMPO_FORA_FORMULARIO_ETAPA"].includes(
        error.message,
      )
        ? error.message
        : "Erro ao salvar formulário da etapa";
    return { success: false, error: mensagem } as const;
  }
}
