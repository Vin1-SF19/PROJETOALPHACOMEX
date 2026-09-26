import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import db from "@/lib/prisma";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";
import { requisitoAplicaAoMover } from "@/lib/bpm/requisitos-etapa";
import { registrarConclusaoContratoFinanceiro } from "@/lib/bpm/financeiro-assinatura-server";
import { camposPublicadosPorEtapa, capacidadesObrigatoriasPorEtapa } from "@/lib/bpm/campos-formulario-publicado";
import {
  carregarValoresCanonicosCampos,
  salvarValoresGlobaisPersonalizadosCampos,
} from "@/lib/bpm/campos-configuraveis-server";
import { obterErroChecklistParaMovimento } from "@/lib/bpm/checklists/integracao";
import { obterErroRegrasParaMovimento } from "@/lib/bpm/regras/guarda-movimento";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import { montarContextoAvaliacaoDoCard } from "@/lib/bpm/regras/contexto";
import {
  BPM_PIPELINE_KEYS,
  BPM_CAPABILITIES,
  transitionOriginForRequester,
  type BpmTransitionRequester,
} from "@/lib/bpm/ontology";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { enfileirarAutomacoesMovimentoBpm } from "@/lib/bpm/automacoes/fila";
import { sincronizarSlaMovimentoBpm } from "@/lib/bpm/sla";
import { ativarCadenciasNaEntradaBpm } from "@/lib/bpm/cadencias/ativacao-automatica";
import { processarCadenciasImediatasDoCardBpm } from "@/lib/bpm/cadencias/executor";

export type AtorTransicaoBpm = {
  tipo: BpmTransitionRequester;
  userId?: number;
  userRole?: string | null;
  automacaoId?: string;
  automacaoExecucaoId?: string;
};

export type ComandoTransicaoBpm = {
  cardId: string;
  etapaOrigemEsperadaId: string;
  etapaDestinoId: string;
  versaoEsperada?: number;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string;
  ator: AtorTransicaoBpm;
  camposValores?: Record<string, string>;
  proximoContatoEm?: Date | null;
};

export type ResultadoTransicaoBpm =
  | {
      success: true;
      data: {
        cardId: string;
        transicaoId: string;
        etapaOrigemId: string;
        etapaDestinoId: string;
        versao: number;
        lifecycle: string;
        outcome: string | null;
        historicoId: string;
        eventoId: string;
        idempotente: boolean;
      };
    }
  | { success: false; error: string; code: string; pendencias?: string[] };

type Tx = Prisma.TransactionClient;

class TransicaoBpmError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly pendencias?: string[],
  ) {
    super(message);
    this.name = "TransicaoBpmError";
  }
}

function erro(code: string, message: string, pendencias?: string[]): never {
  throw new TransicaoBpmError(code, message, pendencias);
}

function origemCompativel(origem: string, solicitante: BpmTransitionRequester): boolean {
  const canonica = transitionOriginForRequester(solicitante);
  return origem === "AMBOS" || origem === canonica;
}

function vazio(valor: string | null | undefined): boolean {
  return !valor?.trim();
}

function mensagemErroDesconhecido(errorValue: unknown): ResultadoTransicaoBpm {
  if (errorValue instanceof TransicaoBpmError) {
    return { success: false, code: errorValue.code, error: errorValue.message, pendencias: errorValue.pendencias };
  }
  console.error("[TransitionCommand]", errorValue);
  return { success: false, code: "TRANSITION_FAILED", error: "Não foi possível concluir a transição." };
}

