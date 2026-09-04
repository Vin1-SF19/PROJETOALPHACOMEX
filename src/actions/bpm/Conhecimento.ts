"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";

const idSchema = z.string().cuid();
const salvarLinkSchema = z.object({
  pipelineId: z.string().cuid(),
  titulo: z.string().trim().min(1).max(200),
  url: z.string().trim().url().max(2_000),
  descricao: z.string().trim().max(500).optional(),
  ordem: z.number().int().min(0).max(10_000).default(0),
});

async function exigirAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = Number(session.user.id);
  await exigirAcessoConfigPipeline(userId, "configurarEtapas");
  return { userId };
}

function erroPublico(error: unknown): string {
  if (error instanceof z.ZodError) return "Revise os dados informados — a URL precisa ser válida.";
  if (error instanceof Error && ["Não autorizado", "Não autorizado — apenas administradores configuram pipelines", "Link não encontrado", "Pipeline inválido"].includes(error.message)) {
    return error.message;
  }
  return "Não foi possível concluir a operação";
}

export async function ListarConhecimentoLinksBpm(pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado", data: [] };
    const links = await db.bpmPipelineConhecimentoLink.findMany({
      where: { pipelineId },
      orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      select: { id: true, titulo: true, url: true, descricao: true, ordem: true },
    });
    return { success: true as const, data: links };
  } catch (error) {
    console.error("[ListarConhecimentoLinksBpm]", error);
    return { success: false as const, error: "Erro ao carregar links", data: [] };
  }
}

export async function CriarConhecimentoLinkBpm(payload: unknown) {
  try {
    const { userId } = await exigirAdmin();
    const dados = salvarLinkSchema.parse(payload);
    const pipeline = await db.bpmPipeline.findUnique({ where: { id: dados.pipelineId }, select: { id: true } });
    if (!pipeline) throw new Error("Pipeline inválido");
    const criado = await db.bpmPipelineConhecimentoLink.create({
      data: { ...dados, descricao: dados.descricao || null, criadoPorId: userId },
    });
    revalidatePath(`/PainelAlpha/AlphaCRM/admin/pipelines/${dados.pipelineId}`);
    return { success: true as const, data: { id: criado.id } };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function ExcluirConhecimentoLinkBpm(payload: unknown) {
  try {
    await exigirAdmin();
    const dados = z.object({ id: idSchema }).parse(payload);
    const existente = await db.bpmPipelineConhecimentoLink.findUnique({ where: { id: dados.id }, select: { id: true, pipelineId: true } });
    if (!existente) throw new Error("Link não encontrado");
    await db.bpmPipelineConhecimentoLink.delete({ where: { id: dados.id } });
    revalidatePath(`/PainelAlpha/AlphaCRM/admin/pipelines/${existente.pipelineId}`);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}
