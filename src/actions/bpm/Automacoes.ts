"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import {
  atualizarAutomacaoBpmSchema,
  duplicarAutomacaoBpmSchema,
  salvarAutomacaoBpmSchema,
} from "@/lib/bpm/automacoes/schemas";
import { VariavelTemplateSchema } from "@/lib/gerador-documentos/schemas";

const ROTA_AUTOMACOES = "/PainelAlpha/AlphaCRM/automacoes";
const idSchema = z.string().cuid();

function lerVariaveisTemplate(valor: unknown) {
  try {
    const normalizado = typeof valor === "string" ? JSON.parse(valor) : valor;
    const parsed = z.array(VariavelTemplateSchema).safeParse(normalizado);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

async function exigirAdminAutomacoes() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = Number(session.user.id);
  await exigirAcessoConfigPipeline(userId, "configurarEtapas");
  return { userId };
}

function erroPublico(error: unknown): string {
  if (error instanceof z.ZodError) return "Revise os dados da automação";
  if (error instanceof Error && error.message.includes("administradores")) return error.message;
  if (error instanceof Error && [
    "Não autorizado",
    "Pipeline ou coluna inválida",
    "Automação não encontrada",
    "Template de contrato inválido",
  ].includes(error.message)) return error.message;
  return "Não foi possível concluir a operação";
}

async function validarPipelineEtapa(pipelineId: string, etapaId: string) {
  const etapa = await db.bpmEtapa.findFirst({
    where: { id: etapaId, pipelineId },
    select: { id: true },
  });
  if (!etapa) throw new Error("Pipeline ou coluna inválida");
}

async function validarTemplateContrato(acaoTipo: string, parametros: unknown) {
  if (acaoTipo !== "GERAR_CONTRATO") return;
  const templateId = (parametros as { templateId?: unknown }).templateId;
  if (typeof templateId !== "string") throw new Error("Template de contrato inválido");
  const template = await db.documentoTemplate.findFirst({
    where: { id: templateId, status: "ATIVO" },
    select: { id: true },
  });
  if (!template) throw new Error("Template de contrato inválido");
}

export async function ListarWorkspaceAutomacoesBpm() {
  try {
    await exigirAdminAutomacoes();
    const pipelines = await db.bpmPipeline.findMany({
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        ativo: true,
        etapas: {
          orderBy: { ordem: "asc" },
          select: {
            id: true,
            nome: true,
            ordem: true,
            ativo: true,
            automacoes: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                nome: true,
                descricao: true,
                gatilhoTipo: true,
                tempoMinutos: true,
                acaoTipo: true,
                parametrosJson: true,
                ativa: true,
                criadoPor: { select: { id: true, nome: true } },
                createdAt: true,
                updatedAt: true,
                execucoes: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: {
                    id: true,
                    status: true,
                    mensagemErro: true,
                    executadoEm: true,
                    createdAt: true,
                  },
                },
                _count: { select: { execucoes: true } },
              },
            },
          },
        },
      },
    });
    return {
      success: true as const,
      data: pipelines.map((pipeline) => ({
        ...pipeline,
        etapas: pipeline.etapas.map((etapa) => ({
          ...etapa,
          automacoes: etapa.automacoes.map((automacao) => ({
            ...automacao,
            createdAt: automacao.createdAt.toISOString(),
            updatedAt: automacao.updatedAt.toISOString(),
            ultimaExecucao: automacao.execucoes[0]
              ? {
                  ...automacao.execucoes[0],
                  executadoEm: automacao.execucoes[0].executadoEm?.toISOString() ?? null,
                  createdAt: automacao.execucoes[0].createdAt.toISOString(),
                }
              : null,
            execucoes: undefined,
          })),
        })),
      })),
    };
  } catch (error) {
    return { success: false as const, error: erroPublico(error), data: [] };
  }
}

export async function ListarTemplatesAutomacoesBpm() {
  try {
    await exigirAdminAutomacoes();
    const templates = await db.documentoTemplate.findMany({
      where: { status: "ATIVO" },
      orderBy: { titulo: "asc" },
      select: { id: true, titulo: true, categoria: true, variaveisJson: true },
    });
    return {
      success: true as const,
      data: templates.map((template) => {
        return {
          ...template,
          variaveis: lerVariaveisTemplate(template.variaveisJson),
          variaveisJson: undefined,
        };
      }),
    };
  } catch (error) {
    return { success: false as const, error: erroPublico(error), data: [] };
  }
}

