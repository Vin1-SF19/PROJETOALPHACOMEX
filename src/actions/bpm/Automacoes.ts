"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import {
  listarUsuariosVinculaveisBpm,
  usuarioElegivelResponsavelBpm,
} from "@/lib/bpm/ownership";
import {
  atualizarAutomacaoBpmSchema,
  duplicarAutomacaoBpmSchema,
  salvarAutomacaoBpmSchema,
  parametrosDistribuicaoSchema,
  parametrosOportunidadeSchema,
} from "@/lib/bpm/automacoes/schemas";
import { VariavelTemplateSchema } from "@/lib/gerador-documentos/schemas";
import {
  simularDistribuicaoBpm,
  simularOportunidadeBpm,
} from "@/lib/bpm/automacoes/distribuicao-oportunidades";
import type { GrupoCondicao } from "@/lib/bpm/regras/types";
import { publicarVersaoCentralDaDefinicaoSimples } from "@/lib/bpm/automacoes/centralizacao";

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
    "Serviço alvo inválido",
    "Responsável comercial inválido",
    "Responsável configurado inválido",
    "Um ou mais candidatos estão inativos ou sem acesso ao pipeline",
    "Uma condição usa campo fora do pipeline",
    "Uma condição ou ação usa campo fora do pipeline",
    "Automação ou card incompatível",
    "Uma condição usa parceiro inválido",
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

function idsCamposDinamicos(condicao: GrupoCondicao | null | undefined): string[] {
  if (!condicao) return [];
  const ids: string[] = [];
  const visitar = (grupo: GrupoCondicao) => {
    for (const item of grupo.condicoes) {
      if ("tipo" in item) {
        if (item.campo.fonte === "campo_dinamico") ids.push(item.campo.campo);
      } else visitar(item);
    }
  };
  visitar(condicao);
  return [...new Set(ids)];
}

function idsParceiros(condicao: GrupoCondicao | null | undefined): number[] {
  if (!condicao) return [];
  const ids: number[] = [];
  const visitar = (grupo: GrupoCondicao) => {
    for (const item of grupo.condicoes) {
      if ("tipo" in item) {
        if (item.campo.fonte === "contratacao" && item.campo.campo === "indicadoPorParceiroId") {
          const valores = Array.isArray(item.valor) ? item.valor : [item.valor];
          for (const valor of valores) {
            const id = Number(valor);
            if (Number.isInteger(id) && id > 0) ids.push(id);
          }
        }
      } else visitar(item);
    }
  };
  visitar(condicao);
  return [...new Set(ids)];
}

async function validarParceiros(condicao: GrupoCondicao | null | undefined) {
  const ids = idsParceiros(condicao);
  if (ids.length === 0) return;
  const total = await db.parceiro.count({ where: { id: { in: ids }, ativo: true } });
  if (total !== ids.length) throw new Error("Uma condição usa parceiro inválido");
}

