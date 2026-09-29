import "server-only";

import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import type { Prisma } from "@prisma/client";

import db from "@/lib/prisma";
import { calcularPrazoFinal } from "@/lib/bpm/sla";
import { executarTransicaoBpm } from "@/lib/bpm/transicao-command";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";
import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";
import { idTarefaDiariaPorTipo, idTarefaUnicaPorTipo } from "@/lib/bpm/automacoes/idempotencia-tarefa";
import { calcularDiaCicloNovosLeads, contarDiasUteisDecorridos, intervaloDiaCivilSaoPaulo } from "@/lib/bpm/novos-leads";
import { sincronizarTranscricaoCardBpm } from "@/lib/bpm/transcricao-reuniao-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { ativarCadenciasNaEntradaBpm } from "@/lib/bpm/cadencias/ativacao-automatica";
import { copiarCamposCardVinculado } from "@/lib/bpm/copiar-campos-card-vinculado";
import { carregarCamposFaltantesCardEtapa } from "@/lib/bpm/requisitos-etapa-server";
import { sincronizarNotaFiscalCard } from "@/lib/bpm/financeiro-nota-fiscal-server";
import { montarContextoAvaliacaoDoCard } from "@/lib/bpm/regras/contexto";
import { avaliarPagamentoFinanceiro } from "@/lib/bpm/financeiro-pagamento-validacao";
import { avaliarFormalizacaoFinanceira } from "@/lib/bpm/financeiro-formalizacao";
import { CHAVES_CAMPOS } from "@/lib/bpm/financeiro-config.client";
import { extrairPathnamePrivadoAnexoBpm } from "@/lib/bpm/anexos-storage";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";
import type { ContextoAvaliacao } from "@/lib/bpm/regras/types";
import { executarHttpSeguro } from "./safe-http";
import { publicarEventoBpm } from "./eventos";
import { validarGrafoAutomacao, validarParametrosAcaoCentral, type GrafoAutomacao, type NoAutomacao, type TipoAcaoCentral } from "./central-schemas";
import { executarAcaoLegadaNoMotorCentral } from "./executor";
import { renderizarPlaceholdersAutomacaoBpm } from "./placeholders";
import type { AcaoAutomacaoBpm } from "./schemas";

const LIMITE_TENTATIVAS = 3;
const LEASE_MS = 3 * 60_000;

type ExecucaoCentral = NonNullable<Awaited<ReturnType<typeof carregarExecucao>>>;

function parseObjeto(valor: string | null): Record<string, unknown> {
  if (!valor) return {};
  try { const item = JSON.parse(valor); return item && typeof item === "object" && !Array.isArray(item) ? item : {}; } catch { return {}; }
}

function erroMensagem(error: unknown) {
  return (error instanceof Error ? error.message : "Falha inesperada").slice(0, 2_000);
}

async function adquirirLease(recurso: string, titular: string): Promise<boolean> {
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + LEASE_MS);
  try {
    await db.bpmAutomacaoLease.create({ data: { recurso, titular, expiraEm, fencingToken: 1 } });
    return true;
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error;
  }
  const alterada = await db.bpmAutomacaoLease.updateMany({
    where: { recurso, OR: [{ expiraEm: { lte: agora } }, { titular }] },
    data: { titular, expiraEm, fencingToken: { increment: 1 } },
  });
  return alterada.count === 1;
}

async function liberarLease(recurso: string, titular: string) {
  await db.bpmAutomacaoLease.deleteMany({ where: { recurso, titular } });
}

async function carregarExecucao(id: string) {
  return db.bpmAutomacaoExecucao.findUnique({
    where: { id },
    include: {
      automacao: true,
      automacaoVersao: true,
      evento: true,
      passos: true,
      card: {
        include: {
          empresa: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true } },
          responsavel: { select: { nome: true } }, pipeline: { select: { nome: true, chave: true } }, etapa: { select: { nome: true } },
        },
      },
    },
  });
}

/** Variáveis `{{...}}` disponíveis em todos os textos das ações centrais. */
function placeholdersDoCard(card: ExecucaoCentral["card"]): Record<string, string> {
  const agora = new Date();
  return {
    "agora.data": new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora),
    "agora.instante": agora.toISOString(),
    "card.id": card.id,
    "card.servico": card.servico ?? "",
    "empresa.razaoSocial": card.empresa?.razaoSocial ?? "",
    "empresa.nomeFantasia": card.empresa?.nomeFantasia ?? "",
    "empresa.cnpj": card.empresa?.cnpj ?? "",
    "responsavel.nome": card.responsavel?.nome ?? "",
    "pipeline.nome": card.pipeline?.nome ?? "",
    "coluna.nome": card.etapa?.nome ?? "",
  };
}