export async function CriarAutomacaoBpm(payload: unknown) {
  try {
    const { userId } = await exigirAdminAutomacoes();
    const dados = salvarAutomacaoBpmSchema.parse(payload);
    await validarPipelineEtapa(dados.pipelineId, dados.etapaId);
    await validarTemplateContrato(dados.acaoTipo, dados.parametros);
    const automacao = await db.$transaction(async (tx) => {
      const criada = await tx.bpmAutomacao.create({
        data: {
          nome: dados.nome,
          descricao: dados.descricao || null,
          pipelineId: dados.pipelineId,
          etapaId: dados.etapaId,
          gatilhoTipo: dados.gatilhoTipo,
          tempoMinutos: dados.gatilhoTipo === "TEMPO_NA_COLUNA" ? dados.tempoMinutos : null,
          acaoTipo: dados.acaoTipo,
          parametrosJson: JSON.stringify(dados.parametros),
          ativa: dados.ativa,
          criadoPorId: userId,
        },
      });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: dados.pipelineId,
          adminId: userId,
          campoAlterado: "AUTOMACAO_CRIADA",
          valorNovoJson: JSON.stringify({ automacaoId: criada.id, etapaId: dados.etapaId }),
        },
      });
      return criada;
    });
    revalidatePath(ROTA_AUTOMACOES);
    return { success: true as const, data: { id: automacao.id } };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function AtualizarAutomacaoBpm(payload: unknown) {
  try {
    const { userId } = await exigirAdminAutomacoes();
    const { automacaoId, dados } = atualizarAutomacaoBpmSchema.parse(payload);
    const anterior = await db.bpmAutomacao.findUnique({ where: { id: automacaoId } });
    if (!anterior) throw new Error("Automação não encontrada");
    await validarPipelineEtapa(dados.pipelineId, dados.etapaId);
    await validarTemplateContrato(dados.acaoTipo, dados.parametros);
    await db.$transaction([
      db.bpmAutomacao.update({
        where: { id: automacaoId },
        data: {
          nome: dados.nome,
          descricao: dados.descricao || null,
          pipelineId: dados.pipelineId,
          etapaId: dados.etapaId,
          gatilhoTipo: dados.gatilhoTipo,
          tempoMinutos: dados.gatilhoTipo === "TEMPO_NA_COLUNA" ? dados.tempoMinutos : null,
          acaoTipo: dados.acaoTipo,
          parametrosJson: JSON.stringify(dados.parametros),
          ativa: dados.ativa,
        },
      }),
      db.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: dados.pipelineId,
          adminId: userId,
          campoAlterado: "AUTOMACAO_ATUALIZADA",
          valorAnteriorJson: JSON.stringify({
            automacaoId,
            pipelineId: anterior.pipelineId,
            etapaId: anterior.etapaId,
          }),
          valorNovoJson: JSON.stringify({ automacaoId, etapaId: dados.etapaId }),
        },
      }),
    ]);
    revalidatePath(ROTA_AUTOMACOES);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function AlternarAutomacaoBpm(automacaoId: string, ativa: boolean) {
  try {
    const { userId } = await exigirAdminAutomacoes();
    const id = idSchema.parse(automacaoId);
    const atual = await db.bpmAutomacao.findUnique({ where: { id } });
    if (!atual) throw new Error("Automação não encontrada");
    await db.$transaction([
      db.bpmAutomacao.update({ where: { id }, data: { ativa } }),
      db.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: atual.pipelineId,
          adminId: userId,
          campoAlterado: "AUTOMACAO_STATUS",
          valorAnteriorJson: JSON.stringify({ automacaoId: id, ativa: atual.ativa }),
          valorNovoJson: JSON.stringify({ automacaoId: id, ativa }),
        },
      }),
    ]);
    revalidatePath(ROTA_AUTOMACOES);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function ExcluirAutomacaoBpm(automacaoId: string) {
  try {
    const { userId } = await exigirAdminAutomacoes();
    const id = idSchema.parse(automacaoId);
    const atual = await db.bpmAutomacao.findUnique({ where: { id } });
    if (!atual) throw new Error("Automação não encontrada");
    await db.$transaction([
      db.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: atual.pipelineId,
          adminId: userId,
          campoAlterado: "AUTOMACAO_EXCLUIDA",
          valorAnteriorJson: JSON.stringify({ automacaoId: id, etapaId: atual.etapaId, nome: atual.nome }),
        },
      }),
      db.bpmAutomacao.delete({ where: { id } }),
    ]);
    revalidatePath(ROTA_AUTOMACOES);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function DuplicarAutomacaoBpm(payload: unknown) {
  try {
    const { userId } = await exigirAdminAutomacoes();
    const dados = duplicarAutomacaoBpmSchema.parse(payload);
    const origem = await db.bpmAutomacao.findUnique({ where: { id: dados.automacaoId } });
    if (!origem) throw new Error("Automação não encontrada");
    await validarPipelineEtapa(dados.pipelineId, dados.etapaId);
    const nome = (dados.nome ?? `${origem.nome} (cópia)`).slice(0, 120);
    const criada = await db.$transaction(async (tx) => {
      const automacao = await tx.bpmAutomacao.create({
        data: {
          nome,
          descricao: origem.descricao,
          pipelineId: dados.pipelineId,
          etapaId: dados.etapaId,
          gatilhoTipo: origem.gatilhoTipo,
          tempoMinutos: origem.tempoMinutos,
          acaoTipo: origem.acaoTipo,
          parametrosJson: origem.parametrosJson,
          ativa: false,
          criadoPorId: userId,
        },
      });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: dados.pipelineId,
          adminId: userId,
          campoAlterado: "AUTOMACAO_DUPLICADA",
          valorAnteriorJson: JSON.stringify({ automacaoId: origem.id }),
          valorNovoJson: JSON.stringify({ automacaoId: automacao.id, etapaId: dados.etapaId }),
        },
      });
      return automacao;
    });
    revalidatePath(ROTA_AUTOMACOES);
    return { success: true as const, data: { id: criada.id } };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}