async function validarConfiguracaoEspecial(dados: z.infer<typeof salvarAutomacaoBpmSchema>) {
  if (dados.acaoTipo === "DISTRIBUIR_RESPONSAVEL") {
    const parametros = parametrosDistribuicaoSchema.parse(dados.parametros);
    for (const usuarioId of parametros.candidatosIds) {
      if (!(await usuarioElegivelResponsavelBpm(dados.pipelineId, usuarioId))) {
        throw new Error("Um ou mais candidatos estão inativos ou sem acesso ao pipeline");
      }
    }
    const ids = idsCamposDinamicos(parametros.condicao);
    if (ids.length > 0) {
      const total = await db.bpmCampo.count({ where: { id: { in: ids }, pipelineId: dados.pipelineId } });
      if (total !== ids.length) throw new Error("Uma condição usa campo fora do pipeline");
    }
    await validarParceiros(parametros.condicao);
    return;
  }
  if (dados.acaoTipo !== "IDENTIFICAR_OPORTUNIDADE") return;
  const parametros = parametrosOportunidadeSchema.parse(dados.parametros);
  const servico = await db.servicosComerciais.findFirst({
    where: { id: parametros.servicoAlvoId, ativo: true },
    select: { id: true },
  });
  if (!servico) throw new Error("Serviço alvo inválido");
  const ids = idsCamposDinamicos(parametros.condicao);
  if (parametros.acao.tipo === "ALTERAR_CAMPO") ids.push(parametros.acao.campoId);
  const unicos = [...new Set(ids)];
  if (unicos.length > 0) {
    const total = await db.bpmCampo.count({ where: { id: { in: unicos }, pipelineId: dados.pipelineId } });
    if (total !== unicos.length) throw new Error("Uma condição ou ação usa campo fora do pipeline");
  }
  await validarParceiros(parametros.condicao);
  if (parametros.acao.tipo === "CRIAR_CARD_COMERCIAL") {
    await validarPipelineEtapa(parametros.acao.pipelineId, parametros.acao.etapaId);
    if (!(await usuarioElegivelResponsavelBpm(parametros.acao.pipelineId, parametros.acao.responsavelId))) {
      throw new Error("Responsável comercial inválido");
    }
  }
  if (parametros.acao.tipo === "ATRIBUIR_VENDEDOR" || parametros.acao.tipo === "CRIAR_TAREFA" && parametros.acao.responsavelId) {
    const responsavelId = parametros.acao.responsavelId;
    if (responsavelId && !(await usuarioElegivelResponsavelBpm(dados.pipelineId, responsavelId))) {
      throw new Error("Responsável configurado inválido");
    }
  }
}

export async function ListarCatalogosAutomacoesBpm() {
  try {
    await exigirAdminAutomacoes();
    const [usuarios, servicos, parceiros, pipelines] = await Promise.all([
      listarUsuariosVinculaveisBpm(),
      db.servicosComerciais.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
      db.parceiro.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true, nomeFantasia: true } }),
      db.bpmPipeline.findMany({
        where: { ativo: true },
        orderBy: { nome: "asc" },
        select: {
          id: true,
          nome: true,
          campos: { orderBy: { ordem: "asc" }, select: { id: true, nome: true, tipo: true, opcoesJson: true } },
        },
      }),
    ]);
    return { success: true as const, data: { usuarios, servicos, parceiros, pipelines } };
  } catch (error) {
    return { success: false as const, error: erroPublico(error), data: { usuarios: [], servicos: [], parceiros: [], pipelines: [] } };
  }
}

const simularAutomacaoSchema = z.object({
  automacaoId: z.string().cuid(),
  cardId: z.string().cuid(),
}).strict();

export async function SimularAutomacaoBpm(payload: unknown) {
  try {
    await exigirAdminAutomacoes();
    const dados = simularAutomacaoSchema.parse(payload);
    const [automacao, card] = await Promise.all([
      db.bpmAutomacao.findUnique({ where: { id: dados.automacaoId } }),
      db.bpmCard.findUnique({
        where: { id: dados.cardId },
        select: {
          id: true, pipelineId: true, etapaId: true, responsavelId: true,
          servico: true, tipoProcesso: true, status: true, createdAt: true,
          updatedAt: true, concluidoEm: true, primeiraVisualizacaoEm: true,
          proximoContatoEm: true, dataReuniao: true, statusPosFechamento: true,
          empresaId: true,
        },
      }),
    ]);
    if (!automacao || !card || automacao.pipelineId !== card.pipelineId) {
      throw new Error("Automação ou card incompatível");
    }
    if (automacao.acaoTipo === "DISTRIBUIR_RESPONSAVEL") {
      const configuracao = parametrosDistribuicaoSchema.parse(JSON.parse(automacao.parametrosJson));
      const cursor = await db.bpmCardHistorico.count({
        where: { acao: "DISTRIBUICAO_AUTOMATICA", automacaoOrigem: automacao.id },
      });
      return { success: true as const, data: await simularDistribuicaoBpm({ card, configuracao, cursor }) };
    }
    if (automacao.acaoTipo === "IDENTIFICAR_OPORTUNIDADE") {
      const configuracao = parametrosOportunidadeSchema.parse(JSON.parse(automacao.parametrosJson));
      return { success: true as const, data: await simularOportunidadeBpm({ card, configuracao }) };
    }
    return { success: false as const, error: "Simulação disponível para distribuição e oportunidades" };
  } catch (error) {
    return { success: false as const, error: erroPublico(error) };
  }
}

