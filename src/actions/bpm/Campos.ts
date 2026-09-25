"use server";

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import {
  atualizarCampoSchema,
  configurarMapeamentoCampoSchema,
  criarCampoSchema,
  excluirCampoSchema,
} from "@/lib/validations/bpm";
import { exigirAcessoConfigPipeline } from "@/lib/bpm/ownership";
import { z } from "zod";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  chaveOpcaoCampo,
  fonteCampoPermitida,
  mapeamentoCriariaCiclo,
  type MapeamentoCampo,
} from "@/lib/bpm/campos-configuraveis";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";
import type { Prisma } from "@prisma/client";
import { avancarConfigVersionBpm } from "@/lib/bpm/config-version";
import { extrairPathnamePrivadoAnexoBpm } from "@/lib/bpm/anexos-storage";
import { ACAO_LIMPEZA_ANEXO_PENDENTE, limparBlobAnexoPendente } from "@/lib/bpm/anexos-lifecycle";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

type OpcaoEntrada = string | {
  id?: string;
  chave: string;
  rotulo: string;
  ordem: number;
  ativo?: boolean;
};

const PERFIS_CAMPO = ["ADMIN", "RESPONSAVEL", "MEMBRO"] as const;

const campoAdminInclude = {
  pipeline: { select: { id: true, nome: true } },
  opcoes: { orderBy: { ordem: "asc" as const } },
  pipelinesAssociados: {
    include: { pipeline: { select: { id: true, nome: true } } },
  },
  etapaConfiguracoes: {
    include: { etapa: { select: { id: true, nome: true, pipelineId: true } } },
    orderBy: { ordem: "asc" as const },
  },
  acessos: { orderBy: { perfil: "asc" as const } },
  mapeamentoDestino: true,
} satisfies Prisma.BpmCampoInclude;

function acessosPadrao({
  visivel,
  editavel,
  somenteLeitura,
  obrigatorio,
}: {
  visivel: boolean;
  editavel: boolean;
  somenteLeitura: boolean;
  obrigatorio: boolean;
}) {
  return PERFIS_CAMPO.map((perfil) => ({
    perfil,
    visivel,
    editavel: somenteLeitura ? false : editavel,
    somenteLeitura,
    obrigatorio,
  }));
}

function opcoesEstruturadas(opcoes: readonly OpcaoEntrada[] = []) {
  const usadas = new Set<string>();
  return opcoes.map((opcao, ordem) => {
    const rotulo = typeof opcao === "string" ? opcao.trim() : opcao.rotulo.trim();
    const raiz = typeof opcao === "string" ? chaveOpcaoCampo(rotulo) : opcao.chave;
    let chave = raiz;
    let sufixo = 2;
    while (usadas.has(chave)) chave = `${raiz}-${sufixo++}`;
    usadas.add(chave);
    return {
      id: typeof opcao === "string" ? undefined : opcao.id,
      chave,
      rotulo,
      ordem: typeof opcao === "string" ? ordem : opcao.ordem,
      ativo: typeof opcao === "string" ? true : (opcao.ativo ?? true),
    };
  });
}

function validarCatalogoSelecao(params: {
  tipo: string;
  opcoes: readonly { ativo: boolean }[];
  fonteEntidade: string | null | undefined;
  ativo: boolean;
  possuiOpcoesLegadas?: boolean;
}) {
  if (
    params.ativo
    && ["selecao", "multiselecao"].includes(params.tipo)
    && !params.fonteEntidade
    && !params.opcoes.some((opcao) => opcao.ativo)
    && !params.possuiOpcoesLegadas
  ) {
    throw new Error("CAMPO_SELECAO_SEM_OPCOES: Campo de seleção customizado precisa ter ao menos uma opção ativa");
  }
}

function possuiOpcoesJsonValidas(opcoesJson: string | null | undefined) {
  if (!opcoesJson) return false;
  try {
    const opcoes: unknown = JSON.parse(opcoesJson);
    return Array.isArray(opcoes) && opcoes.some((opcao) => typeof opcao === "string" && opcao.trim());
  } catch {
    return false;
  }
}

