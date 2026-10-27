"use server";

import { gravarRegrasAcessoPipeline, resolverAutoridadeAdministrativaPipeline } from "@/lib/bpm/acesso-pipeline";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import {
  criarPipelineSchema,
  atualizarPipelineSchema,
  ativarDesativarPipelineSchema,
  reordenarPipelinesSchema,
} from "@/lib/validations/bpm";
import {
  checarAcessoBpmPipeline,
  checarAcessoConfigPipeline,
  exigirAcessoBpmPipeline,
  exigirAcessoConfigPipeline,
  exigirAcessoModuloBpm,
  isAdminRole,
} from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { avancarConfigVersionBpm } from "@/lib/bpm/config-version";
import { contarCardsVisiveisNoQuadro } from "@/lib/bpm/cards-no-quadro";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

function projetarAutomacaoNoBoard(automacao: {
  id: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
  gatilhoTipo: string;
  etapaId: string;
  versoes: Array<{
    gatilhoTipo: string;
    gatilhoConfigJson: string;
    condicaoJson: string | null;
    grafoJson: string;
  }>;
}) {
  const versao = automacao.versoes[0] ?? null;
  let config: {
    escopo?: string;
    etapaId?: string;
    etapasIds?: string[];
    recorrencia?: unknown;
  } = {};
  let acoes: string[] = [];
  try {
    if (versao) {
      config = JSON.parse(versao.gatilhoConfigJson);
      const grafo = JSON.parse(versao.grafoJson) as {
        nos?: Array<{ tipo?: string; acaoTipo?: string }>;
      };
      acoes = (grafo.nos ?? [])
        .filter((no) => no.tipo === "ACAO" && no.acaoTipo)
        .map((no) => no.acaoTipo!);
    }
  } catch {
    // Uma definição inválida continua visível para que possa ser corrigida na central.
  }
  const escopo: "GLOBAL_PIPELINE" | "ETAPAS" =
    config.escopo === "GLOBAL_PIPELINE" ? "GLOBAL_PIPELINE" : "ETAPAS";
  const etapasIds =
    escopo === "GLOBAL_PIPELINE"
      ? []
      : [
          ...new Set(
            [
              ...(Array.isArray(config.etapasIds) ? config.etapasIds : []),
              config.etapaId,
              automacao.etapaId,
            ].filter((id): id is string => typeof id === "string"),
          ),
        ];
  return {
    id: automacao.id,
    nome: automacao.nome,
    descricao: automacao.descricao,
    ativa: automacao.ativa,
    escopo,
    etapasIds,
    gatilhoTipo: versao?.gatilhoTipo ?? automacao.gatilhoTipo,
    possuiCondicoes: Boolean(versao?.condicaoJson),
    acoes,
    recorrencia: config.recorrencia ?? null,
  };
}

export async function ListarPipelinesBpm(incluirInativos = false) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);
    await exigirAcessoModuloBpm(userId);
    const [admin, usuario] = await Promise.all([
      checarAcessoConfigPipeline(userId, "visualizarPipeline"),
      db.usuarios.findUnique({ where: { id: userId }, select: { role: true } }),
    ]);

    const pipelines = await db.bpmPipeline.findMany({
      where: incluirInativos ? undefined : { ativo: true },
      select: {
        id: true,
        nome: true,
        ativo: true,
        ordem: true,
        setores: { select: { setor: { select: { id: true, nome: true } } } },
        _count: { select: { etapas: true } },
      },
      orderBy: { nome: "asc" },
    });

    const acessos = await Promise.all(
      pipelines.map((pipeline) => checarAcessoBpmPipeline(pipeline.id, userId)),
    );
    const permitidos = pipelines.filter((_, index) => acessos[index]);
    const contagens = await Promise.all(permitidos.map((pipeline) =>
      contarCardsVisiveisNoQuadro(pipeline.id, userId, usuario?.role ?? null, admin)));
    return {
      success: true,
      data: permitidos.map((pipeline, index) => ({
        ...pipeline,
        _count: { ...pipeline._count, cards: contagens[index] },
      })),
    };
  } catch (error) {
    console.error("[ListarPipelinesBpm]", error);
    return { success: false, error: "Erro ao buscar pipelines", data: [] };
  }
}

/**
 * `incluirInativas` traz também etapas desativadas e o cadastro de substatus — usado
 * pela tela admin (Fase 3) para permitir reativar etapas e gerir substatus. O board
 * (`incluirInativas=false`, padrão) recebe somente as etapas ativas e visíveis.
 */