export async function ListarHistoricoAutomacaoBpm(automacaoId: string) {
  try {
    await exigirAdminAutomacoes();
    const id = idSchema.parse(automacaoId);
    const automacao = await db.bpmAutomacao.findUnique({ where: { id }, select: { id: true } });
    if (!automacao) throw new Error("Automação não encontrada");
    const execucoes = await db.bpmAutomacaoExecucao.findMany({
      where: { automacaoId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, cardId: true, eventoChave: true, gatilhoTipo: true, status: true,
        tentativas: true, mensagemErro: true, resultadoJson: true, iniciadoEm: true,
        executadoEm: true, createdAt: true,
      },
    });
    return {
      success: true as const,
      data: execucoes.map((execucao) => ({
        ...execucao,
        iniciadoEm: execucao.iniciadoEm?.toISOString() ?? null,
        executadoEm: execucao.executadoEm?.toISOString() ?? null,
        createdAt: execucao.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    return { success: false as const, error: erroPublico(error), data: [] };
  }
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
          },
        },
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
            etapaId: true,
            criadoPor: { select: { id: true, nome: true } },
            createdAt: true,
            updatedAt: true,
            versoes: {
              where: { status: "ATIVA" },
              orderBy: { versao: "desc" },
              take: 1,
              select: {
                id: true,
                versao: true,
                status: true,
                gatilhoTipo: true,
                gatilhoConfigJson: true,
                condicaoJson: true,
                grafoJson: true,
                timezone: true,
                agendas: {
                  where: { ativo: true },
                  orderBy: { proximaExecucaoEm: "asc" },
                  take: 1,
                  select: { proximaExecucaoEm: true },
                },
              },
            },
            execucoes: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                status: true,
                mensagemErro: true,
                resultadoJson: true,
                gatilhoTipo: true,
                executadoEm: true,
                createdAt: true,
                evento: { select: { tipo: true, atorTipo: true, ocorridoEm: true } },
              },
            },
            _count: { select: { execucoes: true } },
          },
        },
      },
    });
    return {
      success: true as const,
      data: pipelines.map((pipeline) => {
        const automacoes = pipeline.automacoes.map((automacao) => {
          const versaoAtiva = automacao.versoes[0] ?? null;
          let config: { escopo?: string; etapaId?: string; etapasIds?: string[]; recorrencia?: unknown } = {};
          try { config = versaoAtiva ? JSON.parse(versaoAtiva.gatilhoConfigJson) : {}; } catch { config = {}; }
          const escopo: "GLOBAL_PIPELINE" | "ETAPAS" = config.escopo === "GLOBAL_PIPELINE" ? "GLOBAL_PIPELINE" : "ETAPAS";
          const etapasIds = escopo === "GLOBAL_PIPELINE"
            ? []
            : [...new Set([...(Array.isArray(config.etapasIds) ? config.etapasIds : []), config.etapaId, automacao.etapaId].filter((id): id is string => typeof id === "string"))];
          const ultima = automacao.execucoes[0] ?? null;
          return {
            ...automacao,
            escopo,
            etapasIds,
            recorrencia: config.recorrencia ?? null,
            versaoAtiva: versaoAtiva ? {
              id: versaoAtiva.id,
              versao: versaoAtiva.versao,
              status: versaoAtiva.status,
              gatilhoTipo: versaoAtiva.gatilhoTipo,
              gatilhoConfigJson: versaoAtiva.gatilhoConfigJson,
              condicaoJson: versaoAtiva.condicaoJson,
              grafoJson: versaoAtiva.grafoJson,
              timezone: versaoAtiva.timezone,
            } : null,
            proximaExecucao: versaoAtiva?.agendas[0]?.proximaExecucaoEm.toISOString() ?? null,
            createdAt: automacao.createdAt.toISOString(),
            updatedAt: automacao.updatedAt.toISOString(),
            ultimaExecucao: ultima ? {
              ...ultima,
              executadoEm: ultima.executadoEm?.toISOString() ?? null,
              createdAt: ultima.createdAt.toISOString(),
              evento: ultima.evento ? { ...ultima.evento, ocorridoEm: ultima.evento.ocorridoEm.toISOString() } : null,
            } : null,
            execucoes: undefined,
            versoes: undefined,
          };
        });
        return {
          id: pipeline.id,
          nome: pipeline.nome,
          ativo: pipeline.ativo,
          automacoesGlobais: automacoes.filter((automacao) => automacao.escopo === "GLOBAL_PIPELINE"),
          etapas: pipeline.etapas.map((etapa) => ({
            ...etapa,
            automacoes: automacoes.filter((automacao) => automacao.etapasIds.includes(etapa.id)),
          })),
        };
      }),
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
    await validarConfiguracaoEspecial(dados);
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
      await publicarVersaoCentralDaDefinicaoSimples(tx, criada);
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
    await validarConfiguracaoEspecial(dados);
    await db.$transaction(async (tx) => {
      const atualizada = await tx.bpmAutomacao.update({
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
      });
      await publicarVersaoCentralDaDefinicaoSimples(tx, atualizada);
      await tx.bpmPipelineConfigAuditoria.create({
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
      });
    });
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
      ...(!ativa ? [db.bpmAutomacaoAgenda.updateMany({ where: { automacaoVersao: { automacaoId: id }, ativo: true }, data: { ativo: false } })] : []),
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
    if (ativa) {
      const versao = await db.bpmAutomacaoVersao.findFirst({ where: { automacaoId: id, status: "ATIVA" }, orderBy: { versao: "desc" }, select: { id: true } });
      if (versao) await (await import("@/lib/bpm/automacoes/agenda")).sincronizarAgendasVersaoAutomacao(versao.id);
    }
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
    await db.$transaction(async (tx) => {
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: atual.pipelineId,
          adminId: userId,
          campoAlterado: "AUTOMACAO_ARQUIVADA",
          valorAnteriorJson: JSON.stringify({ automacaoId: id, etapaId: atual.etapaId, nome: atual.nome }),
        },
      });
      await tx.bpmAutomacao.update({ where: { id }, data: { ativa: false } });
    });
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
    const origem = await db.bpmAutomacao.findUnique({
      where: { id: dados.automacaoId },
      include: { versoes: { where: { status: "ATIVA" }, orderBy: { versao: "desc" }, take: 1 } },
    });
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
      const versaoOrigem = origem.versoes[0];
      if (versaoOrigem) {
        let gatilhoConfig: Record<string, unknown> = {};
        try { gatilhoConfig = JSON.parse(versaoOrigem.gatilhoConfigJson); } catch { gatilhoConfig = {}; }
        delete gatilhoConfig.origemChave;
        await tx.bpmAutomacaoVersao.create({ data: {
          automacaoId: automacao.id,
          versao: 1,
          status: "ATIVA",
          gatilhoTipo: versaoOrigem.gatilhoTipo,
          gatilhoConfigJson: JSON.stringify({ ...gatilhoConfig, escopo: "ETAPAS", etapaId: dados.etapaId, etapasIds: [dados.etapaId] }),
          condicaoJson: versaoOrigem.condicaoJson,
          grafoJson: versaoOrigem.grafoJson,
          timezone: versaoOrigem.timezone,
          criadoPorId: userId,
          ativadaEm: new Date(),
        } });
      } else {
        await publicarVersaoCentralDaDefinicaoSimples(tx, automacao);
      }
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