async function exigirPagamentoValidado(card: ExecucaoCentral["card"], tx: Prisma.TransactionClient,
  exigirContrato = false) {
  if (card.pipelineId !== "cmuih4i54000209gmmyqrg557") return;
  const chaves = [CHAVES_CAMPOS.PAGAMENTO_CONFIRMADO, CHAVES_CAMPOS.DATA_PAGAMENTO,
    CHAVES_CAMPOS.VALOR_ESPERADO, CHAVES_CAMPOS.VALOR_RECEBIDO, CHAVES_CAMPOS.FORMA_PAGAMENTO_UTILIZADA,
    CHAVES_CAMPOS.COMPROVANTE, CHAVES_CAMPOS.VALOR_LIQUIDO, CHAVES_CAMPOS.VALOR_CONTRATADO,
    CHAVES_CAMPOS.TOTAL_RETENCOES, CHAVES_CAMPOS.STATUS_ASSINATURA, CHAVES_CAMPOS.DATA_ASSINATURA,
    CHAVES_CAMPOS.ANEXO_ASSINADO];
  const campos = await tx.bpmCampo.findMany({ where: { pipelineId: card.pipelineId, chave: { in: chaves }, ativo: true },
    select: { id: true, chave: true } });
  const ids = new Map(campos.map((campo) => [campo.chave, campo.id]));
  if (!ids.has(CHAVES_CAMPOS.VALOR_ESPERADO)) throw new Error("Campo Valor esperado indisponível na configuração ativa");
  const valores = await tx.bpmCardCampoValor.findMany({ where: { cardId: card.id, campoId: { in: [...ids.values()] } },
    select: { campoId: true, valor: true } });
  const porId = new Map(valores.map((item) => [item.campoId, item.valor]));
  const valor = (chave: string) => porId.get(ids.get(chave) ?? "") ?? null;
  const comprovanteCampoId = ids.get(CHAVES_CAMPOS.COMPROVANTE);
  const comprovanteId = valor(CHAVES_CAMPOS.COMPROVANTE);
  const comprovante = comprovanteId && comprovanteCampoId ? await tx.bpmCardAnexo.findFirst({
    where: { id: comprovanteId, cardId: card.id, campoId: comprovanteCampoId }, select: { url: true },
  }) : null;
  const regras = comprovanteCampoId ? await tx.bpmRequisito.findMany({
    where: { pipelineId: card.pipelineId, campoId: comprovanteCampoId, ativo: true,
      alvoTipo: "CAMPO", fase: "DURING_STAGE" }, select: { condicaoJson: true },
  }) : [];
  const contexto = regras.some((regra) => regra.condicaoJson)
    ? await montarContextoAvaliacaoDoCard(card, tx) : null;
  const comprovanteExigido = regras.some((regra) => !regra.condicaoJson || (contexto
    && avaliarGrupo(grupoCondicaoSchema.parse(JSON.parse(regra.condicaoJson)), contexto)));
  const avaliacao = avaliarPagamentoFinanceiro({
    confirmado: valor(CHAVES_CAMPOS.PAGAMENTO_CONFIRMADO), data: valor(CHAVES_CAMPOS.DATA_PAGAMENTO),
    esperado: valor(CHAVES_CAMPOS.VALOR_ESPERADO), recebido: valor(CHAVES_CAMPOS.VALOR_RECEBIDO),
    forma: valor(CHAVES_CAMPOS.FORMA_PAGAMENTO_UTILIZADA),
    comprovanteExigido: Boolean(comprovanteExigido),
    comprovanteValido: Boolean(comprovante?.url && extrairPathnamePrivadoAnexoBpm(comprovante.url)),
    liquido: valor(CHAVES_CAMPOS.VALOR_LIQUIDO), bruto: valor(CHAVES_CAMPOS.VALOR_CONTRATADO),
    retencoes: valor(CHAVES_CAMPOS.TOTAL_RETENCOES),
  });
  if (!avaliacao.concluido) throw new Error(`Pagamento não validado: ${avaliacao.pendencias.join(", ")}`);
  if (exigirContrato) {
    const anexoCampoId = ids.get(CHAVES_CAMPOS.ANEXO_ASSINADO);
    const anexoId = valor(CHAVES_CAMPOS.ANEXO_ASSINADO);
    const anexo = anexoId && anexoCampoId ? await tx.bpmCardAnexo.findFirst({
      where: { id: anexoId, cardId: card.id, campoId: anexoCampoId }, select: { url: true },
    }) : null;
    const contrato = avaliarFormalizacaoFinanceira({
      statusAssinatura: valor(CHAVES_CAMPOS.STATUS_ASSINATURA),
      dataAssinatura: valor(CHAVES_CAMPOS.DATA_ASSINATURA),
      anexoAssinadoId: anexoId,
      anexoAssinadoVinculado: Boolean(anexo?.url && extrairPathnamePrivadoAnexoBpm(anexo.url)),
      pagamentoConfirmado: valor(CHAVES_CAMPOS.PAGAMENTO_CONFIRMADO),
    });
    if (!contrato.contratacaoConcluida) throw new Error(`Contratação não concluída: ${contrato.pendencias.join(", ")}`);
  }
}

function proximoNo(no: NoAutomacao): string | null {
  return no.tipo === "ACAO" ? no.proximoId ?? null : no.tipo === "ESPERA" ? no.proximoId : null;
}

async function publicarEventoDaAcao(execucao: ExecucaoCentral, tipo: Parameters<typeof publicarEventoBpm>[0] extends never ? never : string, entidadeTipo: string, entidadeId: string, anterior?: unknown, novo?: unknown, client?: Prisma.TransactionClient) {
  const eventoPai = execucao.evento;
  await publicarEventoBpm({
    tipo, entidadeTipo, entidadeId, cardId: execucao.cardId, pipelineId: execucao.card.pipelineId,
    valorAnterior: anterior, valorNovo: novo, atorTipo: "AUTOMACAO", atorExecucaoId: execucao.id,
    correlationId: execucao.correlationId ?? eventoPai?.correlationId ?? execucao.id,
    causationId: eventoPai?.id ?? execucao.id, profundidade: (eventoPai?.profundidade ?? 0) + 1,
    idempotencyKey: `automacao:${execucao.id}:${entidadeTipo}:${entidadeId}:${tipo}`,
  }, client);
}

