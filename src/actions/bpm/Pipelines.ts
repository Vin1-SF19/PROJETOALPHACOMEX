"use server";
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
  exigirAcessoBpmPipeline,
  exigirAcessoConfigPipeline,
  exigirAcessoModuloBpm,
  isAdminRole,
} from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

function projetarAutomacaoNoBoard(automacao: {
  id: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
  gatilhoTipo: string;
  etapaId: string;
  versoes: Array<{ gatilhoTipo: string; gatilhoConfigJson: string; condicaoJson: string | null; grafoJson: string }>;
}) {
  const versao = automacao.versoes[0] ?? null;
  let config: { escopo?: string; etapaId?: string; etapasIds?: string[]; recorrencia?: unknown } = {};
  let acoes: string[] = [];
  try {
    if (versao) {
      config = JSON.parse(versao.gatilhoConfigJson);
      const grafo = JSON.parse(versao.grafoJson) as { nos?: Array<{ tipo?: string; acaoTipo?: string }> };
      acoes = (grafo.nos ?? []).filter((no) => no.tipo === "ACAO" && no.acaoTipo).map((no) => no.acaoTipo!);
    }
  } catch {
    // Uma definição inválida continua visível para que possa ser corrigida na central.
  }
  const escopo: "GLOBAL_PIPELINE" | "ETAPAS" = config.escopo === "GLOBAL_PIPELINE" ? "GLOBAL_PIPELINE" : "ETAPAS";
  const etapasIds = escopo === "GLOBAL_PIPELINE"
    ? []
    : [...new Set([...(Array.isArray(config.etapasIds) ? config.etapasIds : []), config.etapaId, automacao.etapaId].filter((id): id is string => typeof id === "string"))];
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
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);
    await exigirAcessoModuloBpm(userId);

    const pipelines = await db.bpmPipeline.findMany({
      where: incluirInativos ? undefined : { ativo: true },
      select: {
        id: true,
        nome: true,
        ativo: true,
        ordem: true,
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

/**
 * `incluirInativas` traz também etapas desativadas e o cadastro de substatus — usado
 * pela tela admin (Fase 3) para permitir reativar etapas e gerir substatus. O board
 * (`incluirInativas=false`, padrão) continua vendo só etapas ativas, sem mudança de
 * comportamento.
 */
export async function ObterPipelineBpm(pipelineId: string, incluirInativas = false) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    await exigirAcessoBpmPipeline(pipelineId, Number(session.user.id));

    const pipeline = await db.bpmPipeline.findUnique({
      where: { id: pipelineId },
      include: {
        etapas: {
          where: incluirInativas ? undefined : { ativo: true },
          orderBy: { ordem: "asc" },
          include: {
            camposObrigatorios: { select: { campoId: true } },
            subStatus: { orderBy: { ordem: "asc" } },
          },
        },
        campos: {
          orderBy: { ordem: "asc" },
          include: {
            pipelinesAssociados: { select: { pipelineId: true } },
            etapaConfiguracoes: true,
            acessos: true,
            opcoes: { orderBy: { ordem: "asc" } },
            mapeamentoDestino: true,
          },
        },
        setores: { include: { setor: { select: { id: true, nome: true } } } },
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
      },
    });

    if (!pipeline) return { success: false, error: "Pipeline não encontrado" };
    const automacoes = pipeline.automacoes.map(projetarAutomacaoNoBoard);
    const { automacoes: _definicoes, ...dadosPipeline } = pipeline;
    void _definicoes;
    return {
      success: true,
      data: {
        ...dadosPipeline,
        automacoesGlobais: automacoes.filter((automacao) => automacao.escopo === "GLOBAL_PIPELINE"),
        etapas: pipeline.etapas.map((etapa) => ({
          ...etapa,
          automacoes: automacoes.filter((automacao) => automacao.etapasIds.includes(etapa.id)),
        })),
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

export async function AtivarDesativarPipelineBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoConfigPipeline(userId, "criarPipeline");

    const parsed = ativarDesativarPipelineSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { pipelineId, ativo } = parsed.data;

    const pipelineAnterior = await db.bpmPipeline.findUnique({ where: { id: pipelineId } });
    if (!pipelineAnterior) return { success: false, error: "Pipeline não encontrado" };

    const pipeline = await db.$transaction(async (tx) => {
      const atualizado = await tx.bpmPipeline.update({ where: { id: pipelineId }, data: { ativo } });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId,
          adminId: userId,
          campoAlterado: "pipeline_ativo",
          valorAnteriorJson: JSON.stringify({ ativo: pipelineAnterior.ativo }),
          valorNovoJson: JSON.stringify({ ativo }),
        },
      });
      return atualizado;
    });

    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/admin`);
    await notificarPipelineBpm({ pipelineId, tipo: "PIPELINE_ALTERADO" });
    return { success: true, data: pipeline };
  } catch (error) {
    console.error("[AtivarDesativarPipelineBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao ativar/desativar pipeline";
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
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { ordem } = parsed.data;

    await db.$transaction(
      ordem.map(({ pipelineId, ordem: novaOrdem }) =>
        db.bpmPipeline.update({ where: { id: pipelineId }, data: { ordem: novaOrdem } }),
      ),
    );

    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/admin`);
    return { success: true };
  } catch (error) {
    console.error("[ReordenarPipelinesBpm]", error);
    const msg = error instanceof Error && error.message.includes("administradores") ? error.message : "Erro ao reordenar pipelines";
    return { success: false, error: msg };
  }
}

export { isAdminRole };
