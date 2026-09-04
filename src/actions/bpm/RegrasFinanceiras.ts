"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard, exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { carregarRegrasTributarias, calcularRegraTributariaDoCard } from "@/lib/bpm/regras-financeiras/persistencia";
import { calcularRegraTributaria } from "@/lib/bpm/regras-financeiras/motor";
import {
  alternarRegraTributariaSchema,
  codificarConfiguracaoTributaria,
  idRegraTributariaSchema,
  MARCADOR_REGRA_TRIBUTARIA,
  salvarRegraTributariaSchema,
} from "@/lib/bpm/regras-financeiras/schemas";

const ROTA_REGRAS_FINANCEIRAS =
  "/PainelAlpha/AlphaCRM/admin/regras-financeiras";

async function exigirAdministrador() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = Number(session.user.id);
  await exigirAcessoConfigPipeline(userId, "configurarEtapas");
  return { userId };
}

function mensagemPublica(error: unknown): string {
  if (error instanceof z.ZodError) return "Revise os dados da regra financeira.";
  if (
    error instanceof Error &&
    [
      "Não autorizado",
      "Não autorizado — apenas administradores configuram pipelines",
      "Pipeline Financeiro não encontrado",
      "Regra financeira não encontrada",
    ].includes(error.message)
  ) {
    return error.message;
  }
  return "Não foi possível concluir a operação";
}

async function exigirPipelineFinanceiro(pipelineId: string) {
  const pipeline = await db.bpmPipeline.findUnique({
    where: { id: pipelineId },
    select: { id: true, nome: true },
  });
  if (!pipeline || pipeline.nome !== "Financeiro") {
    throw new Error("Pipeline Financeiro não encontrado");
  }
  return pipeline;
}

export async function ListarWorkspaceRegrasFinanceiras() {
  try {
    await exigirAdministrador();
    const pipelines = await db.bpmPipeline.findMany({
      where: { nome: "Financeiro", ativo: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        nome: true,
        campos: {
          orderBy: [{ ordem: "asc" }, { nome: "asc" }],
          select: { id: true, nome: true, tipo: true, opcoesJson: true },
        },
      },
    });
    const regras = (
      await Promise.all(
        pipelines.map((pipeline) =>
          carregarRegrasTributarias(pipeline.id, db, false),
        ),
      )
    ).flat();
    const colaboradores = await db.usuarios.findMany({
      where: { status: "ATIVO" },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, cargo: true },
    });
    return {
      success: true as const,
      data: {
        pipelines,
        colaboradores,
        regras: regras.map((regra) => ({
          ...regra,
          updatedAt: regra.updatedAt.toISOString(),
          descricao: regra.descricao
            ?.slice(MARCADOR_REGRA_TRIBUTARIA.length)
            .trim() || null,
        })),
      },
    };
  } catch (error) {
    return {
      success: false as const,
      error: mensagemPublica(error),
      data: { pipelines: [], colaboradores: [], regras: [] },
    };
  }
}

export async function SalvarRegraTributaria(payload: unknown) {
  try {
    const { userId } = await exigirAdministrador();
    const dados = salvarRegraTributariaSchema.parse(payload);
    await exigirPipelineFinanceiro(dados.pipelineId);
    calcularRegraTributaria({
      regra: {
        id: dados.id ?? "validacao",
        nome: dados.nome,
        prioridade: dados.prioridade,
        versao: 1,
        condicao: dados.condicao,
        configuracao: dados.configuracao,
      },
      valorBrutoCents: 100_000,
      calculadoEm: new Date(0),
    });
    const referenciasDinamicas: string[] = [];
    const visitar = (grupo: typeof dados.condicao) => {
      for (const item of grupo.condicoes) {
        if ("tipo" in item) {
          if (item.campo.fonte === "campo_dinamico") referenciasDinamicas.push(item.campo.campo);
        } else visitar(item);
      }
    };
    visitar(dados.condicao);
    if (referenciasDinamicas.length > 0) {
      const quantidade = await db.bpmCampo.count({
        where: { pipelineId: dados.pipelineId, id: { in: referenciasDinamicas } },
      });
      if (quantidade !== new Set(referenciasDinamicas).size) {
        throw new Error("Campo financeiro não pertence ao pipeline");
      }
    }
    const resultadoJson = JSON.stringify({
      tipo: "resultado_condicional",
      valor: codificarConfiguracaoTributaria(dados.configuracao),
    });
    const condicaoJson = JSON.stringify(dados.condicao);

    const regraId = await db.$transaction(async (tx) => {
      if (!dados.id) {
        const criada = await tx.bpmRegra.create({
          data: {
            nome: dados.nome,
            descricao: `${MARCADOR_REGRA_TRIBUTARIA} ${dados.descricao ?? ""}`.trim(),
            ativa: dados.ativa,
            prioridade: dados.prioridade,
            pipelineId: dados.pipelineId,
            versaoAtualNum: 1,
            criadoPorId: userId,
            versoes: {
              create: {
                versao: 1,
                condicaoJson,
                resultadoJson,
                criadoPorId: userId,
              },
            },
          },
        });
        await tx.bpmPipelineConfigAuditoria.create({
          data: {
            pipelineId: dados.pipelineId,
            adminId: userId,
            campoAlterado: "REGRA_FINANCEIRA_CRIADA",
            valorNovoJson: JSON.stringify({ regraId: criada.id, versao: 1 }),
          },
        });
        return criada.id;
      }

      const existente = await tx.bpmRegra.findFirst({
        where: {
          id: dados.id,
          descricao: { startsWith: MARCADOR_REGRA_TRIBUTARIA },
        },
        select: { id: true, versaoAtualNum: true },
      });
      if (!existente) throw new Error("Regra financeira não encontrada");
      const novaVersao = existente.versaoAtualNum + 1;
      await tx.bpmRegra.update({
        where: { id: existente.id },
        data: {
          nome: dados.nome,
          descricao: `${MARCADOR_REGRA_TRIBUTARIA} ${dados.descricao ?? ""}`.trim(),
          ativa: dados.ativa,
          prioridade: dados.prioridade,
          pipelineId: dados.pipelineId,
          versaoAtualNum: novaVersao,
        },
      });
      await tx.bpmRegraVersao.create({
        data: {
          regraId: existente.id,
          versao: novaVersao,
          condicaoJson,
          resultadoJson,
          criadoPorId: userId,
        },
      });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: dados.pipelineId,
          adminId: userId,
          campoAlterado: "REGRA_FINANCEIRA_ATUALIZADA",
          valorNovoJson: JSON.stringify({ regraId: existente.id, versao: novaVersao }),
        },
      });
      return existente.id;
    });
    revalidatePath(ROTA_REGRAS_FINANCEIRAS);
    return { success: true as const, data: { id: regraId } };
  } catch (error) {
    return { success: false as const, error: mensagemPublica(error) };
  }
}