async function executarAcaoCentral(execucao: ExecucaoCentral, tipo: TipoAcaoCentral, bruto: unknown) {
  const parametros = validarParametrosAcaoCentral(tipo, bruto) as Record<string, unknown>;
  const card = execucao.card;
  const variaveis = placeholdersDoCard(card);
  const texto = (valor: unknown) => renderizarPlaceholdersAutomacaoBpm(String(valor), variaveis);
  if (["ENVIAR_EMAIL", "GERAR_CONTRATO", "GERAR_FICHA", "MATERIALIZAR_CHECKLIST", "DISTRIBUIR_RESPONSAVEL", "IDENTIFICAR_OPORTUNIDADE"].includes(tipo)) {
    const resultado = await executarAcaoLegadaNoMotorCentral({
      execucaoId: execucao.id, automacaoId: execucao.automacaoId, automacaoNome: execucao.automacao.nome,
      criadoPorId: execucao.automacao.criadoPorId, cardId: card.id, gatilhoTipo: execucao.gatilhoTipo,
      automacaoEtapaId: execucao.automacao.etapaId, acaoTipo: tipo as AcaoAutomacaoBpm, parametros,
    });
    if (tipo === "GERAR_CONTRATO") {
      await notificarPipelineBpm({ pipelineId: card.pipelineId, cardId: card.id, tipo: "CARD_ATUALIZADO" });
    }
    return resultado;
  }
  if (tipo === "ALTERAR_CAMPO") {
    const campoId = String(parametros.campoId);
    const campo = await db.bpmCampo.findFirst({
      where: { id: campoId, ativo: true, OR: [
        { pipelineId: card.pipelineId },
        { pipelinesAssociados: { some: { pipelineId: card.pipelineId } } },
      ] },
      select: { id: true, chave: true, nome: true, tipo: true, opcoesJson: true },
    });
    if (!campo) throw new Error("Campo ativo não pertence ao pipeline do card");
    let brutoValor = parametros.valor === null ? "" : texto(parametros.valor);
    const origemId = /^\{\{campo\.([a-z0-9]+)\}\}$/.exec(brutoValor)?.[1];
    if (!origemId && brutoValor.includes("{{campo.")) throw new Error("Referência de campo inválida");
    if (origemId) {
      const origem = await db.bpmCampo.findFirst({ where: { id: origemId, ativo: true, OR: [
        { pipelineId: card.pipelineId }, { pipelinesAssociados: { some: { pipelineId: card.pipelineId } } },
      ] }, select: { id: true, escopo: true, fonteEntidade: true, fonteAtributo: true, entidadeGlobal: true } });
      if (!origem) throw new Error("Campo de origem não pertence ao pipeline do card");
      const [valorCard, canonico] = await Promise.all([
        db.bpmCardCampoValor.findUnique({ where: { cardId_campoId: { cardId: card.id, campoId: origemId } }, select: { valor: true } }),
        carregarValoresCanonicosCampos(card.id, [origem]),
      ]);
      brutoValor = String(canonico[origemId] ?? valorCard?.valor ?? "");
    }
    const validacao = validarValoresCamposBpm([campo], { [campoId]: brutoValor });
    if (!validacao.success) throw new Error(validacao.error);
    const valor = validacao.valores[campoId] || null;
    const resultado = await db.$transaction(async (tx) => {
      if ((campo.chave === CHAVES_CAMPOS.STATUS_FINANCEIRO && valor === "PAGAMENTO CONCLUÍDO")
        || (campo.chave === CHAVES_CAMPOS.STATUS_CONTRATACAO && valor === "Contratação concluída")) {
        await exigirPagamentoValidado(card, tx, valor === "Contratação concluída");
      }
      const anterior = await tx.bpmCardCampoValor.findUnique({ where: { cardId_campoId: { cardId: card.id, campoId } } });
      if (parametros.somenteSeVazio === true && anterior?.valor?.trim()) {
        return { campoId, valor: anterior.valor, ignorada: true, motivo: "CAMPO_JA_PREENCHIDO" };
      }
      if ((anterior?.valor ?? "") === (valor ?? "")) return { campoId, valor, ignorada: true, motivo: "VALOR_IGUAL" };
      await tx.bpmCardCampoValor.upsert({ where: { cardId_campoId: { cardId: card.id, campoId } }, create: { cardId: card.id, campoId, valor }, update: { valor } });
      await publicarEventoDaAcao(execucao, "CAMPO_ALTERADO", "CAMPO", campoId, { campoId, valor: anterior?.valor ?? null }, { campoId, valor }, tx);
      return { campoId, valor };
    });
    if (resultado.ignorada) return resultado;
    await notificarPipelineBpm({ pipelineId: card.pipelineId, cardId: card.id, tipo: "CARD_ATUALIZADO" });
    return resultado;
  }
  if (tipo === "MOVER_CARD") {
    const etapaId = String(parametros.etapaId);
    const etapa = await db.bpmEtapa.findFirst({ where: { id: etapaId, pipelineId: card.pipelineId, ativo: true }, select: { id: true } });
    if (!etapa) throw new Error("Etapa de destino inválida");
    const anterior = card.etapaId;
    if (parametros.exigirProximoContatoVazio && card.proximoContatoEm) return { ignorada: true, motivo: "PROXIMO_CONTATO_PREENCHIDO" };
    if (anterior === etapaId) return { etapaAnteriorId: anterior, etapaId };
    if (execucao.gatilhoTipo === "REUNIAO_AGENDADA" && anterior !== execucao.automacao.etapaId) {
      return { ignorada: true, motivo: "CARD_JA_SAIU_DA_ETAPA_DO_AGENDAMENTO" };
    }
    const movimento = await executarTransicaoBpm({
      cardId: card.id,
      etapaOrigemEsperadaId: anterior,
      etapaDestinoId: etapaId,
      idempotencyKey: `automacao:${execucao.id}:mover:${etapaId}`,
      correlationId: execucao.correlationId ?? execucao.id,
      causationId: execucao.evento?.id ?? execucao.id,
      ator: { tipo: "AUTOMACAO", automacaoId: execucao.automacaoId, automacaoExecucaoId: execucao.id },
    });
    if (!movimento.success) throw new Error(movimento.error);
    return { etapaAnteriorId: anterior, etapaId };
  }
  if (tipo === "ALTERAR_SUBSTATUS") {
    const subStatusId = String(parametros.subStatusId);
    const sub = await db.bpmSubStatus.findFirst({ where: { id: subStatusId, etapaId: card.etapaId, ativo: true }, select: { id: true, nome: true } });
    if (!sub) throw new Error("Substatus inválido para a etapa atual");
    const estadoAnterior = await db.bpmCardEstado.findUnique({ where: { cardId: card.id }, select: { subStatusId: true } });
    await db.$transaction([
      db.bpmCardEstado.upsert({ where: { cardId: card.id }, create: { cardId: card.id, subStatusId: sub.id }, update: { subStatusId: sub.id } }),
      db.bpmCardHistorico.create({ data: { cardId: card.id, acao: "SUBSTATUS_ALTERADO", automacaoOrigem: execucao.automacaoId, valorAnteriorJson: JSON.stringify({ subStatusId: estadoAnterior?.subStatusId ?? null }), valorNovoJson: JSON.stringify({ subStatusId: sub.id, nome: sub.nome, execucaoId: execucao.id }) } }),
    ]);
    await publicarEventoDaAcao(execucao, "CARD_ATUALIZADO", "CARD", card.id, { subStatusId: estadoAnterior?.subStatusId ?? null }, { subStatusId: sub.id, subStatusNome: sub.nome });
    await notificarPipelineBpm({ pipelineId: card.pipelineId, cardId: card.id, tipo: "CARD_ATUALIZADO" });
    return sub;
  }
  if (tipo === "CRIAR_TAREFA") {
    const interromperSeCampo = parametros.interromperSeCampoPreenchido;
    const followUpNoLoss = execucao.automacao.chave === "standby_follow_up_semanal" || interromperSeCampo === "standbyFollowUpInterrompidoEm";
    if (followUpNoLoss && card.standbyFollowUpInterrompidoEm) return { ignorada: true, motivo: "FOLLOW_UP_INTERROMPIDO" };
    if (interromperSeCampo === "proximoContatoEm" && card.proximoContatoEm) return { ignorada: true, motivo: "PROXIMO_CONTATO_PREENCHIDO" };
    const responsavelId = Number(parametros.responsavelId ?? card.responsavelId);
    const temPrazo = parametros.prazoMinutos !== undefined;
    const prazoMinutos = Number(parametros.prazoMinutos ?? 0);
    const alertaMinutos = parametros.alertaMinutos === undefined ? null : Number(parametros.alertaMinutos);
    const agora = new Date();
    const idUnicoDia = parametros.naoDuplicarDiaTipo
      ? idTarefaDiariaPorTipo(card.id, String(parametros.tipo), agora) : null;
    const tarefa = await db.$transaction(async (tx) => {
      if (String(parametros.tipo) === "EMISSAO_NF") await exigirPagamentoValidado(card, tx);
      let prazoDoCampo: Date | null = null;
      if (parametros.prazoCampoId) {
        const campoPrazo = await tx.bpmCampo.findFirst({
          where: { id: String(parametros.prazoCampoId), pipelineId: card.pipelineId, ativo: true,
            tipo: { in: ["data", "data_hora"] } }, select: { id: true },
        });
        if (!campoPrazo) throw new Error("Campo do prazo da tarefa inválido");
        const valorPrazo = await tx.bpmCardCampoValor.findUnique({
          where: { cardId_campoId: { cardId: card.id, campoId: campoPrazo.id } }, select: { valor: true },
        });
        if (!valorPrazo?.valor) return { ignorada: true as const, motivo: "PRAZO_NAO_DEFINIDO" };
        prazoDoCampo = new Date(valorPrazo.valor);
        if (Number.isNaN(prazoDoCampo.getTime())) throw new Error("Prazo da tarefa inválido");
      }
      if (followUpNoLoss) {
        const elegivel = await tx.bpmCard.updateMany({
          where: { id: card.id, etapaId: execucao.automacao.etapaId, status: "ATIVO", standbyFollowUpInterrompidoEm: null },
          data: { standbyFollowUpUltimoEm: agora },
        });
        if (elegivel.count !== 1) return { ignorada: true as const, motivo: "FOLLOW_UP_INTERROMPIDO_OU_FORA_DA_ETAPA" };
      }
      if (parametros.naoDuplicarTipo || parametros.naoDuplicarPendenteTipo) {
        const existente = await tx.bpmTarefa.findFirst({ where: {
          cardId: card.id, tipo: String(parametros.tipo),
          ...(parametros.naoDuplicarTipo ? {} : { status: "PENDENTE" }),
        }, select: { id: true } });
        if (existente) return { id: existente.id, existente: true };
      }
      if (parametros.naoDuplicarDiaTipo) {
        const { inicio, fim } = intervaloDiaCivilSaoPaulo(agora);
        const existenteHoje = await tx.bpmTarefa.findFirst({ where: {
          cardId: card.id, tipo: String(parametros.tipo), createdAt: { gte: inicio, lt: fim },
        }, select: { id: true } });
        if (existenteHoje) return { id: existenteHoje.id, existente: true };
      }
      if (parametros.registrarExecucaoEmCampo === "standbyFollowUpUltimoEm" && !followUpNoLoss) {
        await tx.bpmCard.update({ where: { id: card.id }, data: { standbyFollowUpUltimoEm: agora } });
      }
      const criada = await tx.bpmTarefa.create({ data: {
        ...(parametros.naoDuplicarTipo ? { id: idTarefaUnicaPorTipo(card.id, String(parametros.tipo)) }
          : idUnicoDia ? { id: idUnicoDia } : {}),
        cardId: card.id, titulo: texto(parametros.titulo), descricao: parametros.descricao ? texto(parametros.descricao) : null,
        responsavelId, prazo: prazoDoCampo ?? (temPrazo ? new Date(agora.getTime() + prazoMinutos * 60_000) : null),
        alertaEm: alertaMinutos === null ? null : new Date(agora.getTime() + alertaMinutos * 60_000),
        tipo: String(parametros.tipo), prioridade: String(parametros.prioridade),
      } });
      if (followUpNoLoss) {
        await tx.bpmCardHistorico.create({ data: {
          cardId: card.id, acao: "STANDBY_FOLLOW_UP_TAREFA_CRIADA", automacaoOrigem: execucao.automacaoId,
          valorNovoJson: JSON.stringify({ tarefaId: criada.id, execucaoId: execucao.id, criadaEm: agora.toISOString() }),
        } });
      }
      await publicarEventoDaAcao(execucao, "TAREFA_CRIADA", "TAREFA", criada.id, undefined, { tarefaId: criada.id, tipo: criada.tipo, titulo: criada.titulo }, tx);
      if (criada.tipo === "EMISSAO_NF" && card.pipelineId === "cmuih4i54000209gmmyqrg557") {
        await sincronizarNotaFiscalCard({ tx, cardId: card.id, pipelineId: card.pipelineId });
      }
      return criada;
    }).catch(async (error) => {
      if (idUnicoDia && typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        const existente = await db.bpmTarefa.findUnique({ where: { id: idUnicoDia }, select: { id: true } });
        if (existente) return { ...existente, existente: true };
      }
      throw error;
    });
    if ("ignorada" in tarefa) return tarefa;
    if ("existente" in tarefa) return { tarefaId: tarefa.id, existente: true };
    await notificarPipelineBpm({ pipelineId: card.pipelineId, cardId: card.id, tipo: "TAREFA_ALTERADA" });
    return { tarefaId: tarefa.id };
  }
  if (tipo === "CRIAR_TAREFAS_POR_META") {
    const limiteDias = parametros.maximoDiasUteisDesdeCriacao === undefined ? null : Number(parametros.maximoDiasUteisDesdeCriacao);
    if (limiteDias !== null && contarDiasUteisDecorridos(card.createdAt) >= limiteDias) return { ignorada: true, motivo: "CICLO_ENCERRADO" };
    const { inicio, fim } = intervaloDiaCivilSaoPaulo();
    const realizadas = await db.bpmInteracaoCard.count({ where: { cardId: card.id, tipo: String(parametros.interacaoTipo), createdAt: { gte: inicio, lt: fim } } });
    const meta = Number(parametros.meta);
    const restantes = Math.max(0, meta - realizadas);
    if (!restantes) return { tarefasCriadas: 0, realizadas };
    const diaCiclo = calcularDiaCicloNovosLeads(card.createdAt);
    const preencher = (modelo: string, indice: number) => texto(modelo)
      .replaceAll("{{indice}}", String(indice))
      .replaceAll("{{meta}}", String(meta))
      .replaceAll("{{diaCiclo}}", String(diaCiclo));
    const tarefas = await db.$transaction(Array.from({ length: restantes }, (_, offset) => db.bpmTarefa.create({ data: {
      cardId: card.id,
      titulo: preencher(String(parametros.titulo), realizadas + offset + 1),
      descricao: parametros.descricao ? preencher(String(parametros.descricao), realizadas + offset + 1) : null,
      responsavelId: card.responsavelId,
      prazo: new Date(),
      alertaEm: new Date(),
      tipo: String(parametros.tarefaTipo),
      prioridade: String(parametros.prioridade),
    }, select: { id: true } })));
    await notificarPipelineBpm({ pipelineId: card.pipelineId, cardId: card.id, tipo: "TAREFA_ALTERADA" });
    return { tarefasCriadas: tarefas.length, tarefasIds: tarefas.map((tarefa) => tarefa.id), realizadas, meta, diaCiclo };
  }
  if (tipo === "MARCAR_ALERTA_TAREFA") {
    const tarefaId = execucao.evento?.entidadeTipo === "TAREFA" ? execucao.evento.entidadeId : null;
    if (!tarefaId) throw new Error("O alerta exige um evento de tarefa");
    const alterada = await db.bpmTarefa.updateMany({ where: { id: tarefaId, cardId: card.id, status: "PENDENTE", alertaEm: { lte: new Date() }, alertaDisparadoEm: null }, data: { alertaDisparadoEm: new Date() } });
    if (alterada.count) {
      await db.bpmCardHistorico.create({ data: { cardId: card.id, acao: "TAREFA_ALERTA_DISPARADO", automacaoOrigem: execucao.automacaoId, valorNovoJson: JSON.stringify({ tarefaId, execucaoId: execucao.id }) } });
      await notificarPipelineBpm({ pipelineId: card.pipelineId, cardId: card.id, tipo: "TAREFA_ALTERADA" });
    }
    return { tarefaId, disparado: alterada.count === 1 };
  }
  if (tipo === "SINCRONIZAR_TRANSCRICAO_REUNIAO") {
    const resultado = await sincronizarTranscricaoCardBpm(card.id, "automatica");
    return { resultado };
  }
  if (tipo === "CRIAR_SLA") {
    const config = await db.bpmSlaConfig.findFirst({ where: { id: String(parametros.slaConfigId), ativa: true, OR: [{ pipelineId: null }, { pipelineId: card.pipelineId }] } });
    if (!config) throw new Error("Configuração de SLA inválida");
    const existente = await db.bpmSlaInstancia.findFirst({ where: { cardId: card.id, tarefaId: null, slaConfigId: config.id, status: { notIn: ["CONCLUIDO", "CANCELADO"] } } });
    if (existente) return { slaInstanciaId: existente.id, existente: true };
    const agora = new Date(); const prazoFinal = calcularPrazoFinal(config, agora);
    const instancia = await db.bpmSlaInstancia.create({ data: { cardId: card.id, slaConfigId: config.id, status: "DENTRO_PRAZO", inicioContagem: agora, prazoFinal, deadline: prazoFinal, eventos: { create: { statusNovo: "DENTRO_PRAZO", motivo: "AUTOMACAO_CENTRAL", origem: "AUTOMACAO", metadataJson: JSON.stringify({ execucaoId: execucao.id }) } } } });
    return { slaInstanciaId: instancia.id };
  }
  if (tipo === "CRIAR_ALERTA" || tipo === "ADICIONAR_ANOTACAO") {
    const acao = tipo === "CRIAR_ALERTA" ? "ALERTA_AUTOMACAO" : "ANOTACAO_AUTOMACAO";
    const historico = await db.bpmCardHistorico.create({ data: { cardId: card.id, acao, automacaoOrigem: execucao.automacaoId, valorNovoJson: JSON.stringify({ texto: texto(parametros.texto), execucaoId: execucao.id }) } });
    await notificarPipelineBpm({ pipelineId: card.pipelineId, cardId: card.id, tipo: "CARD_ATUALIZADO" });
    return { historicoId: historico.id };
  }
  if (tipo === "CRIAR_CARD_OUTRO_PIPELINE") {
    const pipelineId = String(parametros.pipelineId); const etapaId = String(parametros.etapaId);
    const pipelineDestino = await db.bpmPipeline.findFirst({ where: { id: pipelineId, ativo: true }, select: { chave: true } });
    if (!pipelineDestino) return { ignorada: true, motivo: "PIPELINE_DESTINO_INATIVO" };
    const etapa = await db.bpmEtapa.findFirst({ where: { id: etapaId, pipelineId, ativo: true }, select: { id: true } });
    if (!etapa) throw new Error("Pipeline/etapa de destino inválidos");
    const handoffOperacional = card.pipeline.chave === "financeiro" && pipelineDestino.chave === "operacional";
    const handoffFinanceiro = pipelineDestino.chave === "financeiro"
      && (card.pipeline.chave === "comercial" || card.pipeline.nome === "Revisão de Radar");
    if (handoffOperacional && card.status !== "CONCLUIDO") {
      throw new Error("A contratação precisa estar concluída antes da liberação ao Operacional");
    }
    // A indicação pertence à negociação comercial, não ao card financeiro. O vínculo
    // direto mantém vendedor, origem, anexos e histórico localizáveis com as permissões
    // habituais de acesso ao card de origem.
    const negociacao = handoffOperacional ? await db.bpmCardVinculo.findFirst({
      where: { cardDestinoId: card.id, cardOrigem: { pipeline: { chave: "comercial" } } },
      select: { cardOrigemId: true, cardOrigem: { select: { responsavelId: true, indicacaoOrigem: { select: { parceiroId: true } } } } },
    }) : null;
    const vincular = handoffOperacional || parametros.vincularAoOriginal !== false;
    const completarHandoff = async (tx: Prisma.TransactionClient, destinoId: string) => {
      if (!handoffOperacional) return;
      await tx.bpmCardVinculo.upsert({
        where: { cardOrigemId_cardDestinoId: { cardOrigemId: card.id, cardDestinoId: destinoId } },
        create: { cardOrigemId: card.id, cardDestinoId: destinoId }, update: {},
      });
      // A origem financeira tem precedência; o card comercial preenche somente
      // valores ainda ausentes no destino (o helper usa update vazio).
      await copiarCamposCardVinculado(tx, card.id, destinoId, pipelineId, etapaId);
      if (negociacao) {
        await tx.bpmCardVinculo.upsert({
          where: { cardOrigemId_cardDestinoId: { cardOrigemId: negociacao.cardOrigemId, cardDestinoId: destinoId } },
          create: { cardOrigemId: negociacao.cardOrigemId, cardDestinoId: destinoId }, update: {},
        });
        await copiarCamposCardVinculado(tx, negociacao.cardOrigemId, destinoId, pipelineId, etapaId);
      }
      // Um valor de campo "arquivo" é o ID de BpmCardAnexo, cujo acesso é
      // autorizado pelo card proprietário. Referências copiadas de outro card
      // não representam um anexo do destino; os documentos seguem nos cards
      // vinculados, sem duplicar o registro ou abrir uma URL direta.
      const camposArquivo = await tx.bpmCampo.findMany({
        where: { tipo: { in: ["arquivo", "url_ou_arquivo"] }, ativo: true,
          OR: [{ pipelineId }, { pipelinesAssociados: { some: { pipelineId } } }],
          etapaConfiguracoes: { some: { etapaId, visivel: true } } },
        select: { id: true, tipo: true },
      });
      if (camposArquivo.length) {
        const valoresArquivo = await tx.bpmCardCampoValor.findMany({
          where: { cardId: destinoId, campoId: { in: camposArquivo.map((campo) => campo.id) } },
          select: { campoId: true, valor: true },
        });
        const idsAnexo = valoresArquivo.filter((item) => item.valor && !/^https:\/\//i.test(item.valor)).map((item) => item.valor as string);
        const anexosProprios = idsAnexo.length ? await tx.bpmCardAnexo.findMany({
          where: { cardId: destinoId, id: { in: idsAnexo } }, select: { id: true },
        }) : [];
        const idsProprios = new Set(anexosProprios.map((anexo) => anexo.id));
        const tipoPorCampo = new Map(camposArquivo.map((campo) => [campo.id, campo.tipo]));
        const invalidos = valoresArquivo.filter((item) => item.valor && (
          tipoPorCampo.get(item.campoId) === "arquivo" || !/^https:\/\//i.test(item.valor)
        ) && !idsProprios.has(item.valor)).map((item) => item.campoId);
        if (invalidos.length) await tx.bpmCardCampoValor.deleteMany({ where: { cardId: destinoId, campoId: { in: invalidos } } });
      }
      const pendencias = await carregarCamposFaltantesCardEtapa(destinoId, pipelineId, etapaId, tx);
      if (pendencias.length) {
        const excecao = await tx.bpmCardHistorico.findFirst({
          where: { cardId: card.id, acao: "EXCECAO_LIBERACAO_OPERACIONAL" },
          orderBy: { createdAt: "desc" }, select: { id: true, usuarioId: true, valorNovoJson: true },
        });
        const autorizacao = excecao ? parseObjeto(excecao.valorNovoJson) : null;
        if (!excecao || autorizacao?.falhaExecucaoId !== execucao.id) {
          throw new Error(`Liberação ao Operacional bloqueada. Campos obrigatórios: ${pendencias.map((campo) => campo.nome).join(", ")}`);
        }
        const jaRegistrada = await tx.bpmCardHistorico.findFirst({
          where: { cardId: destinoId, acao: "LIBERACAO_OPERACIONAL_COM_EXCECAO", valorNovoJson: { contains: excecao.id } },
          select: { id: true },
        });
        if (!jaRegistrada) await tx.bpmCardHistorico.create({ data: {
          cardId: destinoId, acao: "LIBERACAO_OPERACIONAL_COM_EXCECAO", usuarioId: excecao.usuarioId,
          valorNovoJson: JSON.stringify({ autorizacaoId: excecao.id, camposDispensados: pendencias.map((campo) => ({ id: campo.id, nome: campo.nome })),
            autorizacao: excecao.valorNovoJson }),
        } });
      }
    };
    const vinculoExistente = await db.bpmCardVinculo.findFirst({
      where: { cardOrigemId: card.id, cardDestino: { pipelineId, status: { not: "ARQUIVADO" } } },
      select: { cardDestinoId: true },
    });
    if (vinculoExistente) {
      if (handoffOperacional) await db.$transaction((tx) => completarHandoff(tx, vinculoExistente.cardDestinoId));
      if (handoffFinanceiro) await db.$transaction((tx) => copiarCamposCardVinculado(tx, card.id, vinculoExistente.cardDestinoId, pipelineId, etapaId));
      return { cardId: vinculoExistente.cardDestinoId, existente: true };
    }
    // No Operacional a identidade do processo é a negociação de origem. Um
    // card ativo da mesma empresa pode corresponder a outra contratação.
    if (parametros.somenteSeNaoExistirAtivo && !handoffOperacional) {
      const existente = await db.bpmCard.findFirst({ where: { empresaId: card.empresaId, pipelineId, status: "ATIVO" }, select: { id: true } });
      if (existente && !handoffFinanceiro) {
        await db.$transaction(async (tx) => {
          if (vincular) await tx.bpmCardVinculo.upsert({ where: { cardOrigemId_cardDestinoId: { cardOrigemId: card.id, cardDestinoId: existente.id } },
            create: { cardOrigemId: card.id, cardDestinoId: existente.id }, update: {} });
          await completarHandoff(tx, existente.id);
        });
        return { cardId: existente.id, existente: true };
      }
    }
    const novo = await db.$transaction(async (tx) => {
      const criado = await tx.bpmCard.create({ data: { empresaId: card.empresaId, pipelineId, etapaId, responsavelId: Number(parametros.responsavelId ?? card.responsavelId), servico: parametros.servico ? String(parametros.servico) : card.servico, membros: { create: { userId: Number(parametros.responsavelId ?? card.responsavelId), role: "RESPONSAVEL" } } } });
      if (vincular) await tx.bpmCardVinculo.create({ data: { cardOrigemId: card.id, cardDestinoId: criado.id } });
      if (handoffFinanceiro) {
        await copiarCamposCardVinculado(tx, card.id, criado.id, pipelineId, etapaId);
      }
      if (handoffOperacional) {
        await completarHandoff(tx, criado.id);
        await tx.bpmCardHistorico.create({ data: {
          cardId: criado.id, acao: "CARD_CRIADO_POR_AUTOMACAO", automacaoOrigem: execucao.automacaoId,
          valorNovoJson: JSON.stringify({
            cardOrigemId: card.id, pipelineOrigem: card.pipeline.nome,
            negociacaoOrigemId: negociacao?.cardOrigemId ?? null,
            vendedorResponsavelId: negociacao?.cardOrigem.responsavelId ?? null,
            parceiroOrigemId: negociacao?.cardOrigem.indicacaoOrigem?.parceiroId ?? null,
          }),
        } });
      }
      await ativarCadenciasNaEntradaBpm({
        cardId: criado.id,
        pipelineAnteriorId: null,
        etapaAnteriorId: null,
        pipelineDestinoId: pipelineId,
        etapaDestinoId: etapaId,
        evento: "CARD_CRIADO",
        automacaoOrigem: execucao.automacaoId,
        agora: criado.createdAt,
      }, tx);
      return criado;
    });
    await publicarEventoBpm({ tipo: "CARD_CRIADO", entidadeTipo: "CARD", entidadeId: novo.id, cardId: novo.id, pipelineId, valorNovo: { etapaId, cardOrigemId: card.id }, atorTipo: "AUTOMACAO", atorExecucaoId: execucao.id, correlationId: execucao.correlationId ?? execucao.id, causationId: execucao.eventoId ?? execucao.id, profundidade: (execucao.evento?.profundidade ?? 0) + 1, idempotencyKey: `automacao:${execucao.id}:card-criado:${novo.id}` });
    return { cardId: novo.id };
  }
  if (tipo === "ATUALIZAR_CARD_RELACIONADO") {
    const vinculos = await db.bpmCardVinculo.findMany({ where: { OR: [{ cardOrigemId: card.id }, { cardDestinoId: card.id }] } });
    const direcao = String(parametros.direcao);
    const ids = vinculos.flatMap((v) => [
      ...(v.cardOrigemId === card.id && direcao !== "ORIGEM" ? [v.cardDestinoId] : []),
      ...(v.cardDestinoId === card.id && direcao !== "DESTINO" ? [v.cardOrigemId] : []),
    ]);
    for (const id of new Set(ids)) {
      if (parametros.campoId) await db.bpmCardCampoValor.upsert({ where: { cardId_campoId: { cardId: id, campoId: String(parametros.campoId) } }, create: { cardId: id, campoId: String(parametros.campoId), valor: parametros.valor === null ? null : String(parametros.valor) }, update: { valor: parametros.valor === null ? null : String(parametros.valor) } });
      if (parametros.etapaId || parametros.responsavelId) {
        await db.$transaction(async (tx) => {
          const atual = await tx.bpmCard.findUnique({ where: { id }, select: { pipelineId: true, etapaId: true } });
          if (!atual) throw new Error("Card relacionado não encontrado");
          const etapaDestinoId = parametros.etapaId ? String(parametros.etapaId) : atual.etapaId;
          if (parametros.etapaId) {
            const etapaValida = await tx.bpmEtapa.findFirst({ where: { id: etapaDestinoId, pipelineId: atual.pipelineId, ativo: true }, select: { id: true } });
            if (!etapaValida) throw new Error("Etapa inválida para o pipeline do card relacionado");
          }
          await tx.bpmCard.update({ where: { id }, data: { ...(parametros.etapaId ? { etapaId: etapaDestinoId } : {}), ...(parametros.responsavelId ? { responsavelId: Number(parametros.responsavelId) } : {}) } });
          if (atual.etapaId !== etapaDestinoId) {
            await ativarCadenciasNaEntradaBpm({
              cardId: id,
              pipelineAnteriorId: atual.pipelineId,
              etapaAnteriorId: atual.etapaId,
              pipelineDestinoId: atual.pipelineId,
              etapaDestinoId,
              evento: "CARD_MOVIDO",
              automacaoOrigem: execucao.automacaoId,
            }, tx);
          }
        });
      }
    }
    return { cardsAtualizados: [...new Set(ids)] };
  }
  if (tipo === "ATRIBUIR_RESPONSAVEL") {
    const responsavelId = Number(parametros.responsavelId);
    const usuario = await db.usuarios.findFirst({ where: { id: responsavelId, status: "ATIVO" }, select: { id: true } });
    if (!usuario) throw new Error("Responsável inválido");
    const anterior = card.responsavelId;
    await db.$transaction([
      db.bpmCard.update({ where: { id: card.id }, data: { responsavelId } }),
      db.bpmCardMembro.upsert({ where: { cardId_userId: { cardId: card.id, userId: responsavelId } }, create: { cardId: card.id, userId: responsavelId, role: "RESPONSAVEL" }, update: { role: "RESPONSAVEL" } }),
      db.bpmCardMembro.updateMany({ where: { cardId: card.id, role: "RESPONSAVEL", userId: { not: responsavelId } }, data: { role: "PARTICIPANTE" } }),
    ]);
    await publicarEventoDaAcao(execucao, "RESPONSAVEL_ATRIBUIDO", "MEMBRO", String(responsavelId), { responsavelId: anterior }, { responsavelId });
    return { responsavelAnteriorId: anterior, responsavelId };
  }
  if (tipo === "COMUNICACAO_EXISTENTE") {
    if (parametros.canal === "EMAIL") {
      if (!process.env.RESEND_API_KEY || !parametros.destinatario) throw new Error("Canal de e-mail não configurado");
      const resposta = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.BPM_AUTOMACOES_EMAIL_FROM ?? "Painel Alpha <onboarding@resend.dev>", to: texto(parametros.destinatario), subject: `Automação: ${execucao.automacao.nome}`, text: texto(parametros.mensagem) }, { idempotencyKey: `bpm-central:${execucao.id}` });
      if (resposta.error) throw new Error(resposta.error.message);
      return { canal: "EMAIL", messageId: resposta.data?.id ?? null };
    }
    const historico = await db.bpmCardHistorico.create({ data: { cardId: card.id, acao: "COMUNICACAO_PENDENTE", automacaoOrigem: execucao.automacaoId, valorNovoJson: JSON.stringify({ canal: parametros.canal, templateId: parametros.templateId, mensagem: texto(parametros.mensagem) }) } });
    return { canal: parametros.canal, status: "PENDENTE", historicoId: historico.id };
  }
  const resultado = await executarHttpSeguro(parametros, `bpm-central:${execucao.id}`);
  await publicarEventoDaAcao(execucao, "CHAMADA_EXTERNA_CONCLUIDA", "SISTEMA", execucao.id, undefined, { status: resultado.status });
  return resultado;
}

