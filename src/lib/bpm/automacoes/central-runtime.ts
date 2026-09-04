import "server-only";

import { randomUUID } from "node:crypto";
import { Resend } from "resend";

import db from "@/lib/prisma";
import { calcularPrazoFinal } from "@/lib/bpm/sla";
import { carregarCamposObrigatoriosEtapa, verificarTransicaoPermitidaBpm } from "@/lib/bpm/requisitos-etapa-server";
import { listarCamposObrigatoriosFaltantes } from "@/lib/bpm/requisitos-etapa";
import { calcularDiaCicloNovosLeads, contarDiasUteisDecorridos, intervaloDiaCivilSaoPaulo } from "@/lib/bpm/novos-leads";
import { sincronizarTranscricaoCardBpm } from "@/lib/bpm/transcricao-reuniao-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { montarContextoAvaliacaoDoCard } from "@/lib/bpm/regras/contexto";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";
import type { ContextoAvaliacao } from "@/lib/bpm/regras/types";
import { executarHttpSeguro } from "./safe-http";
import { publicarEventoBpm } from "./eventos";
import { validarGrafoAutomacao, validarParametrosAcaoCentral, type GrafoAutomacao, type NoAutomacao, type TipoAcaoCentral } from "./central-schemas";
import { executarAcaoLegadaNoMotorCentral } from "./executor";
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
          responsavel: { select: { nome: true } }, pipeline: { select: { nome: true } }, etapa: { select: { nome: true } },
        },
      },
    },
  });
}

function proximoNo(no: NoAutomacao): string | null {
  return no.tipo === "ACAO" ? no.proximoId ?? null : no.tipo === "ESPERA" ? no.proximoId : null;
}

async function publicarEventoDaAcao(execucao: ExecucaoCentral, tipo: Parameters<typeof publicarEventoBpm>[0] extends never ? never : string, entidadeTipo: string, entidadeId: string, anterior?: unknown, novo?: unknown) {
  const eventoPai = execucao.evento;
  await publicarEventoBpm({
    tipo, entidadeTipo, entidadeId, cardId: execucao.cardId, pipelineId: execucao.card.pipelineId,
    valorAnterior: anterior, valorNovo: novo, atorTipo: "AUTOMACAO", atorExecucaoId: execucao.id,
    correlationId: execucao.correlationId ?? eventoPai?.correlationId ?? execucao.id,
    causationId: eventoPai?.id ?? execucao.id, profundidade: (eventoPai?.profundidade ?? 0) + 1,
    idempotencyKey: `automacao:${execucao.id}:${entidadeTipo}:${entidadeId}:${tipo}`,
  });
}