function mensagemErro(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  if (error.message.includes("administradores") || /^(?:CAMPO_|USO_CAMPO_ALTERADO:|CONFIRMACAO_DESCARTE_OBRIGATORIA:)/.test(error.message)) {
    return error.message.replace(/^[A-Z_]+:\s*/, "");
  }
  return fallback;
}

function validarCondicoesEtapas(
  configuracoes: readonly {
    condicaoVisibilidadeJson?: string | null;
    condicaoObrigatoriedadeJson?: string | null;
  }[] | undefined,
) {
  for (const config of configuracoes ?? []) {
    for (const [nome, bruto] of [
      ["visibilidade", config.condicaoVisibilidadeJson],
      ["obrigatoriedade", config.condicaoObrigatoriedadeJson],
    ] as const) {
      if (!bruto?.trim()) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(bruto);
      } catch {
        throw new Error(`CAMPO_CONDICAO_INVALIDA: Condição de ${nome} não contém JSON válido`);
      }
      if (!grupoCondicaoSchema.safeParse(parsed).success) {
        throw new Error(`CAMPO_CONDICAO_INVALIDA: Condição de ${nome} não segue o formato do Motor de Regras`);
      }
    }
  }
}

async function notificarPipelines(pipelineIds: readonly string[]) {
  for (const pipelineId of [...new Set(pipelineIds)]) {
    revalidatePath(`${ROTA_BASE}/admin/pipelines/${pipelineId}`);
    try {
      await notificarPipelineBpm({ pipelineId, tipo: "CAMPO_ALTERADO" });
    } catch (error) {
      console.error("[Campos:notificacao_pos_commit]", error);
    }
  }
}

async function validarDimensoesCampo(
  tx: typeof db,
  pipelineId: string,
  pipelineIds: readonly string[],
  etapaIds: readonly string[],
) {
  const idsPipeline = [...new Set([pipelineId, ...pipelineIds])];
  const [pipelines, etapas] = await Promise.all([
    tx.bpmPipeline.findMany({ where: { id: { in: idsPipeline } }, select: { id: true } }),
    etapaIds.length
      ? tx.bpmEtapa.findMany({ where: { id: { in: [...new Set(etapaIds)] } }, select: { id: true, pipelineId: true } })
      : Promise.resolve([]),
  ]);
  if (pipelines.length !== idsPipeline.length) throw new Error("CAMPO_PIPELINE_INVALIDO: Pipeline informado não existe");
  if (etapas.length !== new Set(etapaIds).size) throw new Error("CAMPO_ETAPA_INVALIDA: Etapa informada não existe");
  if (etapas.some((etapa) => !idsPipeline.includes(etapa.pipelineId))) {
    throw new Error("CAMPO_ETAPA_PIPELINE: Toda etapa deve pertencer a um pipeline selecionado");
  }
  return idsPipeline;
}

function pipelinesCompartilhados(pipelineProprietarioId: string, pipelineIds: readonly string[]) {
  return [...new Set(pipelineIds)].filter((pipelineId) => pipelineId !== pipelineProprietarioId);
}

export async function ListarCamposConfiguraveisBpm(pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    await exigirAcessoConfigPipeline(Number(session.user.id), "configurarCampos");

    const campos = await db.bpmCampo.findMany({
      where: {
        OR: [
          { pipelineId },
          { pipelinesAssociados: { some: { pipelineId } } },
        ],
      },
      include: {
        opcoes: { orderBy: { ordem: "asc" } },
        pipelinesAssociados: true,
        etapaConfiguracoes: true,
        acessos: true,
        mapeamentoDestino: true,
      },
      orderBy: [{ ativo: "desc" }, { ordem: "asc" }],
    });
    return { success: true, data: campos };
  } catch (error) {
    console.error("[ListarCamposConfiguraveisBpm]", error);
    return { success: false, error: mensagemErro(error, "Erro ao listar campos"), data: [] };
  }
}