async function executarGrafo(execucao: ExecucaoCentral, grafo: GrafoAutomacao, contexto: ContextoAvaliacao) {
  const porId = new Map(grafo.nos.map((no) => [no.id, no]));
  const estado = parseObjeto(execucao.resultadoJson);
  let nodeId: string | null = typeof estado.proximoNodeId === "string" ? estado.proximoNodeId : grafo.inicioId;
  let ordem = execucao.passos.length;
  while (nodeId) {
    const no = porId.get(nodeId); if (!no) throw new Error(`Nó ${nodeId} não encontrado`);
    const concluido = execucao.passos.find((passo) => passo.nodeId === nodeId && passo.status === "CONCLUIDO");
    if (concluido) {
      // Nó de condição já avaliado: retoma pelo ramo escolhido na primeira
      // avaliação, em vez de encerrar o fluxo como SUCESSO sem executar o ramo.
      nodeId = no.tipo === "CONDICAO"
        ? (() => { const r = parseObjeto(concluido.resultadoJson); return typeof r.proximoNodeId === "string" ? r.proximoNodeId : null; })()
        : proximoNo(no);
      continue;
    }
    const passo = await db.bpmAutomacaoPassoExecucao.upsert({
      where: { execucaoId_nodeId: { execucaoId: execucao.id, nodeId } },
      create: { execucaoId: execucao.id, nodeId, tipo: no.tipo, ordem: ordem++, status: "EXECUTANDO", tentativas: 1, iniciadoEm: new Date() },
      update: { status: "EXECUTANDO", tentativas: { increment: 1 }, iniciadoEm: new Date(), mensagemErro: null },
    });
    try {
      if (no.tipo === "FIM") {
        await db.bpmAutomacaoPassoExecucao.update({ where: { id: passo.id }, data: { status: "CONCLUIDO", concluidoEm: new Date(), resultadoJson: "{\"fim\":true}" } });
        return { status: "SUCESSO", ultimoNodeId: nodeId };
      }
      if (no.tipo === "CONDICAO") {
        const resultado = avaliarGrupo(no.condicao, contexto); nodeId = resultado ? no.entaoId : no.senaoId;
        await db.bpmAutomacaoPassoExecucao.update({ where: { id: passo.id }, data: { status: "CONCLUIDO", concluidoEm: new Date(), resultadoJson: JSON.stringify({ resultado, proximoNodeId: nodeId }) } });
        continue;
      }
      if (no.tipo === "ESPERA") {
        const proximaExecucaoEm = new Date(Date.now() + no.minutos * 60_000);
        await db.$transaction([
          db.bpmAutomacaoAgenda.upsert({ where: { chaveAgendamento: `espera:${execucao.id}:${no.id}` }, create: { automacaoVersaoId: execucao.automacaoVersaoId!, cardId: execucao.cardId, chaveAgendamento: `espera:${execucao.id}:${no.id}`, tipo: "ESPERA", proximaExecucaoEm, timezone: execucao.automacaoVersao!.timezone, recorrenciaJson: JSON.stringify({ execucaoId: execucao.id, proximoNodeId: no.proximoId }) }, update: { proximaExecucaoEm, ativo: true } }),
          db.bpmAutomacaoPassoExecucao.update({ where: { id: passo.id }, data: { status: "CONCLUIDO", concluidoEm: new Date(), resultadoJson: JSON.stringify({ proximaExecucaoEm, proximoNodeId: no.proximoId }) } }),
          db.bpmAutomacaoExecucao.update({ where: { id: execucao.id }, data: { status: "AGUARDANDO", resultadoJson: JSON.stringify({ proximoNodeId: no.proximoId }), claimToken: null } }),
        ]);
        return { status: "AGUARDANDO", proximaExecucaoEm };
      }
      const resultado = await executarAcaoCentral(execucao, no.acaoTipo, no.parametros);
      nodeId = no.proximoId ?? "";
      await db.bpmAutomacaoPassoExecucao.update({ where: { id: passo.id }, data: { status: "CONCLUIDO", concluidoEm: new Date(), resultadoJson: JSON.stringify({ resultado, proximoNodeId: nodeId || null }) } });
    } catch (error) {
      await db.bpmAutomacaoPassoExecucao.update({ where: { id: passo.id }, data: { status: "FALHA", concluidoEm: new Date(), mensagemErro: erroMensagem(error) } });
      throw error;
    }
  }
  return { status: "SUCESSO", ultimoNodeId: null };
}