async function validarAutorizacao(
  input: ComandoTransicaoBpm,
  card: { id: string },
  destino: { chave: string | null; nome: string; visibilidades: Array<{ perfil: string; podeVer: boolean; podeAgir: boolean }> },
  tx: Tx,
): Promise<string | null> {
  if (input.ator.tipo !== "MANUAL") return null;
  if (!input.ator.userId) erro("UNAUTHORIZED", "Não autorizado");
  const acesso = await exigirAcessoBpmCard(card.id, input.ator.userId, input.ator.userRole ?? null, "moverEtapa", tx);
  if (!resolverVisibilidadeEtapa(acesso.perfilGlobal, destino.visibilidades).podeAgir) {
    erro("UNAUTHORIZED_DESTINATION", `Seu perfil não pode agir na etapa "${destino.nome}".`);
  }
  if (acesso.isAdminGlobal || acesso.role === "ADMINISTRADOR") return "ADMIN";
  return acesso.role === "RESPONSAVEL" ? "RESPONSAVEL" : "MEMBRO";
}

async function prepararTransicao(input: ComandoTransicaoBpm, tx: Tx) {
  const idempotente = await tx.bpmTransicaoExecucao.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { card: { include: { estadoOntologico: true } } },
  });
  if (idempotente) {
    return {
      idempotente: true as const,
      execucao: idempotente,
      lifecycle: idempotente.card.status,
      outcome: idempotente.card.estadoOntologico?.outcome ?? null,
    };
  }

  const card = await tx.bpmCard.findUnique({
    where: { id: input.cardId },
    include: {
      pipeline: { select: { id: true, chave: true, nome: true } },
      etapa: { select: { id: true, chave: true, nome: true, ordem: true, capabilitiesJson: true } },
      estadoOntologico: { include: { subStatus: { select: { id: true, etapaId: true, chave: true } } } },
      servicoContexto: true,
      campoValores: { select: { campoId: true, valor: true } },
      anexos: { select: { nome: true } },
      indicacaoOrigem: { select: { parceiroId: true } },
      vinculosDestino: { select: { cardOrigem: { select: { indicacaoOrigem: { select: { parceiroId: true } } } } } },
    },
  });
  if (!card) erro("CARD_NOT_FOUND", "Card não encontrado.");
  if (card.etapaId !== input.etapaOrigemEsperadaId) {
    erro("STALE_STAGE", "O card mudou de etapa. Recarregue e tente novamente.");
  }
  if (input.versaoEsperada !== undefined && card.versao !== input.versaoEsperada) {
    erro("STALE_VERSION", "O card foi alterado por outra operação. Recarregue e tente novamente.");
  }
  if (card.etapaId === input.etapaDestinoId) erro("SAME_STAGE", "O card já está nesta etapa.");

  const [destino, transicao] = await Promise.all([
    tx.bpmEtapa.findFirst({
      where: { id: input.etapaDestinoId, pipelineId: card.pipelineId, ativo: true },
      include: { visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } } },
    }),
    tx.bpmTransicaoEtapa.findUnique({
      where: { etapaOrigemId_etapaDestinoId: { etapaOrigemId: card.etapaId, etapaDestinoId: input.etapaDestinoId } },
    }),
  ]);
  if (!destino) erro("INVALID_DESTINATION", "Etapa de destino inválida para este pipeline.");
  if (!transicao) erro("TRANSITION_NOT_DEFINED", "Esta transição não está definida no pipeline.");
  if (!transicao.permitida) erro("TRANSITION_DISABLED", "Esta transição foi desativada pelo administrador.");
  if (!origemCompativel(transicao.origem, input.ator.tipo)) {
    erro("REQUESTER_NOT_ALLOWED", "O solicitante não é permitido nesta transição.");
  }

  const perfilCampo = await validarAutorizacao(input, card, destino, tx);
  const valoresSubmetidos = input.camposValores ?? {};
  const campoIdsSubmetidos = Object.keys(valoresSubmetidos);
  const componentes = campoIdsSubmetidos.length
    ? await tx.bpmFormularioComponente.findMany({
        where: {
          campoId: { in: campoIdsSubmetidos },
          secao: { formulario: { etapaId: { in: [card.etapaId, destino.id] }, ativo: true } },
        },
        select: { campoId: true },
      })
    : [];
  const camposNoFormulario = new Set(componentes.flatMap((item) => item.campoId ? [item.campoId] : []));
  if (campoIdsSubmetidos.some((id) => !camposNoFormulario.has(id))) {
    erro("FIELD_OUTSIDE_FORM", "Um ou mais campos não pertencem ao formulário desta transição.");
  }

  const requisitos = await tx.bpmRequisito.findMany({
    where: {
      pipelineId: card.pipelineId,
      ativo: true,
      OR: [
        { transicaoId: transicao.id },
        { etapaId: null },
        { etapaId: { in: [card.etapaId, destino.id] } },
      ],
    },
    include: {
      campo: {
        include: {
          opcoes: { where: { ativo: true }, orderBy: { ordem: "asc" } },
          etapaConfiguracoes: { where: { etapaId: { in: [card.etapaId, destino.id] } } },
          acessos: perfilCampo ? { where: { perfil: perfilCampo } } : false,
        },
      },
    },
    orderBy: [{ ordem: "asc" }, { chave: "asc" }],
  });
  const camposFormulario = await camposPublicadosPorEtapa([card.etapaId, destino.id], tx);
  const camposPublicadosDoPipeline = requisitos.some((item) => item.campoId)
    ? await (async () => {
        const etapas = await tx.bpmEtapa.findMany({ where: { pipelineId: card.pipelineId, ativo: true }, select: { id: true } });
        const publicados = await camposPublicadosPorEtapa(etapas.map((etapa) => etapa.id), tx);
        return new Set([...publicados.values()].flatMap((ids) => [...ids]));
      })()
    : null;
  const requisitosAplicaveis = requisitos.filter((item) =>
    requisitoAplicaAoMover(item, transicao.id, card.etapaId, destino.id)
    && (!item.campoId || Boolean(item.campo?.ativo
      && camposPublicadosDoPipeline?.has(item.campoId))),
  );
  const camposRequisito = await tx.bpmCampo.findMany({
    where: {
      ativo: true,
      AND: [
        { OR: [
          { pipelineId: card.pipelineId },
          { pipelinesAssociados: { some: { pipelineId: card.pipelineId } } },
        ] },
        { OR: [
          { id: { in: requisitosAplicaveis.flatMap((item) => item.campoId ? [item.campoId] : []) } },
          { etapaConfiguracoes: { some: {
          etapaId: { in: [card.etapaId, destino.id] },
          visivel: true,
          OR: [
            { obrigatorio: true },
            { obrigatorioEntrada: true },
            { obrigatorioSaida: true },
            { condicaoObrigatoriedadeJson: { not: null } },
          ],
          } } },
        ] },
      ],
    },
    include: {
      opcoes: { where: { ativo: true }, orderBy: { ordem: "asc" } },
      etapaConfiguracoes: { where: { etapaId: { in: [card.etapaId, destino.id] } } },
      acessos: perfilCampo ? { where: { perfil: perfilCampo } } : false,
    },
  });
  const capacidadesObrigatorias = await capacidadesObrigatoriasPorEtapa([card.etapaId, destino.id], tx);
  const exige = (etapaId: string, capability: string) => capacidadesObrigatorias.get(etapaId)?.has(capability) === true;
  const camposSubmetidos = campoIdsSubmetidos.length
    ? await tx.bpmCampo.findMany({
        where: {
          id: { in: campoIdsSubmetidos },
          ativo: true,
          OR: [
            { pipelineId: card.pipelineId },
            { pipelinesAssociados: { some: { pipelineId: card.pipelineId } } },
          ],
          etapaConfiguracoes: { some: { etapaId: { in: [card.etapaId, destino.id] } } },
        },
        include: {
          opcoes: { where: { ativo: true }, orderBy: { ordem: "asc" } },
          etapaConfiguracoes: { where: { etapaId: { in: [card.etapaId, destino.id] } } },
          acessos: perfilCampo ? { where: { perfil: perfilCampo } } : false,
        },
      })
    : [];
  if (camposSubmetidos.length !== campoIdsSubmetidos.length) {
    erro("FIELD_OUTSIDE_STAGE_CONFIG", "Um ou mais campos não possuem configuração canônica para esta transição.");
  }
  const camposPorId = new Map([...camposRequisito, ...camposSubmetidos].map((campo) => [campo.id, campo]));
  // Condições podem consultar campos de etapas anteriores. Incluímos apenas
  // identidades ativas que pertencem a algum formulário publicado do pipeline;
  // a presença aqui não torna o campo obrigatório.
  const camposPublicados = await tx.bpmCampo.findMany({
      where: {
        ativo: true,
        OR: [{ pipelineId: card.pipelineId }, { pipelinesAssociados: { some: { pipelineId: card.pipelineId } } }],
        componentesFormulario: { some: { secao: { formulario: { ativo: true, etapa: { pipelineId: card.pipelineId } } } } },
      },
      include: {
        opcoes: { where: { ativo: true }, orderBy: { ordem: "asc" } },
        etapaConfiguracoes: { where: { etapaId: { in: [card.etapaId, destino.id] } } },
        acessos: perfilCampo ? { where: { perfil: perfilCampo } } : false,
      },
  });
  for (const campo of camposPublicados) camposPorId.set(campo.id, campo);
  for (const campo of camposSubmetidos) {
    const config = campo.etapaConfiguracoes.find((item) => item.etapaId === destino.id)
      ?? campo.etapaConfiguracoes.find((item) => item.etapaId === card.etapaId);
    const acesso = campo.acessos[0];
    const bloqueadoPorPolicy = campo.editavel === false || campo.somenteLeitura
      || config?.editavel === false || config?.somenteLeitura
      || (input.ator.tipo === "MANUAL" && (acesso?.visivel === false || acesso?.editavel === false || acesso?.somenteLeitura));
    if (bloqueadoPorPolicy) {
      erro("FIELD_READONLY", `O campo "${campo.nome}" é somente leitura.`);
    }
  }

  const formataveis = [...camposPorId.values()].map((campo) => ({
    id: campo.id,
    nome: campo.nome,
    chave: campo.chave,
    tipo: campo.tipo,
    opcoesJson: campo.opcoes.length ? JSON.stringify(campo.opcoes.map((opcao) => opcao.rotulo)) : campo.opcoesJson,
    escopo: campo.escopo,
    fonteEntidade: campo.fonteEntidade,
    editavel: true,
    somenteLeitura: false,
  }));
  const formato = validarValoresCamposBpm(formataveis, valoresSubmetidos);
  if (!formato.success) erro("FORMAT_INVALID", formato.error);

  const idsValores = [...camposPorId.keys()];
  const [persistidos, canonicos] = await Promise.all([
    idsValores.length
      ? tx.bpmCardCampoValor.findMany({ where: { cardId: card.id, campoId: { in: idsValores } }, select: { campoId: true, valor: true } })
      : [],
    carregarValoresCanonicosCampos(card.id, [...camposPorId.values()].map((campo) => ({
      id: campo.id,
      escopo: campo.escopo,
      fonteEntidade: campo.fonteEntidade,
      fonteAtributo: campo.fonteAtributo,
      entidadeGlobal: campo.entidadeGlobal,
    })), tx),
  ]);
  const valoresEfetivosPorId = new Map<string, string | null>(persistidos.map((item) => [item.campoId, item.valor]));
  for (const [campoId, value] of Object.entries(canonicos)) {
    const campo = camposPorId.get(campoId);
    const possuiOverride = campo?.fonteEntidade && !campo.somenteLeitura
      && campo.editavel !== false && valoresEfetivosPorId.get(campoId)?.trim();
    if (!possuiOverride) valoresEfetivosPorId.set(campoId, value);
  }
  for (const [campoId, value] of Object.entries(formato.valores)) {
    const campo = camposPorId.get(campoId);
    valoresEfetivosPorId.set(campoId, !value.trim() && campo?.escopo === "GLOBAL" && campo.fonteEntidade
      ? (canonicos[campoId] || null)
      : value);
  }
  const referenciasArquivo = [...camposPorId.values()].flatMap((campo) => {
    const valor = valoresEfetivosPorId.get(campo.id)?.trim();
    return campo.tipo === "url_ou_arquivo" && valor && !valor.startsWith("https://")
      ? [{ campoId: campo.id, id: valor }] : [];
  });
  if (referenciasArquivo.length) {
    const anexosValidos = await tx.bpmCardAnexo.findMany({
      where: { cardId: card.id, OR: referenciasArquivo },
      select: { id: true, campoId: true },
    });
    if (referenciasArquivo.some((referencia) => !anexosValidos.some((anexo) =>
      anexo.id === referencia.id && anexo.campoId === referencia.campoId))) {
      erro("INVALID_ATTACHMENT_REFERENCE", "Arquivo não vinculado ao campo deste card.");
    }
  }

  const contextoRegra = await montarContextoAvaliacaoDoCard(card, tx);
  contextoRegra.camposDinamicos = {
    ...Object.fromEntries([...camposPorId.keys()].map((campoId) => [campoId, null])),
    ...(contextoRegra.camposDinamicos ?? {}),
    ...Object.fromEntries(valoresEfetivosPorId),
  };
  const pendencias: string[] = [];
  for (const requisito of requisitosAplicaveis) {
    if (requisito.condicaoJson) {
      let condicao: unknown;
      try { condicao = JSON.parse(requisito.condicaoJson); } catch { erro("INVALID_REQUIREMENT", `Requisito inválido: ${requisito.chave}.`); }
      const validada = grupoCondicaoSchema.safeParse(condicao);
      if (!validada.success) erro("INVALID_REQUIREMENT", `Requisito inválido: ${requisito.chave}.`);
      if (!avaliarGrupo(validada.data, contextoRegra)) continue;
    }
    if (requisito.alvoTipo === "CAMPO" && requisito.campoId) {
      const valor = valoresEfetivosPorId.get(requisito.campoId);
      if (vazio(valor)) {
        pendencias.push(requisito.campo?.nome ?? requisito.alvoChave ?? requisito.mensagem);
      } else {
        const campo = camposPorId.get(requisito.campoId);
        if (campo && !validarValoresCamposBpm([{
          id: campo.id, nome: campo.nome, tipo: campo.tipo, opcoesJson: campo.opcoesJson,
          escopo: campo.escopo, fonteEntidade: campo.fonteEntidade, editavel: true, somenteLeitura: false,
        }], { [campo.id]: valor ?? "" }).success) {
          pendencias.push(requisito.campo?.nome ?? campo.nome);
        }
      }
    }
    if (requisito.alvoTipo === "REGRA") {
      if (!requisito.condicaoJson) erro("INVALID_REQUIREMENT", `Requisito inválido: ${requisito.chave}.`);
      pendencias.push(requisito.mensagem);
    }
  }
  for (const campo of camposRequisito) {
    for (const config of campo.etapaConfiguracoes) {
      if (!camposFormulario.get(config.etapaId)?.has(campo.id)) continue;
      const aplicaNaOrigem = config.etapaId === card.etapaId
        && (config.obrigatorio || config.obrigatorioSaida || Boolean(config.condicaoObrigatoriedadeJson));
      // Um campo obrigatório da etapa de destino é cobrado ao sair dela.
      // Para cobrá-lo já na entrada, o administrador usa obrigatorioEntrada.
      const aplicaNoDestino = config.etapaId === destino.id && config.obrigatorioEntrada;
      if (!config.visivel || (!aplicaNaOrigem && !aplicaNoDestino)) continue;
      if (config.condicaoVisibilidadeJson) {
        let parsed: unknown;
        try { parsed = JSON.parse(config.condicaoVisibilidadeJson); } catch { erro("INVALID_FIELD_CONFIG", `Configuração inválida do campo ${campo.nome}.`); }
        const validada = grupoCondicaoSchema.safeParse(parsed);
        if (!validada.success || !avaliarGrupo(validada.data, contextoRegra)) continue;
      }
      let obrigatorio = config.etapaId === card.etapaId
        ? config.obrigatorio || config.obrigatorioSaida
        : config.obrigatorioEntrada;
      if (config.condicaoObrigatoriedadeJson) {
        let parsed: unknown;
        try { parsed = JSON.parse(config.condicaoObrigatoriedadeJson); } catch { erro("INVALID_FIELD_CONFIG", `Configuração inválida do campo ${campo.nome}.`); }
        const validada = grupoCondicaoSchema.safeParse(parsed);
        if (!validada.success) erro("INVALID_FIELD_CONFIG", `Configuração inválida do campo ${campo.nome}.`);
        obrigatorio = obrigatorio || avaliarGrupo(validada.data, contextoRegra);
      }
      if (obrigatorio && vazio(valoresEfetivosPorId.get(campo.id))) pendencias.push(campo.nome);
    }
  }

  const proximoContato = input.proximoContatoEm === undefined ? card.proximoContatoEm : input.proximoContatoEm;
  if (pendencias.length) {
    const unicas = [...new Set(pendencias)];
    erro("REQUIREMENTS_PENDING", `Campos/requisitos obrigatórios pendentes (${unicas.join(", ")}).`, unicas);
  }

  const erroRegra = await obterErroRegrasParaMovimento({
    card, etapaDestinoId: destino.id, client: tx,
    valoresEfetivosPorId: Object.fromEntries(valoresEfetivosPorId),
  });
  if (erroRegra) erro("BUSINESS_RULE_BLOCKED", erroRegra);
  if (exige(card.etapaId, BPM_CAPABILITIES.STAGE_CHECKLIST)) {
    const erroChecklist = await obterErroChecklistParaMovimento({
      id: card.id,
      pipelineId: card.pipelineId,
      etapaId: card.etapaId,
    }, tx);
    if (erroChecklist) erro("CHECKLIST_BLOCKED", erroChecklist);
  }

  return {
    idempotente: false as const,
    card,
    destino,
    transicao,
    valoresValidados: formato.valores,
    proximoContato,
  };
}