/** Resumo de uso sem expor valores ou nomes de clientes ao editor administrativo. */
export async function ObterUsoCamposBpm(pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    if (!z.string().cuid().safeParse(pipelineId).success) {
      return { success: false as const, error: "Pipeline inválido" };
    }
    await exigirAcessoConfigPipeline(Number(session.user.id), "configurarCampos");
    const campos = await db.bpmCampo.findMany({
      where: {
        OR: [
          { pipelineId },
          { pipelinesAssociados: { some: { pipelineId } } },
        ],
      },
      select: {
        id: true,
        _count: {
          select: {
            valores: true,
            valoresGlobais: true,
            anexos: true,
            componentesFormulario: true,
            etapaConfiguracoes: true,
          },
        },
      },
    });
    return {
      success: true as const,
      data: Object.fromEntries(campos.map((campo) => [campo.id, {
        valoresCard: campo._count.valores,
        valoresGlobais: campo._count.valoresGlobais,
        anexos: campo._count.anexos,
        formularios: campo._count.componentesFormulario,
        etapas: campo._count.etapaConfiguracoes,
      }])),
    };
  } catch (error) {
    console.error("[ObterUsoCamposBpm]", error);
    return { success: false as const, error: mensagemErro(error, "Não foi possível analisar o uso dos campos") };
  }
}

export async function CriarCampoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCampos");

    const parsed = criarCampoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const entrada = parsed.data;
    validarCondicoesEtapas(entrada.etapaConfiguracoes);

    if (entrada.etapaConfiguracoes?.some((config) =>
      (config.obrigatorio || config.obrigatorioEntrada || config.obrigatorioSaida)
      && (!config.visivel || !config.editavel || config.somenteLeitura))) {
      return { success: false, error: "Campo obrigatório precisa estar visível e editável na etapa" };
    }
    if (entrada.escopo === "GLOBAL" && entrada.fonteEntidade && !fonteCampoPermitida(entrada.fonteEntidade, entrada.fonteAtributo)) {
      return { success: false, error: "Fonte ou atributo canônico não permitido" };
    }
    const opcoes = opcoesEstruturadas(entrada.opcoes);
    validarCatalogoSelecao({ tipo: entrada.tipo, opcoes, fonteEntidade: entrada.fonteEntidade, ativo: entrada.ativo });
    const etapaIds = (entrada.etapaConfiguracoes ?? []).map((item) => item.etapaId);

    const { campo, pipelineIds } = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarCampos", tx);
      const todosPipelines = await validarDimensoesCampo(tx as typeof db, entrada.pipelineId, entrada.pipelineIds ?? [], etapaIds);
      const criado = await tx.bpmCampo.create({
        data: {
          pipelineId: entrada.pipelineId,
          chave: entrada.chave,
          nome: entrada.nome,
          tipo: entrada.tipo,
          opcoesJson: opcoes.length ? JSON.stringify(opcoes.filter((item) => item.ativo).map((item) => item.rotulo)) : null,
          ordem: entrada.ordem,
          ativo: entrada.ativo,
          escopo: entrada.escopo,
          valorPadrao: entrada.valorPadrao,
          fonteEntidade: entrada.escopo === "GLOBAL" ? entrada.fonteEntidade : null,
          fonteAtributo: entrada.escopo === "GLOBAL" ? entrada.fonteAtributo : null,
          entidadeGlobal: entrada.escopo === "GLOBAL" && !entrada.fonteEntidade ? (entrada.entidadeGlobal ?? "CLIENTE") : null,
          visivel: entrada.visivel,
          editavel: entrada.somenteLeitura ? false : entrada.editavel,
          somenteLeitura: entrada.somenteLeitura,
        },
      });
      if (opcoes.length) await tx.bpmCampoOpcao.createMany({ data: opcoes.map((item) => ({
        campoId: criado.id,
        chave: item.chave,
        rotulo: item.rotulo,
        ordem: item.ordem,
        ativo: item.ativo,
      })) });
      const compartilhados = pipelinesCompartilhados(entrada.pipelineId, todosPipelines);
      if (compartilhados.length) {
        await tx.bpmCampoPipeline.createMany({
          data: compartilhados.map((pipelineId) => ({ campoId: criado.id, pipelineId })),
        });
      }
      if (entrada.etapaConfiguracoes?.length) {
        await tx.bpmCampoEtapaConfig.createMany({ data: entrada.etapaConfiguracoes.map((item) => ({ ...item, campoId: criado.id, editavel: item.somenteLeitura ? false : item.editavel })) });
      }
      const acessos = entrada.acessos?.length
        ? entrada.acessos
        : acessosPadrao({
            visivel: entrada.visivel,
            editavel: entrada.editavel,
            somenteLeitura: entrada.somenteLeitura,
            obrigatorio: false,
          });
      await tx.bpmCampoAcesso.createMany({ data: acessos.map((item) => ({ ...item, campoId: criado.id, editavel: item.somenteLeitura ? false : item.editavel })) });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: entrada.pipelineId,
          adminId: userId,
          campoAlterado: "campo_criado_v2",
          valorNovoJson: JSON.stringify({ campoId: criado.id, tipo: entrada.tipo, escopo: entrada.escopo, pipelineIds: todosPipelines }),
        },
      });
      for (const pipelineId of todosPipelines) {
        await avancarConfigVersionBpm(tx, pipelineId);
      }
      const agregado = await tx.bpmCampo.findUniqueOrThrow({
        where: { id: criado.id },
        include: campoAdminInclude,
      });
      return { campo: agregado, pipelineIds: todosPipelines };
    });

    await notificarPipelines(pipelineIds);
    return { success: true, data: campo };
  } catch (error) {
    console.error("[CriarCampoBpm]", error);
    return { success: false, error: mensagemErro(error, "Erro ao criar campo") };
  }
}