async function processarUma(id: string) {
  const token = randomUUID();
  const claim = await db.bpmAutomacaoExecucao.updateMany({ where: { id, automacaoVersaoId: { not: null }, status: "PENDENTE", disponivelEm: { lte: new Date() } }, data: { status: "EM_EXECUCAO", claimToken: token, iniciadoEm: new Date(), tentativas: { increment: 1 } } });
  if (claim.count !== 1) return "ignorada" as const;
  const execucao = await carregarExecucao(id);
  if (!execucao?.automacaoVersao || execucao.claimToken !== token) return "ignorada" as const;
  // Card arquivado (soft-delete, RM-2026-1FFBAA): não executa efeitos de
  // automação pendentes — preserva a retenção sem gerar novos eventos/ações.
  if (execucao.card.status === "ARQUIVADO") {
    await db.bpmAutomacaoExecucao.update({ where: { id }, data: { status: "IGNORADA", resultadoJson: JSON.stringify({ motivo: "CARD_ARQUIVADO" }), executadoEm: new Date(), claimToken: null } });
    return "ignorada" as const;
  }
  const recurso = `card:${execucao.cardId}`;
  if (!await adquirirLease(recurso, token)) {
    await db.bpmAutomacaoExecucao.update({ where: { id }, data: { status: "PENDENTE", claimToken: null, disponivelEm: new Date(Date.now() + 5_000) } });
    return "adiada" as const;
  }
  try {
    // Automação pausada/arquivada ou versão substituída: encerra sem efeito e
    // sem retentativas — não é uma falha operacional.
    if (!execucao.automacao.ativa || execucao.automacaoVersao.status !== "ATIVA") {
      const motivo = !execucao.automacao.ativa ? "AUTOMACAO_INATIVA" : "VERSAO_SUBSTITUIDA";
      await db.bpmAutomacaoExecucao.update({ where: { id }, data: { status: "IGNORADA", resultadoJson: JSON.stringify({ motivo }), executadoEm: new Date(), claimToken: null } });
      return "ignorada" as const;
    }
    const grafo = validarGrafoAutomacao(JSON.parse(execucao.automacaoVersao.grafoJson));
    const contexto = await montarContextoAvaliacaoDoCard(execucao.card);
    if (execucao.automacaoVersao.condicaoJson) {
      const condicao = grupoCondicaoSchema.parse(JSON.parse(execucao.automacaoVersao.condicaoJson));
      if (!avaliarGrupo(condicao, contexto)) {
        await db.bpmAutomacaoExecucao.update({ where: { id }, data: { status: "IGNORADA", resultadoJson: JSON.stringify({ motivo: "CONDICAO_NAO_ATENDIDA" }), executadoEm: new Date(), claimToken: null } });
        return "ignorada" as const;
      }
    }
    const resultado = await executarGrafo(execucao, grafo, contexto);
    if (resultado.status === "AGUARDANDO") return "adiada" as const;
    await db.bpmAutomacaoExecucao.update({ where: { id }, data: { status: "SUCESSO", resultadoJson: JSON.stringify(resultado), mensagemErro: null, executadoEm: new Date(), claimToken: null } });
    await db.bpmCardHistorico.create({ data: { cardId: execucao.cardId, acao: "AUTOMACAO_CENTRAL_EXECUTADA", automacaoOrigem: execucao.automacaoId, valorNovoJson: JSON.stringify({ execucaoId: id, versaoId: execucao.automacaoVersaoId }) } });
    return "sucesso" as const;
  } catch (error) {
    const atual = await db.bpmAutomacaoExecucao.findUnique({ where: { id }, select: { tentativas: true } });
    const tentativas = atual?.tentativas ?? LIMITE_TENTATIVAS;
    const reprocessar = tentativas < LIMITE_TENTATIVAS;
    const atraso = 30_000 * 2 ** Math.max(0, tentativas - 1);
    await db.bpmAutomacaoExecucao.update({ where: { id }, data: { status: reprocessar ? "PENDENTE" : "FALHA", mensagemErro: erroMensagem(error), claimToken: null, proximaTentativaEm: reprocessar ? new Date(Date.now() + atraso) : null, disponivelEm: reprocessar ? new Date(Date.now() + atraso) : new Date(), executadoEm: reprocessar ? null : new Date() } });
    return reprocessar ? "adiada" as const : "falha" as const;
  } finally { await liberarLease(recurso, token); }
}

