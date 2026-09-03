"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "../../../auth";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import db from "@/lib/prisma";
import { isAdminRole, normalizeRole } from "@/lib/roles";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";
const pipelineIdSchema = z.string().cuid();

const perfilSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform((perfil) => normalizeRole(perfil))
  .refine((perfil) => perfil.length > 0, "Perfil inválido");

const salvarVisibilidadeEtapaSchema = z
  .object({
    etapaId: z.string().cuid(),
    regras: z
      .array(
        z.object({
          perfil: perfilSchema,
          podeVer: z.boolean(),
          podeAgir: z.boolean(),
        }),
      )
      .max(100),
  })
  .superRefine(({ regras }, context) => {
    const perfis = new Set<string>();
    regras.forEach((regra, index) => {
      if (regra.podeAgir && !regra.podeVer) {
        context.addIssue({
          code: "custom",
          path: ["regras", index, "podeAgir"],
          message: "Quem pode agir também precisa poder visualizar",
        });
      }
      if (perfis.has(regra.perfil)) {
        context.addIssue({
          code: "custom",
          path: ["regras", index, "perfil"],
          message: "Perfil duplicado",
        });
      }
      perfis.add(regra.perfil);
    });
  });

function perfisDisponiveis(
  roles: readonly { role: string }[],
): Array<{ perfil: string; nome: string }> {
  const porPerfil = new Map<string, string>();
  for (const { role } of roles) {
    const perfil = normalizeRole(role);
    if (!perfil || isAdminRole(role) || porPerfil.has(perfil)) continue;
    porPerfil.set(perfil, role.trim());
  }
  return [...porPerfil.entries()]
    .map(([perfil, nome]) => ({ perfil, nome }))
    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));
}

export async function ListarConfiguracaoVisibilidadePipelineBpm(
  pipelineId: string,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Não autorizado", data: null };
    }
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarEtapas");
    const parsedPipelineId = pipelineIdSchema.safeParse(pipelineId);
    if (!parsedPipelineId.success) {
      return { success: false, error: "Pipeline inválido", data: null };
    }

    const [pipeline, roles] = await Promise.all([
      db.bpmPipeline.findUnique({
        where: { id: parsedPipelineId.data },
        select: {
          id: true,
          etapas: {
            where: { ativo: true },
            orderBy: { ordem: "asc" },
            select: {
              id: true,
              nome: true,
              ordem: true,
              visibilidades: {
                select: { perfil: true, podeVer: true, podeAgir: true },
                orderBy: { perfil: "asc" },
              },
            },
          },
        },
      }),
      db.usuarios.findMany({
        where: { status: "ATIVO" },
        select: { role: true },
        distinct: ["role"],
        orderBy: { role: "asc" },
      }),
    ]);
    if (!pipeline) {
      return { success: false, error: "Pipeline não encontrado", data: null };
    }

    return {
      success: true,
      data: {
        pipelineId: pipeline.id,
        perfis: perfisDisponiveis(roles),
        etapas: pipeline.etapas,
      },
    };
  } catch (error) {
    console.error("[ListarConfiguracaoVisibilidadePipelineBpm]", error);
    const message = error instanceof Error && error.message.includes("administradores")
      ? error.message
      : "Erro ao carregar visibilidade das etapas";
    return { success: false, error: message, data: null };
  }
}

export async function SalvarVisibilidadeEtapaBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Não autorizado", data: null };
    }
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarEtapas");

    const parsed = salvarVisibilidadeEtapaSchema.safeParse(dados);
    if (!parsed.success) {
      return { success: false, error: parsed.error.flatten(), data: null };
    }
    const { etapaId } = parsed.data;
    const regras = parsed.data.regras.filter((regra) => regra.podeVer);

    const [etapa, roles] = await Promise.all([
      db.bpmEtapa.findUnique({
        where: { id: etapaId },
        select: {
          pipelineId: true,
          visibilidades: {
            select: { perfil: true, podeVer: true, podeAgir: true },
            orderBy: { perfil: "asc" },
          },
        },
      }),
      db.usuarios.findMany({
        where: { status: "ATIVO" },
        select: { role: true },
        distinct: ["role"],
      }),
    ]);
    if (!etapa) {
      return { success: false, error: "Etapa não encontrada", data: null };
    }

    const permitidos = new Set(
      perfisDisponiveis(roles).map(({ perfil }) => perfil),
    );
    if (regras.some((regra) => !permitidos.has(regra.perfil))) {
      return { success: false, error: "Um ou mais perfis são inválidos", data: null };
    }

    const atualizadas = await db.$transaction(async (tx) => {
      await tx.bpmEtapaVisibilidade.deleteMany({ where: { etapaId } });
      if (regras.length > 0) {
        await tx.bpmEtapaVisibilidade.createMany({
          data: regras.map((regra) => ({ etapaId, ...regra })),
        });
      }
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: etapa.pipelineId,
          adminId: userId,
          campoAlterado: "visibilidade_etapa",
          valorAnteriorJson: JSON.stringify({ etapaId, regras: etapa.visibilidades }),
          valorNovoJson: JSON.stringify({ etapaId, regras }),
        },
      });
      return tx.bpmEtapaVisibilidade.findMany({
        where: { etapaId },
        select: { perfil: true, podeVer: true, podeAgir: true },
        orderBy: { perfil: "asc" },
      });
    });

    revalidatePath(`${ROTA_BASE}/admin/pipelines/${etapa.pipelineId}`);
    revalidatePath(`${ROTA_BASE}/pipeline/${etapa.pipelineId}`);
    await notificarPipelineBpm({
      pipelineId: etapa.pipelineId,
      tipo: "PIPELINE_ALTERADO",
    });
    return { success: true, data: atualizadas };
  } catch (error) {
    console.error("[SalvarVisibilidadeEtapaBpm]", error);
    const message = error instanceof Error && error.message.includes("administradores")
      ? error.message
      : "Erro ao salvar visibilidade da etapa";
    return { success: false, error: message, data: null };
  }
}