function valorUsaOpcao(valor: string | null, chaves: Set<string>) {
  if (!valor) return false;
  if (chaves.has(valor)) return true;
  try {
    const parsed: unknown = JSON.parse(valor);
    return Array.isArray(parsed) && parsed.some((item) => typeof item === "string" && chaves.has(item));
  } catch { return false; }
}

export async function AtualizarCampoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCampos");

    const parsed = atualizarCampoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const entrada = parsed.data;
    validarCondicoesEtapas(entrada.etapaConfiguracoes);
    if (entrada.etapaConfiguracoes?.some((config) =>
      (config.obrigatorio || config.obrigatorioEntrada || config.obrigatorioSaida)
      && (!config.visivel || !config.editavel || config.somenteLeitura))) {
      return { success: false, error: "Campo obrigatório precisa estar visível e editável na etapa" };
    }

    const anterior = await db.bpmCampo.findUnique({
      where: { id: entrada.campoId },
      include: {
        valores: { select: { valor: true } },
        valoresGlobais: { select: { valor: true } },
        _count: { select: { valoresGlobais: true, anexos: true } },
        opcoes: true,
        pipelinesAssociados: true,
        etapaConfiguracoes: true,
        acessos: true,
        mapeamentoDestino: true,
      },
    });
    if (!anterior) return { success: false, error: "Campo não encontrado" };
    const escopoFinal = entrada.escopo ?? anterior.escopo;
    const entidadeFinal = entrada.fonteEntidade === undefined ? anterior.fonteEntidade : entrada.fonteEntidade;
    const atributoFinal = entrada.fonteAtributo === undefined ? anterior.fonteAtributo : entrada.fonteAtributo;
    const entidadeGlobalFinal = entrada.entidadeGlobal === undefined ? anterior.entidadeGlobal : entrada.entidadeGlobal;
    if (escopoFinal === "GLOBAL" && entidadeFinal && !fonteCampoPermitida(entidadeFinal, atributoFinal)) {
      return { success: false, error: "Fonte ou atributo canônico não permitido" };
    }
    if (entrada.tipo && entrada.tipo !== anterior.tipo
      && (anterior.valores.length > 0 || anterior._count.valoresGlobais > 0 || anterior._count.anexos > 0)) {
      return { success: false, error: "Não é possível alterar o tipo de um campo com valores ou anexos" };
    }

    const novasOpcoes = entrada.opcoes === undefined ? undefined : opcoesEstruturadas(entrada.opcoes ?? []);
    if (novasOpcoes !== undefined) {
      const preservadas = new Set(novasOpcoes.flatMap((item) => [item.chave, item.rotulo]));
      const removidas = new Set(anterior.opcoes.filter((item) => !preservadas.has(item.chave)).flatMap((item) => [item.chave, item.rotulo]));
      if (removidas.size && [...anterior.valores, ...anterior.valoresGlobais].some((item) => valorUsaOpcao(item.valor, removidas))) {
        return { success: false, error: "Não é possível remover uma opção que já está em uso" };
      }
    }

    const tipoFinal = entrada.tipo ?? anterior.tipo;
    const fonteFinal = escopoFinal === "GLOBAL" ? entidadeFinal : null;
    const ativoFinal = entrada.ativo ?? anterior.ativo;
    const opcoesFinais = novasOpcoes ?? anterior.opcoes;
    validarCatalogoSelecao({
      tipo: tipoFinal,
      opcoes: opcoesFinais,
      fonteEntidade: fonteFinal,
      ativo: ativoFinal,
      possuiOpcoesLegadas: novasOpcoes === undefined && possuiOpcoesJsonValidas(anterior.opcoesJson),
    });

    const pipelineIdsEntrada = entrada.pipelineIds ?? anterior.pipelinesAssociados.map((item) => item.pipelineId);
    const etapaIds = (entrada.etapaConfiguracoes ?? anterior.etapaConfiguracoes).map((item) => item.etapaId);
    const resultado = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarCampos", tx);
      const todosPipelines = await validarDimensoesCampo(tx as typeof db, anterior.pipelineId, pipelineIdsEntrada, etapaIds);
      if (anterior.ativo && entrada.ativo === false) {
        const referenciasPublicadas = await tx.bpmFormularioComponente.count({
          where: { campoId: anterior.id, secao: { formulario: { ativo: true } } },
        });
        if (referenciasPublicadas > 0) {
          throw new Error("CAMPO_FORMULARIO_PUBLICADO: Retire o campo dos formulários publicados antes de desativá-lo");
        }
      }
      if (entrada.etapaConfiguracoes) {
        const novasConfigs = new Map(entrada.etapaConfiguracoes.map((config) => [config.etapaId, config]));
        for (const configAnterior of anterior.etapaConfiguracoes) {
          const nova = novasConfigs.get(configAnterior.etapaId);
          if (nova?.visivel) continue;
          const referenciasPublicadas = await tx.bpmFormularioComponente.count({
            where: {
              campoId: anterior.id,
              secao: { formulario: { etapaId: configAnterior.etapaId, ativo: true } },
            },
          });
          if (referenciasPublicadas > 0) {
            throw new Error("CAMPO_FORMULARIO_PUBLICADO: Retire o campo do formulário publicado antes de ocultá-lo nesta etapa");
          }
        }
      }
      const atualizado = await tx.bpmCampo.update({
        where: { id: entrada.campoId },
        data: {
          chave: entrada.chave,
          nome: entrada.nome,
          tipo: entrada.tipo,
          ordem: entrada.ordem,
          ativo: entrada.ativo,
          escopo: entrada.escopo,
          valorPadrao: entrada.valorPadrao,
          fonteEntidade: escopoFinal === "GLOBAL" ? entidadeFinal : null,
          fonteAtributo: escopoFinal === "GLOBAL" ? atributoFinal : null,
          entidadeGlobal: escopoFinal === "GLOBAL" && !entidadeFinal ? (entidadeGlobalFinal ?? "CLIENTE") : null,
          visivel: entrada.visivel,
          editavel: entrada.somenteLeitura ? false : entrada.editavel,
          somenteLeitura: entrada.somenteLeitura,
          opcoesJson: novasOpcoes === undefined ? undefined : (novasOpcoes.length ? JSON.stringify(novasOpcoes.filter((item) => item.ativo).map((item) => item.rotulo)) : null),
          configVersao: { increment: 1 },
        },
      });
      if (novasOpcoes !== undefined) {
        const chaves = novasOpcoes.map((item) => item.chave);
        await tx.bpmCampoOpcao.updateMany({ where: { campoId: entrada.campoId, chave: { notIn: chaves } }, data: { ativo: false } });
        for (const item of novasOpcoes) {
          await tx.bpmCampoOpcao.upsert({
            where: { campoId_chave: { campoId: entrada.campoId, chave: item.chave } },
            create: { campoId: entrada.campoId, chave: item.chave, rotulo: item.rotulo, ordem: item.ordem, ativo: item.ativo },
            update: { rotulo: item.rotulo, ordem: item.ordem, ativo: item.ativo },
          });
        }
      }
      if (entrada.pipelineIds) {
        await tx.bpmCampoPipeline.deleteMany({ where: { campoId: entrada.campoId } });
        const compartilhados = pipelinesCompartilhados(anterior.pipelineId, todosPipelines);
        if (compartilhados.length) {
          await tx.bpmCampoPipeline.createMany({
            data: compartilhados.map((pipelineId) => ({ campoId: entrada.campoId, pipelineId })),
          });
        }
      }
      if (entrada.etapaConfiguracoes) {
        await tx.bpmCampoEtapaConfig.deleteMany({ where: { campoId: entrada.campoId } });
        if (entrada.etapaConfiguracoes.length) await tx.bpmCampoEtapaConfig.createMany({ data: entrada.etapaConfiguracoes.map((item) => ({ ...item, campoId: entrada.campoId, editavel: item.somenteLeitura ? false : item.editavel })) });
      }
      if (entrada.acessos) {
        await tx.bpmCampoAcesso.deleteMany({ where: { campoId: entrada.campoId } });
        if (entrada.acessos.length) await tx.bpmCampoAcesso.createMany({ data: entrada.acessos.map((item) => ({ ...item, campoId: entrada.campoId, editavel: item.somenteLeitura ? false : item.editavel })) });
      }
      if (entrada.mapeamento !== undefined) {
        if (entrada.mapeamento === null) {
          await tx.bpmCampoMapeamento.updateMany({
            where: { campoDestinoId: entrada.campoId, ativo: true },
            data: { ativo: false },
          });
        } else {
          if (entrada.mapeamento.campoOrigemId === entrada.campoId) {
            throw new Error("CAMPO_MAPEAMENTO_CICLO: Um campo não pode mapear a si mesmo");
          }
          const origem = await tx.bpmCampo.findUnique({
            where: { id: entrada.mapeamento.campoOrigemId },
            select: { id: true, tipo: true },
          });
          if (!origem || origem.tipo !== tipoFinal) {
            throw new Error("CAMPO_MAPEAMENTO_TIPO: O mapeamento exige um campo de origem do mesmo tipo");
          }
          const existentes = await tx.bpmCampoMapeamento.findMany({
            select: { campoOrigemId: true, campoDestinoId: true, modo: true, ativo: true },
          });
          const candidato = {
            campoOrigemId: entrada.mapeamento.campoOrigemId,
            campoDestinoId: entrada.campoId,
            modo: entrada.mapeamento.modo,
            ativo: entrada.mapeamento.ativo,
          };
          if (mapeamentoCriariaCiclo(existentes as MapeamentoCampo[], candidato)) {
            throw new Error("CAMPO_MAPEAMENTO_CICLO: O mapeamento criaria um ciclo");
          }
          await tx.bpmCampoMapeamento.upsert({
            where: { campoDestinoId: entrada.campoId },
            create: candidato,
            update: {
              campoOrigemId: candidato.campoOrigemId,
              modo: candidato.modo,
              ativo: candidato.ativo,
            },
          });
        }
      }
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: anterior.pipelineId,
          adminId: userId,
          campoAlterado: "campo_atualizado_v2",
          valorAnteriorJson: JSON.stringify(anterior),
          valorNovoJson: JSON.stringify(entrada),
        },
      });
      for (const pipelineId of todosPipelines) {
        await avancarConfigVersionBpm(tx, pipelineId);
      }
      const agregado = await tx.bpmCampo.findUniqueOrThrow({
        where: { id: atualizado.id },
        include: campoAdminInclude,
      });
      return { atualizado: agregado, pipelineIds: todosPipelines };
    });

    await notificarPipelines(resultado.pipelineIds);
    return { success: true, data: resultado.atualizado };
  } catch (error) {
    console.error("[AtualizarCampoBpm]", error);
    return { success: false, error: mensagemErro(error, "Erro ao atualizar campo") };
  }
}