export async function processarFilaAutomacoesCentraisBpm(limite = 20, filtro?: { cardId?: string }) {
  const agora = new Date();
  await db.bpmAutomacaoExecucao.updateMany({ where: { automacaoVersaoId: { not: null }, status: "EM_EXECUCAO", iniciadoEm: { lte: new Date(agora.getTime() - LEASE_MS) }, tentativas: { lt: LIMITE_TENTATIVAS } }, data: { status: "PENDENTE", claimToken: null, disponivelEm: agora } });
  const pendentes = await db.bpmAutomacaoExecucao.findMany({ where: { automacaoVersaoId: { not: null }, status: "PENDENTE", disponivelEm: { lte: agora }, tentativas: { lt: LIMITE_TENTATIVAS }, ...(filtro?.cardId ? { cardId: filtro.cardId } : {}) }, select: { id: true }, orderBy: { createdAt: "asc" }, take: Math.min(Math.max(limite, 1), 50) });
  const total = { encontrados: pendentes.length, executados: 0, falhos: 0, adiados: 0, ignorados: 0 };
  for (const item of pendentes) {
    const resultado = await processarUma(item.id);
    if (resultado === "sucesso") total.executados++; else if (resultado === "falha") total.falhos++; else if (resultado === "adiada") total.adiados++; else total.ignorados++;
  }
  return total;
}

