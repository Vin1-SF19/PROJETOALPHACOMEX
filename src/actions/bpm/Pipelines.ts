"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import {
  criarPipelineSchema,
  atualizarPipelineSchema,
} from "@/lib/validations/bpm";
import {
  checarAcessoBpmPipeline,
  exigirAcessoBpmPipeline,
  exigirAcessoConfigPipeline,
  exigirAcessoModuloBpm,
  isAdminRole,
} from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

export async function ListarPipelinesBpm(incluirInativos = false) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);
    await exigirAcessoModuloBpm(userId);

    const pipelines = await db.bpmPipeline.findMany({
      where: incluirInativos ? undefined : { ativo: true },
      select: {
        id: true,
        nome: true,
        ativo: true,
        setores: { select: { setor: { select: { id: true, nome: true } } } },
        _count: { select: { cards: true, etapas: true } },
      },
      orderBy: { nome: "asc" },
    });

    const acessos = await Promise.all(
      pipelines.map((pipeline) => checarAcessoBpmPipeline(pipeline.id, userId)),
    );
    return {
      success: true,
      data: pipelines.filter((_, index) => acessos[index]),
    };
  } catch (error) {
    console.error("[ListarPipelinesBpm]", error);
    return { success: false, error: "Erro ao buscar pipelines", data: [] };
  }
}

/** Popula seletor de setores na criação/edição de pipeline (Fase 3 — central de configurações). */
export async function ListarSetoresParaPipelineBpm() {
  try {
    const session = await auth();
    // Resolve permission server-side; a valid session alone cannot enumerate sectors.
    if (session?.user?.id) await exigirAcessoModuloBpm(Number(session.user.id));
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };

    const setores = await db.setor.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });

    return { success: true, data: setores };
  } catch (error) {
    console.error("[ListarSetoresParaPipelineBpm]", error);
    return { success: false, error: "Erro ao buscar setores", data: [] };
  }
}

export async function ObterPipelineBpm(pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    await exigirAcessoBpmPipeline(pipelineId, Number(session.user.id));

    const pipeline = await db.bpmPipeline.findUnique({
      where: { id: pipelineId },
      include: {
        etapas: {
          where: { ativo: true },
          orderBy: { ordem: "asc" },
          include: {
            camposObrigatorios: { select: { campoId: true } },
          },
        },
        campos: { orderBy: { ordem: "asc" } },
        setores: { include: { setor: { select: { id: true, nome: true } } } },
      },
    });

    if (!pipeline) return { success: false, error: "Pipeline não encontrado" };
    return { success: true, data: pipeline };
  } catch (error) {
    console.error("[ObterPipelineBpm]", error);
    return { success: false, error: "Erro ao buscar pipeline" };
  }
}

export async function CriarPipelineBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    // D-031: apenas administradores configuram pipelines (criação inclusa).
    await exigirAcessoConfigPipeline(Number(session.user.id), "criarPipeline");

    const parsed = criarPipelineSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { nome, setorIds } = parsed.data;

    const pipeline = await db.bpmPipeline.create({
      data: {
        nome,
        setores: { create: setorIds.map((setorId) => ({ setorId })) },
      },
      include: { setores: true },
    });

    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/admin`);
    await notificarPipelineBpm({ pipelineId: pipeline.id, tipo: "PIPELINE_ALTERADO" });
    return { success: true, data: pipeline };
  } catch (error) {
    console.error("[CriarPipelineBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao criar pipeline";
    return { success: false, error: msg };
  }
}

export async function AtualizarPipelineBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    await exigirAcessoConfigPipeline(Number(session.user.id), "configurarEtapas");

    const parsed = atualizarPipelineSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { pipelineId, nome, ativo, setorIds } = parsed.data;

    const pipeline = await db.$transaction(async (tx) => {
      const atualizado = await tx.bpmPipeline.update({
        where: { id: pipelineId },
        data: { nome, ativo },
      });

      if (setorIds) {
        await tx.bpmPipelineSetor.deleteMany({ where: { pipelineId } });
        await tx.bpmPipelineSetor.createMany({
          data: setorIds.map((setorId) => ({ pipelineId, setorId })),
        });
      }

      return atualizado;
    });

    revalidatePath(ROTA_BASE);
    await notificarPipelineBpm({ pipelineId, tipo: "PIPELINE_ALTERADO" });
    return { success: true, data: pipeline };
  } catch (error) {
    console.error("[AtualizarPipelineBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao atualizar pipeline";
    return { success: false, error: msg };
  }
}

export { isAdminRole };