export async function ExcluirCampoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCampos");

    const parsed = excluirCampoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const resultado = await db.$transaction(async (tx) => {
      await exigirAcessoConfigPipeline(userId, "configurarCampos", tx);
      const campo = await tx.bpmCampo.findUnique({
        where: { id: parsed.data.campoId },
        select: {
          id: true,
          nome: true,
          pipelineId: true,
          pipelinesAssociados: { select: { pipelineId: true } },
        },
      });
      if (!campo) throw new Error("CAMPO_NAO_ENCONTRADO: Campo não encontrado");

      const [valoresCard, valoresGlobais, anexos, formularios, etapas] = await Promise.all([
        tx.bpmCardCampoValor.count({ where: { campoId: campo.id } }),
        tx.bpmCampoValorGlobal.count({ where: { campoId: campo.id } }),
        tx.bpmCardAnexo.findMany({ where: { campoId: campo.id }, select: { id: true, cardId: true, nome: true, url: true } }),
        tx.bpmFormularioComponente.count({ where: { campoId: campo.id } }),
        tx.bpmCampoEtapaConfig.count({ where: { campoId: campo.id } }),
      ]);
      const usoAtual = { valoresCard, valoresGlobais, anexos: anexos.length, formularios, etapas };
      const usoConfirmado = parsed.data.usoConfirmado;
      if (usoConfirmado && Object.keys(usoAtual).some((chave) =>
        usoAtual[chave as keyof typeof usoAtual] !== usoConfirmado[chave as keyof typeof usoAtual]
      )) {
        throw new Error("USO_CAMPO_ALTERADO: O uso do campo mudou. Atualize a análise e confirme novamente");
      }
      if (Object.values(usoAtual).some((quantidade) => quantidade > 0) &&
        (!parsed.data.confirmarDescarteDados || !usoConfirmado)) {
        throw new Error("CONFIRMACAO_DESCARTE_OBRIGATORIA: Confirme a exclusão dos dados relacionados");
      }

      const afetados = [
        campo.pipelineId,
        ...campo.pipelinesAssociados.map((item) => item.pipelineId),
      ];
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: campo.pipelineId,
          adminId: userId,
          campoAlterado: "campo_excluido",
          valorAnteriorJson: JSON.stringify({ id: campo.id, nome: campo.nome, uso: usoAtual }),
        },
      });
      // O FK de anexos usa SetNull; removê-los explicitamente evita que o
      // conteúdo do campo excluído continue acessível como anexo sem campo.
      await tx.bpmCardAnexo.deleteMany({ where: { campoId: campo.id } });
      const limpezaPendenteIds: string[] = [];
      for (const anexo of anexos) {
        await tx.bpmCardHistorico.create({
          data: {
            cardId: anexo.cardId,
            acao: "ANEXO_EXCLUIDO",
            usuarioId: userId,
            valorAnteriorJson: JSON.stringify({ nome: anexo.nome, campoId: campo.id }),
          },
        });
        if (extrairPathnamePrivadoAnexoBpm(anexo.url)) {
          const pendente = await tx.bpmCardHistorico.create({
            data: {
              cardId: anexo.cardId,
              acao: ACAO_LIMPEZA_ANEXO_PENDENTE,
              usuarioId: userId,
              valorAnteriorJson: anexo.url,
            },
            select: { id: true },
          });
          limpezaPendenteIds.push(pendente.id);
        }
      }
      await tx.bpmCampoMapeamento.deleteMany({
        where: { OR: [{ campoOrigemId: campo.id }, { campoDestinoId: campo.id }] },
      });
      await tx.bpmCampo.delete({ where: { id: campo.id } });
      for (const pipelineId of afetados) await avancarConfigVersionBpm(tx, pipelineId);
      return { pipelineIds: afetados, limpezaPendenteIds };
    });

    for (const pendenteId of resultado.limpezaPendenteIds) {
      try {
        await limparBlobAnexoPendente(pendenteId);
      } catch (error) {
        // O metadado já foi removido; o cron repete a limpeza pendente.
        console.error("[ExcluirCampoBpm] Blob pendente de reconciliação", { pendenteId, error });
      }
    }
    await notificarPipelines(resultado.pipelineIds);
    return { success: true };
  } catch (error) {
    console.error("[ExcluirCampoBpm]", error);
    return { success: false, error: mensagemErro(error, "Erro ao excluir campo") };
  }
}