export async function avaliarTransicaoBpm(input: ComandoTransicaoBpm): Promise<ResultadoTransicaoBpm> {
  try {
    const result = await db.$transaction((tx) => prepararTransicao(input, tx), { maxWait: 10_000, timeout: 60_000 });
    if (result.idempotente) {
      return { success: true, data: {
        cardId: result.execucao.cardId,
        transicaoId: result.execucao.transicaoId,
        etapaOrigemId: result.execucao.etapaOrigemId,
        etapaDestinoId: result.execucao.etapaDestinoId,
        versao: result.execucao.versaoResultante,
        lifecycle: result.lifecycle,
        outcome: result.outcome,
        historicoId: "",
        eventoId: "",
        idempotente: true,
      } };
    }
    return { success: true, data: {
      cardId: result.card.id,
      transicaoId: result.transicao.id,
      etapaOrigemId: result.card.etapaId,
      etapaDestinoId: result.destino.id,
      versao: result.card.versao,
      lifecycle: result.card.status,
      outcome: result.card.estadoOntologico?.outcome ?? null,
      historicoId: "",
      eventoId: "",
      idempotente: false,
    } };
  } catch (errorValue) {
    return mensagemErroDesconhecido(errorValue);
  }
}

export async function executarTransicaoBpm(input: ComandoTransicaoBpm): Promise<ResultadoTransicaoBpm> {
  const correlationId = input.correlationId ?? randomUUID();
  try {
    const result = await db.$transaction(async (tx) => {
      const prepared = await prepararTransicao(input, tx);
      if (prepared.idempotente) {
        return {
          cardId: prepared.execucao.cardId,
          transicaoId: prepared.execucao.transicaoId,
          etapaOrigemId: prepared.execucao.etapaOrigemId,
          etapaDestinoId: prepared.execucao.etapaDestinoId,
          versao: prepared.execucao.versaoResultante,
          lifecycle: prepared.lifecycle,
          outcome: prepared.outcome,
          historicoId: "",
          eventoId: "",
          idempotente: true,
          pipelineId: prepared.execucao.card.pipelineId,
        };
      }
      const { card, destino, transicao } = prepared;
      const agora = new Date();
      const lifecycle = transicao.lifecycleDestino ?? card.status;
      const concluidoEm = lifecycle === "CONCLUIDO" ? (card.concluidoEm ?? agora) : null;
      const outcome = lifecycle === "ATIVO" ? null : (transicao.outcomeDestino ?? card.estadoOntologico?.outcome ?? null);

      const valores = prepared.valoresValidados;
      const idsGlobais = await salvarValoresGlobaisPersonalizadosCampos(card.id, valores, tx);
      for (const [campoId, valor] of Object.entries(valores)) {
        if (idsGlobais.has(campoId)) continue;
        await tx.bpmCardCampoValor.upsert({
          where: { cardId_campoId: { cardId: card.id, campoId } },
          create: { cardId: card.id, campoId, valor },
          update: { valor },
        });
      }
      if (card.pipeline.chave === BPM_PIPELINE_KEYS.FINANCEIRO && Object.keys(valores).length > 0) {
        await registrarConclusaoContratoFinanceiro(tx, card.id, card.pipelineId, input.ator.userId ?? null);
      }

      if (input.proximoContatoEm !== undefined) {
        await tx.bpmCardFollowUpEstado.upsert({
          where: { cardId: card.id },
          create: { cardId: card.id, proximoContatoEm: input.proximoContatoEm },
          update: { proximoContatoEm: input.proximoContatoEm },
        });
      }

      let subStatusId: string | null = card.estadoOntologico?.subStatusId ?? null;
      if (transicao.limparSubStatus) subStatusId = null;
      if (subStatusId) {
        const valido = await tx.bpmSubStatus.findFirst({ where: { id: subStatusId, etapaId: destino.id, ativo: true }, select: { id: true } });
        if (!valido) erro("INVALID_SUBSTATUS", "O substatus atual não é válido na etapa de destino.");
      }

      const movimento = await tx.bpmCard.updateMany({
        where: { id: card.id, etapaId: card.etapaId, versao: card.versao },
        data: {
          etapaId: destino.id,
          status: lifecycle,
          concluidoEm,
          versao: { increment: 1 },
          updatedAt: agora,
          ...(input.proximoContatoEm !== undefined ? { proximoContatoEm: input.proximoContatoEm } : {}),
        },
      });
      if (movimento.count !== 1) erro("CONCURRENT_TRANSITION", "Outra operação moveu este card. Recarregue e tente novamente.");

      await tx.bpmCardEstado.upsert({
        where: { cardId: card.id },
        create: {
          cardId: card.id,
          outcome,
          subStatusId,
          canceladoEm: lifecycle === "CANCELADO" ? agora : null,
          arquivadoEm: lifecycle === "ARQUIVADO" ? agora : null,
        },
        update: {
          outcome,
          subStatusId,
          canceladoEm: lifecycle === "CANCELADO" ? (card.estadoOntologico?.canceladoEm ?? agora) : null,
          arquivadoEm: lifecycle === "ARQUIVADO" ? (card.estadoOntologico?.arquivadoEm ?? agora) : null,
        },
      });

      const historico = await tx.bpmCardHistorico.create({
        data: {
          cardId: card.id,
          acao: "CARD_MOVIDO",
          usuarioId: input.ator.tipo === "MANUAL" ? input.ator.userId : null,
          automacaoOrigem: input.ator.automacaoId,
          valorAnteriorJson: JSON.stringify({ etapaId: card.etapaId, lifecycle: card.status, outcome: card.estadoOntologico?.outcome ?? null, versao: card.versao }),
          valorNovoJson: JSON.stringify({ etapaId: destino.id, lifecycle, outcome, subStatusId, versao: card.versao + 1, camposPreenchidos: Object.keys(prepared.valoresValidados) }),
        },
      });
      const evento = await publicarEventoBpm({
        tipo: "CARD_MOVIDO",
        entidadeTipo: "CARD",
        entidadeId: card.id,
        cardId: card.id,
        pipelineId: card.pipelineId,
        valorAnterior: { etapaId: card.etapaId, lifecycle: card.status, outcome: card.estadoOntologico?.outcome ?? null, versao: card.versao },
        valorNovo: { etapaId: destino.id, lifecycle, outcome, subStatusId, versao: card.versao + 1 },
        atorTipo: input.ator.tipo === "MANUAL" ? "USUARIO" : input.ator.tipo,
        atorUserId: input.ator.tipo === "MANUAL" ? input.ator.userId : undefined,
        atorExecucaoId: input.ator.automacaoExecucaoId,
        correlationId,
        causationId: input.causationId ?? historico.id,
        idempotencyKey: `transition:${input.idempotencyKey}`,
      }, tx);
      if (!evento) erro("OUTBOX_UNAVAILABLE", "Não foi possível registrar o evento da transição.");

      await sincronizarSlaMovimentoBpm({
        cardId: card.id,
        etapaOrigemId: card.etapaId,
        etapaOrigemNome: card.etapa.nome,
        etapaOrigemChave: card.etapa.chave,
        etapaDestinoNome: destino.nome,
        etapaDestinoChave: destino.chave,
        client: tx,
        agora,
      });

      await ativarCadenciasNaEntradaBpm({
        cardId: card.id,
        pipelineAnteriorId: card.pipelineId,
        etapaAnteriorId: card.etapaId,
        pipelineDestinoId: card.pipelineId,
        etapaDestinoId: destino.id,
        evento: "CARD_MOVIDO",
        usuarioId: input.ator.tipo === "MANUAL" ? input.ator.userId : undefined,
        automacaoOrigem: input.ator.tipo === "MANUAL" ? undefined : (input.ator.automacaoId ?? "Transição automática"),
        agora,
      }, tx);

      await tx.bpmTransicaoExecucao.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          cardId: card.id,
          transicaoId: transicao.id,
          etapaOrigemId: card.etapaId,
          etapaDestinoId: destino.id,
          versaoEsperada: card.versao,
          versaoResultante: card.versao + 1,
          atorTipo: input.ator.tipo,
          atorUserId: input.ator.userId,
          atorExecucaoId: input.ator.automacaoExecucaoId,
          correlationId,
          causationId: input.causationId,
          concluidoEm: agora,
        },
      });

      return {
        cardId: card.id,
        transicaoId: transicao.id,
        etapaOrigemId: card.etapaId,
        etapaDestinoId: destino.id,
        versao: card.versao + 1,
        lifecycle,
        outcome,
        historicoId: historico.id,
        eventoId: evento.id,
        idempotente: false,
        pipelineId: card.pipelineId,
      };
    }, { maxWait: 10_000, timeout: 60_000 });

    if (!result.idempotente) {
      try {
        await enfileirarAutomacoesMovimentoBpm({
          cardId: result.cardId,
          pipelineId: result.pipelineId,
          etapaOrigemId: result.etapaOrigemId,
          etapaDestinoId: result.etapaDestinoId,
          eventoId: result.eventoId,
        });
      } catch (queueError) {
        console.error("[TransitionCommand/outbox-consumer]", queueError);
      }
      try {
        await processarCadenciasImediatasDoCardBpm(result.cardId);
      } catch (cadenciaError) {
        console.error("[TransitionCommand/cadencia-imediata]", cadenciaError);
      }
    }
    const { pipelineId: _pipelineId, ...publicData } = result;
    void _pipelineId;
    return { success: true, data: publicData };
  } catch (errorValue) {
    return mensagemErroDesconhecido(errorValue);
  }
}