export async function ObterPipelineBpm(
  pipelineId: string,
  incluirInativas = false,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoBpmPipeline(pipelineId, userId);
    if (incluirInativas) {
      await exigirAcessoConfigPipeline(userId, "configurarEtapas");
    }

    const pipeline = await db.bpmPipeline.findUnique({
      where: { id: pipelineId },
      omit: { visualizacaoConfigJson: false },
      include: {
        etapas: {
          where: incluirInativas ? undefined : { ativo: true },
          orderBy: { ordem: "asc" },
          include: {
            visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } },
            transicoesEtapaOrigem: {
              where: { permitida: true, origem: { in: ["MANUAL", "AMBOS"] } },
              select: { etapaDestinoId: true },
            },
            subStatus: { orderBy: { ordem: "asc" } },
            formulario: {
              include: {
                secoes: {
                  orderBy: { ordem: "asc" },
                  include: {
                    componentes: {
                      orderBy: { ordem: "asc" },
                      include: {
                        campo: { select: { id: true, nome: true, tipo: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        campos: {
          orderBy: { ordem: "asc" },
          include: {
            pipeline: { select: { id: true, nome: true } },
            pipelinesAssociados: {
              include: { pipeline: { select: { id: true, nome: true } } },
            },
            etapaConfiguracoes: {
              include: {
                etapa: { select: { id: true, nome: true, pipelineId: true } },
              },
            },
            acessos: true,
            opcoes: { orderBy: { ordem: "asc" } },
            mapeamentoDestino: true,
          },
        },
        setores: { include: { setor: { select: { id: true, nome: true, ativo: true } } } },
        automacoes: {
          orderBy: { nome: "asc" },
          select: {
            id: true,
            nome: true,
            descricao: true,
            ativa: true,
            gatilhoTipo: true,
            etapaId: true,
            versoes: {
              where: { status: "ATIVA" },
              orderBy: { versao: "desc" },
              take: 1,
              select: {
                gatilhoTipo: true,
                gatilhoConfigJson: true,
                condicaoJson: true,
                grafoJson: true,
              },
            },
          },
        },
        configAuditoria: {
          orderBy: { createdAt: "desc" },
          take: incluirInativas ? 50 : 0,
          select: {
            id: true,
            campoAlterado: true,
            createdAt: true,
            admin: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!pipeline) return { success: false, error: "Pipeline não encontrado" };
    const camposAssociados = await db.bpmCampo.findMany({
      where: {
        pipelineId: { not: pipelineId },
        pipelinesAssociados: { some: { pipelineId } },
      },
      include: {
        pipeline: { select: { id: true, nome: true } },
        pipelinesAssociados: {
          include: { pipeline: { select: { id: true, nome: true } } },
        },
        etapaConfiguracoes: {
          include: {
            etapa: { select: { id: true, nome: true, pipelineId: true } },
          },
        },
        acessos: true,
        opcoes: { orderBy: { ordem: "asc" } },
        mapeamentoDestino: true,
      },
    });
    const usuario = await db.usuarios.findUnique({ where: { id: userId }, select: { role: true } });
    if (!usuario) return { success: false, error: "Não autorizado" };
    const administradorPipeline = Boolean(resolverAutoridadeAdministrativaPipeline({
      usuarioId: userId, role: usuario.role, visualizacaoConfigJson: pipeline.visualizacaoConfigJson,
      setoresPipeline: pipeline.setores.map(({ setor }) => setor),
    }));
    const etapasPermitidas = pipeline.etapas.filter((etapa) => incluirInativas || administradorPipeline
      || resolverVisibilidadeEtapa(usuario.role, etapa.visibilidades).podeVer);
    const etapasVisiveis = new Set(etapasPermitidas.map((etapa) => etapa.id));
    const automacoes = pipeline.automacoes.map(projetarAutomacaoNoBoard);
    const { automacoes: _definicoes, visualizacaoConfigJson: _acessos, ...dadosPipeline } = pipeline;
    void _definicoes; void _acessos;
    return {
      success: true,
      data: {
        ...dadosPipeline,
        campos: [...dadosPipeline.campos, ...camposAssociados].sort(
          (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome),
        ),
        automacoesGlobais: automacoes.filter(
          (automacao) => automacao.escopo === "GLOBAL_PIPELINE",
        ),
        etapas: etapasPermitidas.map((etapa) => {
          const { visibilidades: _regras, ...dadosEtapa } = etapa;
          void _regras;
          return {
            ...dadosEtapa,
            transicoesEtapaOrigem: etapa.transicoesEtapaOrigem.filter((transicao) => etapasVisiveis.has(transicao.etapaDestinoId)),
            automacoes: automacoes.filter((automacao) => automacao.etapasIds.includes(etapa.id)),
          };
        }),
      },
    };
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
    if (!parsed.success)
      return { success: false, error: parsed.error.flatten() };
    const { nome } = parsed.data;

    const pipeline = await db.bpmPipeline.create({
      data: {
        nome,
        visualizacaoConfigJson: gravarRegrasAcessoPipeline(null, []),
      },
      include: { setores: true },
    });

    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/admin`);
    await notificarPipelineBpm({
      pipelineId: pipeline.id,
      tipo: "PIPELINE_ALTERADO",
    });
    return { success: true, data: pipeline };
  } catch (error) {
    console.error("[CriarPipelineBpm]", error);
    const msg =
      error instanceof Error && error.message.includes("administradores")
        ? error.message
        : "Erro ao criar pipeline";
    return { success: false, error: msg };
  }
}

export async function AtualizarPipelineBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    await exigirAcessoConfigPipeline(
      Number(session.user.id),
      "configurarEtapas",
    );

    const parsed = atualizarPipelineSchema.safeParse(dados);
    if (!parsed.success)
      return { success: false, error: parsed.error.flatten() };
    const { pipelineId, nome } = parsed.data;

    const pipeline = await db.$transaction(async (tx) => {
      const atualizado = await tx.bpmPipeline.update({
        where: { id: pipelineId },
        data: { nome },
      });

      await avancarConfigVersionBpm(tx, pipelineId);

      return atualizado;
    });

    revalidatePath(ROTA_BASE);
    await notificarPipelineBpm({ pipelineId, tipo: "PIPELINE_ALTERADO" });
    return { success: true, data: pipeline };
  } catch (error) {
    console.error("[AtualizarPipelineBpm]", error);
    const msg =
      error instanceof Error && error.message.includes("administradores")
        ? error.message
        : "Erro ao atualizar pipeline";
    return { success: false, error: msg };
  }
}

export async function AtivarDesativarPipelineBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "criarPipeline");

    const parsed = ativarDesativarPipelineSchema.safeParse(dados);
    if (!parsed.success)
      return { success: false, error: parsed.error.flatten() };
    const { pipelineId, ativo } = parsed.data;

    const pipelineAnterior = await db.bpmPipeline.findUnique({
      where: { id: pipelineId },
    });
    if (!pipelineAnterior)
      return { success: false, error: "Pipeline não encontrado" };

    const pipeline = await db.$transaction(async (tx) => {
      const atualizado = await tx.bpmPipeline.update({
        where: { id: pipelineId },
        data: { ativo },
      });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId,
          adminId: userId,
          campoAlterado: "pipeline_ativo",
          valorAnteriorJson: JSON.stringify({ ativo: pipelineAnterior.ativo }),
          valorNovoJson: JSON.stringify({ ativo }),
        },
      });
      await avancarConfigVersionBpm(tx, pipelineId);
      return atualizado;
    });

    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/admin`);
    await notificarPipelineBpm({ pipelineId, tipo: "PIPELINE_ALTERADO" });
    return { success: true, data: pipeline };
  } catch (error) {
    console.error("[AtivarDesativarPipelineBpm]", error);
    const msg =
      error instanceof Error && error.message.includes("administradores")
        ? error.message
        : "Erro ao ativar/desativar pipeline";
    return { success: false, error: msg };
  }
}

export async function ReordenarPipelinesBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "criarPipeline");

    const parsed = reordenarPipelinesSchema.safeParse(dados);
    if (!parsed.success)
      return { success: false, error: parsed.error.flatten() };
    const { ordem } = parsed.data;

    await db.$transaction(
      ordem.map(({ pipelineId, ordem: novaOrdem }) =>
        db.bpmPipeline.update({
          where: { id: pipelineId },
          data: { ordem: novaOrdem },
        }),
      ),
    );

    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/admin`);
    return { success: true };
  } catch (error) {
    console.error("[ReordenarPipelinesBpm]", error);
    const msg =
      error instanceof Error && error.message.includes("administradores")
        ? error.message
        : "Erro ao reordenar pipelines";
    return { success: false, error: msg };
  }
}

export { isAdminRole };