export async function AtivarDesativarCampoBpm(dados: unknown) {
  const entrada = dados as { campoId?: unknown; ativo?: unknown };
  const campo = excluirCampoSchema.safeParse({ campoId: entrada.campoId });
  if (!campo.success || typeof entrada.ativo !== "boolean") return { success: false, error: "Dados inválidos" };
  return AtualizarCampoBpm({ campoId: campo.data.campoId, ativo: entrada.ativo });
}

export async function ConfigurarMapeamentoCampoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCampos");
    const parsed = configurarMapeamentoCampoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const entrada = parsed.data;

    const [origem, destino, existentes] = await Promise.all([
      db.bpmCampo.findUnique({ where: { id: entrada.campoOrigemId }, select: { id: true, pipelineId: true, tipo: true } }),
      db.bpmCampo.findUnique({ where: { id: entrada.campoDestinoId }, select: { id: true, pipelineId: true, tipo: true } }),
      db.bpmCampoMapeamento.findMany({ select: { campoOrigemId: true, campoDestinoId: true, modo: true, ativo: true } }),
    ]);
    if (!origem || !destino) return { success: false, error: "Campo de origem ou destino não encontrado" };
    if (origem.tipo !== destino.tipo) return { success: false, error: "Mapeamento exige campos do mesmo tipo" };
    if (mapeamentoCriariaCiclo(existentes as MapeamentoCampo[], entrada)) return { success: false, error: "O mapeamento criaria um ciclo" };

    const mapeamento = await db.$transaction(async (tx) => {
      const existentesAtuais = await tx.bpmCampoMapeamento.findMany({
        select: { campoOrigemId: true, campoDestinoId: true, modo: true, ativo: true },
      });
      if (mapeamentoCriariaCiclo(existentesAtuais as MapeamentoCampo[], entrada)) {
        throw new Error("CAMPO_MAPEAMENTO_CICLO: O mapeamento criaria um ciclo");
      }
      const salvo = await tx.bpmCampoMapeamento.upsert({
        where: { campoDestinoId: entrada.campoDestinoId },
        create: entrada,
        update: { campoOrigemId: entrada.campoOrigemId, modo: entrada.modo, ativo: entrada.ativo },
      });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: destino.pipelineId,
          adminId: userId,
          campoAlterado: "campo_mapeamento",
          valorNovoJson: JSON.stringify(entrada),
        },
      });
      await avancarConfigVersionBpm(tx, destino.pipelineId);
      if (origem.pipelineId !== destino.pipelineId) {
        await avancarConfigVersionBpm(tx, origem.pipelineId);
      }
      return salvo;
    });
    await notificarPipelines([origem.pipelineId, destino.pipelineId]);
    return { success: true, data: mapeamento };
  } catch (error) {
    console.error("[ConfigurarMapeamentoCampoBpm]", error);
    return { success: false, error: mensagemErro(error, "Erro ao configurar mapeamento") };
  }
}

export async function DesativarMapeamentoCampoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoConfigPipeline(userId, "configurarCampos");
    const entrada = dados as { campoDestinoId?: unknown };
    const parsed = excluirCampoSchema.safeParse({ campoId: entrada.campoDestinoId });
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const existente = await db.bpmCampoMapeamento.findUnique({
      where: { campoDestinoId: parsed.data.campoId },
      include: {
        campoOrigem: { select: { pipelineId: true } },
        campoDestino: { select: { pipelineId: true } },
      },
    });
    if (!existente || !existente.ativo) return { success: true };

    await db.$transaction(async (tx) => {
      await tx.bpmCampoMapeamento.update({
        where: { campoDestinoId: parsed.data.campoId },
        data: { ativo: false },
      });
      await tx.bpmPipelineConfigAuditoria.create({
        data: {
          pipelineId: existente.campoDestino.pipelineId,
          adminId: userId,
          campoAlterado: "campo_mapeamento_desativado",
          valorAnteriorJson: JSON.stringify(existente),
          valorNovoJson: JSON.stringify({ campoDestinoId: parsed.data.campoId, ativo: false }),
        },
      });
      await avancarConfigVersionBpm(tx, existente.campoDestino.pipelineId);
      if (existente.campoOrigem.pipelineId !== existente.campoDestino.pipelineId) {
        await avancarConfigVersionBpm(tx, existente.campoOrigem.pipelineId);
      }
    });
    await notificarPipelines([existente.campoOrigem.pipelineId, existente.campoDestino.pipelineId]);
    return { success: true };
  } catch (error) {
    console.error("[DesativarMapeamentoCampoBpm]", error);
    return { success: false, error: mensagemErro(error, "Erro ao desativar mapeamento") };
  }
}