async function executarAcaoCentral(execucao: ExecucaoCentral, tipo: TipoAcaoCentral, bruto: unknown) {
  const parametros = validarParametrosAcaoCentral(tipo, bruto) as Record<string, unknown>;
  const card = execucao.card;
  if (["ENVIAR_EMAIL", "GERAR_CONTRATO", "GERAR_FICHA", "MATERIALIZAR_CHECKLIST", "DISTRIBUIR_RESPONSAVEL", "IDENTIFICAR_OPORTUNIDADE"].includes(tipo)) {
    return executarAcaoLegadaNoMotorCentral({
      execucaoId: execucao.id, automacaoId: execucao.automacaoId, automacaoNome: execucao.automacao.nome,
      criadoPorId: execucao.automacao.criadoPorId, cardId: card.id, gatilhoTipo: execucao.gatilhoTipo,
      automacaoEtapaId: execucao.automacao.etapaId, acaoTipo: tipo as AcaoAutomacaoBpm, parametros,
    });
  }
  if (tipo === "ALTERAR_CAMPO") {
    const campoId = String(parametros.campoId); const valor = parametros.valor === null ? null : String(parametros.valor);
    const campo = await db.bpmCampo.findFirst({ where: { id: campoId, pipelineId: card.pipelineId }, select: { id: true } });
    if (!campo) throw new Error("Campo não pertence ao pipeline do card");
    const anterior = await db.bpmCardCampoValor.findUnique({ where: { cardId_campoId: { cardId: card.id, campoId } } });
    await db.bpmCardCampoValor.upsert({ where: { cardId_campoId: { cardId: card.id, campoId } }, create: { cardId: card.id, campoId, valor }, update: { valor } });
    await publicarEventoDaAcao(execucao, "CAMPO_ALTERADO", "CAMPO", campoId, { campoId, valor: anterior?.valor ?? null }, { campoId, valor });
    return { campoId, valor };
  }
  if (tipo === "MOVER_CARD") {
    const etapaId = String(parametros.etapaId);
    const etapa = await db.bpmEtapa.findFirst({ where: { id: etapaId, pipelineId: card.pipelineId, ativo: true }, select: { id: true } });
    if (!etapa) throw new Error("Etapa de destino inválida");
    const anterior = card.etapaId;
    if (parametros.exigirProximoContatoVazio && card.proximoContatoEm) return { ignorada: true, motivo: "PROXIMO_CONTATO_PREENCHIDO" };
    if (parametros.validarRequisitos !== false && anterior !== etapaId) {
      const transicao = await verificarTransicaoPermitidaBpm(anterior, etapaId, "AUTOMACAO");
      if (!transicao.permitida) return { ignorada: true, motivo: transicao.motivo ?? "TRANSICAO_NAO_PERMITIDA" };
      const obrigatorios = await carregarCamposObrigatoriosEtapa(card.pipelineId, anterior);
      if (obrigatorios.length) {
        const valores = await db.bpmCardCampoValor.findMany({ where: { cardId: card.id, campoId: { in: obrigatorios.map((campo) => campo.id) } }, select: { campoId: true, valor: true } });
        const faltantes = listarCamposObrigatoriosFaltantes(obrigatorios, Object.fromEntries(valores.map((valor) => [valor.campoId, valor.valor])));
        if (faltantes.length) return { ignorada: true, motivo: "CAMPOS_OBRIGATORIOS", campos: faltantes.map((campo) => campo.nome) };
      }
    }
    if (anterior !== etapaId) {
      await db.$transaction([
        db.bpmCard.update({ where: { id: card.id }, data: { etapaId } }),
        db.bpmCardHistorico.create({ data: { cardId: card.id, acao: "MOVIDO_AUTOMACAO", automacaoOrigem: execucao.automacaoId, valorAnteriorJson: JSON.stringify({ etapaId: anterior }), valorNovoJson: JSON.stringify({ etapaId, execucaoId: execucao.id }) } }),
      ]);
      await publicarEventoDaAcao(execucao, "CARD_MOVIDO", "CARD", card.id, { etapaId: anterior }, { etapaId });
      await notificarPipelineBpm({ pipelineId: card.pipelineId, cardId: card.id, tipo: "CARD_MOVIDO" });
    }
    return { etapaAnteriorId: anterior, etapaId };
  }
  if (tipo === "ALTERAR_SUBSTATUS") {
    const subStatusId = String(parametros.subStatusId);
    const sub = await db.bpmSubStatus.findFirst({ where: { id: subStatusId, etapaId: card.etapaId, ativo: true }, select: { id: true, nome: true } });
    if (!sub) throw new Error("Substatus inválido para a etapa atual");
    await db.bpmCardHistorico.create({ data: { cardId: card.id, acao: "SUBSTATUS_ALTERADO", automacaoOrigem: execucao.automacaoId, valorNovoJson: JSON.stringify({ subStatusId: sub.id, nome: sub.nome, execucaoId: execucao.id }) } });
    await publicarEventoDaAcao(execucao, "CARD_ATUALIZADO", "CARD", card.id, undefined, { subStatusId: sub.id, subStatusNome: sub.nome });
    return sub;
  }
  if (tipo === "CRIAR_TAREFA") {
    const interromperSeCampo = parametros.interromperSeCampoPreenchido;
    if (interromperSeCampo === "standbyFollowUpInterrompidoEm" && card.standbyFollowUpInterrompidoEm) return { ignorada: true, motivo: "FOLLOW_UP_INTERROMPIDO" };
    if (interromperSeCampo === "proximoContatoEm" && card.proximoContatoEm) return { ignorada: true, motivo: "PROXIMO_CONTATO_PREENCHIDO" };
    const responsavelId = Number(parametros.responsavelId ?? card.responsavelId);
    const temPrazo = parametros.prazoMinutos !== undefined;
    const prazoMinutos = Number(parametros.prazoMinutos ?? 0);
    const alertaMinutos = parametros.alertaMinutos === undefined ? null : Number(parametros.alertaMinutos);
    if (parametros.naoDuplicarPendenteTipo) {
      const existente = await db.bpmTarefa.findFirst({ where: { cardId: card.id, tipo: String(parametros.tipo), status: "PENDENTE" }, select: { id: true } });
      if (existente) return { tarefaId: existente.id, existente: true };
    }
    const agora = new Date();
    const tarefa = await db.$transaction(async (tx) => {
      if (parametros.registrarExecucaoEmCampo === "standbyFollowUpUltimoEm") {
        await tx.bpmCard.update({ where: { id: card.id }, data: { standbyFollowUpUltimoEm: agora } });
      }
      return tx.bpmTarefa.create({ data: {
        cardId: card.id, titulo: String(parametros.titulo), descricao: parametros.descricao ? String(parametros.descricao) : null,
        responsavelId, prazo: temPrazo ? new Date(agora.getTime() + prazoMinutos * 60_000) : null,
        alertaEm: alertaMinutos === null ? null : new Date(agora.getTime() + alertaMinutos * 60_000),
        tipo: String(parametros.tipo), prioridade: String(parametros.prioridade),
      } });
    });
    await publicarEventoDaAcao(execucao, "TAREFA_CRIADA", "TAREFA", tarefa.id, undefined, { tarefaId: tarefa.id, tipo: tarefa.tipo, titulo: tarefa.titulo });
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
    const preencher = (modelo: string, indice: number) => modelo
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
    const historico = await db.bpmCardHistorico.create({ data: { cardId: card.id, acao, automacaoOrigem: execucao.automacaoId, valorNovoJson: JSON.stringify({ texto: parametros.texto, execucaoId: execucao.id }) } });
    return { historicoId: historico.id };
  }
  if (tipo === "CRIAR_CARD_OUTRO_PIPELINE") {
    const pipelineId = String(parametros.pipelineId); const etapaId = String(parametros.etapaId);
    const etapa = await db.bpmEtapa.findFirst({ where: { id: etapaId, pipelineId, ativo: true }, select: { id: true } });
    if (!etapa) throw new Error("Pipeline/etapa de destino inválidos");
    if (parametros.somenteSeNaoExistirAtivo) {
      const existente = await db.bpmCard.findFirst({ where: { empresaId: card.empresaId, pipelineId, status: "ATIVO" }, select: { id: true } });
      if (existente) return { cardId: existente.id, existente: true };
    }
    const novo = await db.bpmCard.create({ data: { empresaId: card.empresaId, pipelineId, etapaId, responsavelId: Number(parametros.responsavelId ?? card.responsavelId), servico: parametros.servico ? String(parametros.servico) : card.servico, membros: { create: { userId: Number(parametros.responsavelId ?? card.responsavelId), role: "RESPONSAVEL" } } } });
    if (parametros.vincularAoOriginal !== false) await db.bpmCardVinculo.create({ data: { cardOrigemId: card.id, cardDestinoId: novo.id } });
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
      if (parametros.etapaId || parametros.responsavelId) await db.bpmCard.update({ where: { id }, data: { ...(parametros.etapaId ? { etapaId: String(parametros.etapaId) } : {}), ...(parametros.responsavelId ? { responsavelId: Number(parametros.responsavelId) } : {}) } });
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
      const resposta = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.BPM_AUTOMACOES_EMAIL_FROM ?? "Painel Alpha <onboarding@resend.dev>", to: String(parametros.destinatario), subject: `Automação: ${execucao.automacao.nome}`, text: String(parametros.mensagem) }, { idempotencyKey: `bpm-central:${execucao.id}` });
      if (resposta.error) throw new Error(resposta.error.message);
      return { canal: "EMAIL", messageId: resposta.data?.id ?? null };
    }
    const historico = await db.bpmCardHistorico.create({ data: { cardId: card.id, acao: "COMUNICACAO_PENDENTE", automacaoOrigem: execucao.automacaoId, valorNovoJson: JSON.stringify({ canal: parametros.canal, templateId: parametros.templateId, mensagem: parametros.mensagem }) } });
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
    if (concluido) { nodeId = proximoNo(no); continue; }
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
  const recurso = `card:${execucao.cardId}`;
  if (!await adquirirLease(recurso, token)) {
    await db.bpmAutomacaoExecucao.update({ where: { id }, data: { status: "PENDENTE", claimToken: null, disponivelEm: new Date(Date.now() + 5_000) } });
    return "adiada" as const;
  }
  try {
    if (!execucao.automacao.ativa || execucao.automacaoVersao.status !== "ATIVA") throw new Error("Automação ou versão não está ativa");
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