export async function AlternarRegraTributaria(payload: unknown) {
  try {
    const { userId } = await exigirAdministrador();
    const dados = alternarRegraTributariaSchema.parse(payload);
    const regra = await db.bpmRegra.findFirst({
      where: { id: dados.id, descricao: { startsWith: MARCADOR_REGRA_TRIBUTARIA } },
      select: { id: true, pipelineId: true, ativa: true },
    });
    if (!regra?.pipelineId) throw new Error("Regra financeira não encontrada");
    await db.$transaction(async (tx) => {
      await tx.bpmRegra.update({ where: { id: regra.id }, data: { ativa: dados.ativa } });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: regra.pipelineId!,
          adminId: userId,
          campoAlterado: "REGRA_FINANCEIRA_STATUS",
          valorAnteriorJson: JSON.stringify({ ativa: regra.ativa }),
          valorNovoJson: JSON.stringify({ ativa: dados.ativa }),
        },
      });
    });
    revalidatePath(ROTA_REGRAS_FINANCEIRAS);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemPublica(error) };
  }
}

export async function ExcluirRegraTributaria(payload: unknown) {
  try {
    const { userId } = await exigirAdministrador();
    const dados = idRegraTributariaSchema.parse(payload);
    const regra = await db.bpmRegra.findFirst({
      where: { id: dados.id, descricao: { startsWith: MARCADOR_REGRA_TRIBUTARIA } },
      select: { id: true, pipelineId: true, ativa: true },
    });
    if (!regra?.pipelineId) throw new Error("Regra financeira não encontrada");
    await db.$transaction(async (tx) => {
      await tx.bpmRegra.update({ where: { id: regra.id }, data: { ativa: false } });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: regra.pipelineId!,
          adminId: userId,
          campoAlterado: "REGRA_FINANCEIRA_INATIVADA",
          valorAnteriorJson: JSON.stringify({ ativa: regra.ativa }),
          valorNovoJson: JSON.stringify({ ativa: false, exclusaoLogica: true }),
        },
      });
    });
    revalidatePath(ROTA_REGRAS_FINANCEIRAS);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemPublica(error) };
  }
}

export async function CalcularRegraFinanceiraCard(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const parsedCardId = z.string().cuid().parse(cardId);
    await exigirAcessoBpmCard(
      parsedCardId,
      Number(session.user.id),
      session.user.role ?? null,
      "visualizar",
    );
    const resultado = await calcularRegraTributariaDoCard({
      cardId: parsedCardId,
    });
    return { success: true as const, data: resultado?.calculo ?? null };
  } catch (error) {
    const semCorrespondencia = error instanceof Error
      && error.message.startsWith("MOVIMENTO_INVALIDO:");
    return {
      success: false as const,
      error:
        error instanceof Error && error.message === "Não autorizado"
          ? "Não autorizado"
          : semCorrespondencia
            ? error.message.slice("MOVIMENTO_INVALIDO:".length)
          : "Não foi possível calcular a regra financeira",
    };
  }
}
