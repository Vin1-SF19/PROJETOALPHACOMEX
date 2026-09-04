"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import {
  atualizarRegraBpmSchema,
  salvarRegraBpmSchema,
} from "@/lib/bpm/regras/persistencia-schemas";
import { MARCADOR_REGRA_TRIBUTARIA } from "@/lib/bpm/regras-financeiras/schemas";

const ROTA_REGRAS = "/PainelAlpha/AlphaCRM/admin/regras";
const idSchema = z.string().cuid();

async function exigirAdminRegras() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = Number(session.user.id);
  await exigirAcessoConfigPipeline(userId, "configurarEtapas");
  return { userId };
}

function erroPublico(error: unknown): string {
  if (error instanceof z.ZodError) return "Revise os dados da regra — condição ou resultado inválidos.";
  if (error instanceof Error && [
    "Não autorizado",
    "Não autorizado — apenas administradores configuram pipelines",
    "Regra não encontrada",
    "Pipeline inválido",
  ].includes(error.message)) return error.message;
  return "Não foi possível concluir a operação";
}

async function validarPipeline(pipelineId: string | undefined) {
  if (!pipelineId) return;
  const pipeline = await db.bpmPipeline.findUnique({ where: { id: pipelineId }, select: { id: true } });
  if (!pipeline) throw new Error("Pipeline inválido");
}