export async function reprocessarExecucaoAutomacaoCentral(id: string) {
  return db.$transaction(async (tx) => {
    const anterior = await tx.bpmAutomacaoExecucao.findFirst({ where: { id, automacaoVersaoId: { not: null }, status: "FALHA" } });
    if (!anterior) return false;
    const resultado = parseObjeto(anterior.resultadoJson);
    const reprocessamentos = Array.isArray(resultado.reprocessamentos) ? resultado.reprocessamentos.slice(-19) : [];
    reprocessamentos.push({ solicitadoEm: new Date().toISOString(), tentativasAnteriores: anterior.tentativas, erroAnterior: anterior.mensagemErro });
    const alterada = await tx.bpmAutomacaoExecucao.updateMany({ where: { id, status: "FALHA", updatedAt: anterior.updatedAt }, data: { status: "PENDENTE", tentativas: 0, mensagemErro: null, executadoEm: null, claimToken: null, proximaTentativaEm: null, disponivelEm: new Date(), resultadoJson: JSON.stringify({ ...resultado, reprocessamentos }) } });
    if (alterada.count === 1) await tx.bpmCardHistorico.create({ data: { cardId: anterior.cardId, acao: "AUTOMACAO_REPROCESSADA", automacaoOrigem: anterior.automacaoId, valorNovoJson: JSON.stringify({ execucaoId: id, tentativasAnteriores: anterior.tentativas }) } });
    return alterada.count === 1;
  });
}