export async function ListarWorkspaceRegrasBpm() {
  try {
    await exigirAdminRegras();
    const [regras, pipelines] = await Promise.all([
      db.bpmRegra.findMany({
        where: {
          NOT: { descricao: { startsWith: MARCADOR_REGRA_TRIBUTARIA } },
        },
        orderBy: [{ prioridade: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          nome: true,
          descricao: true,
          ativa: true,
          prioridade: true,
          pipelineId: true,
          etapasJson: true,
          versaoAtualNum: true,
          criadoPor: { select: { id: true, nome: true } },
          createdAt: true,
          updatedAt: true,
          pipeline: { select: { id: true, nome: true } },
          versoes: {
            orderBy: { versao: "desc" },
            take: 1,
            select: { versao: true, condicaoJson: true, resultadoJson: true, createdAt: true },
          },
        },
      }),
      db.bpmPipeline.findMany({
        where: { ativo: true },
        orderBy: { nome: "asc" },
        select: {
          id: true,
          nome: true,
          etapas: { orderBy: { ordem: "asc" }, select: { id: true, nome: true } },
        },
      }),
    ]);
    return {
      success: true as const,
      data: {
        pipelines,
        regras: regras.map((regra) => ({
          id: regra.id,
          nome: regra.nome,
          descricao: regra.descricao,
          ativa: regra.ativa,
          prioridade: regra.prioridade,
          pipelineId: regra.pipelineId,
          pipelineNome: regra.pipeline?.nome ?? null,
          etapasIds: regra.etapasJson ? (JSON.parse(regra.etapasJson) as string[]) : [],
          versaoAtual: regra.versaoAtualNum,
          criadoPor: regra.criadoPor,
          createdAt: regra.createdAt.toISOString(),
          updatedAt: regra.updatedAt.toISOString(),
          condicao: regra.versoes[0] ? JSON.parse(regra.versoes[0].condicaoJson) : null,
          resultado: regra.versoes[0] ? JSON.parse(regra.versoes[0].resultadoJson) : null,
        })),
      },
    };
  } catch (error) {
    return { success: false as const, error: erroPublico(error), data: { pipelines: [], regras: [] } };
  }
}

export async function CriarRegraBpm(payload: unknown) {
  try {
    const { userId } = await exigirAdminRegras();
    const dados = salvarRegraBpmSchema.parse(payload);
    await validarPipeline(dados.pipelineId);
    const regra = await db.$transaction(async (tx) => {
      const criada = await tx.bpmRegra.create({
        data: {
          nome: dados.nome,
          descricao: dados.descricao || null,
          ativa: dados.ativa,
          prioridade: dados.prioridade,
          pipelineId: dados.pipelineId ?? null,
          etapasJson: dados.etapasIds && dados.etapasIds.length > 0 ? JSON.stringify(dados.etapasIds) : null,
          versaoAtualNum: 1,
          criadoPorId: userId,
          versoes: {
            create: {
              versao: 1,
              condicaoJson: JSON.stringify(dados.condicao),
              resultadoJson: JSON.stringify(dados.resultado),
              criadoPorId: userId,
            },
          },
        },
      });
      if (dados.pipelineId) {
        await tx.bpmPipelineConfigAuditoria.create({
          data: {
            pipelineId: dados.pipelineId,
            adminId: userId,
            campoAlterado: "REGRA_CRIADA",
            valorNovoJson: JSON.stringify({ regraId: criada.id }),
          },
        });
      }
      return criada;
    });
    revalidatePath(ROTA_REGRAS);
    return { success: true as const, data: { id: regra.id } };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function AtualizarRegraBpm(payload: unknown) {
  try {
    const { userId } = await exigirAdminRegras();
    const dados = atualizarRegraBpmSchema.parse(payload);
    await validarPipeline(dados.pipelineId);
    const existente = await db.bpmRegra.findUnique({
      where: { id: dados.id },
      include: { versoes: { orderBy: { versao: "desc" }, take: 1 } },
    });
    if (!existente) throw new Error("Regra não encontrada");
    const versaoAtual = existente.versoes[0];
    const condicaoMudou = !versaoAtual || versaoAtual.condicaoJson !== JSON.stringify(dados.condicao);
    const resultadoMudou = !versaoAtual || versaoAtual.resultadoJson !== JSON.stringify(dados.resultado);
    const novaVersaoNum = existente.versaoAtualNum + (condicaoMudou || resultadoMudou ? 1 : 0);

    await db.$transaction(async (tx) => {
      await tx.bpmRegra.update({
        where: { id: dados.id },
        data: {
          nome: dados.nome,
          descricao: dados.descricao || null,
          ativa: dados.ativa,
          prioridade: dados.prioridade,
          pipelineId: dados.pipelineId ?? null,
          etapasJson: dados.etapasIds && dados.etapasIds.length > 0 ? JSON.stringify(dados.etapasIds) : null,
          versaoAtualNum: novaVersaoNum,
        },
      });
      if (condicaoMudou || resultadoMudou) {
        await tx.bpmRegraVersao.create({
          data: {
            regraId: dados.id,
            versao: novaVersaoNum,
            condicaoJson: JSON.stringify(dados.condicao),
            resultadoJson: JSON.stringify(dados.resultado),
            criadoPorId: userId,
          },
        });
      }
      if (dados.pipelineId) {
        await tx.bpmPipelineConfigAuditoria.create({
          data: {
            pipelineId: dados.pipelineId,
            adminId: userId,
            campoAlterado: "REGRA_ATUALIZADA",
            valorNovoJson: JSON.stringify({ regraId: dados.id, versao: novaVersaoNum }),
          },
        });
      }
    });
    revalidatePath(ROTA_REGRAS);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function AlternarAtivacaoRegraBpm(payload: unknown) {
  try {
    await exigirAdminRegras();
    const dados = z.object({ id: idSchema, ativa: z.boolean() }).parse(payload);
    const existente = await db.bpmRegra.findUnique({ where: { id: dados.id }, select: { id: true } });
    if (!existente) throw new Error("Regra não encontrada");
    await db.bpmRegra.update({ where: { id: dados.id }, data: { ativa: dados.ativa } });
    revalidatePath(ROTA_REGRAS);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function ExcluirRegraBpm(payload: unknown) {
  try {
    await exigirAdminRegras();
    const dados = z.object({ id: idSchema }).parse(payload);
    const existente = await db.bpmRegra.findUnique({ where: { id: dados.id }, select: { id: true } });
    if (!existente) throw new Error("Regra não encontrada");
    await db.bpmRegra.delete({ where: { id: dados.id } });
    revalidatePath(ROTA_REGRAS);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}
