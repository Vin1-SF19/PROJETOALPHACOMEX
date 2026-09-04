import "server-only";

import db from "@/lib/prisma";
import { resolverInicioCicloNaEtapa } from "@/lib/bpm/agendar-reuniao";
import { contarDiasUteisDecorridos } from "@/lib/bpm/novos-leads";
import { gatilhoConfigSchema } from "./central-schemas";
import { publicarEventoBpm } from "./eventos";

type Recorrencia = NonNullable<ReturnType<typeof gatilhoConfigSchema.parse>["recorrencia"]>;

function parseObjeto(valor: string | null): Record<string, unknown> {
  if (!valor) return {};
  try { const parsed = JSON.parse(valor); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; }
}

function partesNoFuso(data: Date, timezone: string) {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(data);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find((p) => p.type === tipo)?.value);
  return { ano: valor("year"), mes: valor("month"), dia: valor("day"), hora: valor("hour"), minuto: valor("minute") };
}

function instanteNoFuso(partes: { ano: number; mes: number; dia: number; hora: number; minuto: number }, timezone: string) {
  const desejado = Date.UTC(partes.ano, partes.mes - 1, partes.dia, partes.hora, partes.minuto);
  let candidato = new Date(desejado);
  for (let i = 0; i < 2; i++) {
    const local = partesNoFuso(candidato, timezone);
    const exibido = Date.UTC(local.ano, local.mes - 1, local.dia, local.hora, local.minuto);
    candidato = new Date(candidato.getTime() + desejado - exibido);
  }
  return candidato;
}

export function calcularProximaRecorrencia(config: Recorrencia, referencia = new Date(), timezone = "America/Sao_Paulo"): Date | null {
  let proxima: Date;
  if (config.tipo === "INTERVALO_HORAS") proxima = new Date(referencia.getTime() + (config.intervaloHoras ?? 1) * 3_600_000);
  else if (config.tipo === "INTERVALO_DIAS") proxima = new Date(referencia.getTime() + (config.intervaloDias ?? 1) * 86_400_000);
  else {
    const [hora, minuto] = (config.hora ?? "09:00").split(":").map(Number);
    const local = partesNoFuso(referencia, timezone);
    const calendario = new Date(Date.UTC(local.ano, local.mes - 1, local.dia, hora, minuto));
    proxima = instanteNoFuso({ ano: calendario.getUTCFullYear(), mes: calendario.getUTCMonth() + 1, dia: calendario.getUTCDate(), hora, minuto }, timezone);
    if (proxima <= referencia) calendario.setUTCDate(calendario.getUTCDate() + 1);
    if (config.tipo === "SEMANAL") while (calendario.getUTCDay() !== (config.diasSemana?.[0] ?? 1)) calendario.setUTCDate(calendario.getUTCDate() + 1);
    if (config.tipo === "DIAS_SEMANA") {
      const dias = new Set(config.diasSemana?.length ? config.diasSemana : [1, 2, 3, 4, 5]);
      while (!dias.has(calendario.getUTCDay())) calendario.setUTCDate(calendario.getUTCDate() + 1);
    }
    proxima = instanteNoFuso({ ano: calendario.getUTCFullYear(), mes: calendario.getUTCMonth() + 1, dia: calendario.getUTCDate(), hora, minuto }, timezone);
  }
  return config.ate && proxima > new Date(config.ate) ? null : proxima;
}

export async function sincronizarAgendasVersaoAutomacao(versaoId: string) {
  const versao = await db.bpmAutomacaoVersao.findUnique({ where: { id: versaoId }, include: { automacao: true } });
  if (!versao || versao.status !== "ATIVA") return { criadas: 0 };
  const config = gatilhoConfigSchema.parse(parseObjeto(versao.gatilhoConfigJson));
  if (versao.gatilhoTipo !== "RECORRENCIA_ATINGIDA" || !config.recorrencia) return { criadas: 0 };
  const etapasIds = [...new Set([...(config.etapasIds ?? []), ...(config.etapaId ? [config.etapaId] : [])])];
  const cards = await db.bpmCard.findMany({ where: { pipelineId: versao.automacao.pipelineId, status: "ATIVO", ...(config.escopo === "GLOBAL_PIPELINE" ? {} : { etapaId: { in: etapasIds.length ? etapasIds : [versao.automacao.etapaId] } }) }, select: { id: true, etapaId: true, createdAt: true } });
  const historicos = config.recorrencia.ancora === "ENTRADA_ETAPA" && cards.length
    ? await db.bpmCardHistorico.findMany({ where: { cardId: { in: cards.map((card) => card.id) }, acao: { in: ["CARD_MOVIDO", "CARD_MOVIDO_POR_AUTOMACAO", "MOVIDO_AUTOMACAO"] } }, select: { cardId: true, createdAt: true, valorNovoJson: true }, orderBy: { createdAt: "desc" } })
    : [];
  const porCard = new Map<string, typeof historicos>();
  for (const historico of historicos) porCard.set(historico.cardId, [...(porCard.get(historico.cardId) ?? []), historico]);
  let criadas = 0;
  for (const card of cards) {
    const referencia = config.recorrencia.ancora === "ENTRADA_ETAPA"
      ? resolverInicioCicloNaEtapa(card.etapaId, card.createdAt, porCard.get(card.id) ?? [])
      : new Date();
    const proxima = calcularProximaRecorrencia(config.recorrencia, referencia, versao.timezone);
    if (!proxima) continue;
    await db.bpmAutomacaoAgenda.upsert({
    where: { chaveAgendamento: `recorrencia:${versao.id}:${card.id}` },
    create: { automacaoVersaoId: versao.id, cardId: card.id, chaveAgendamento: `recorrencia:${versao.id}:${card.id}`, tipo: "RECORRENTE", proximaExecucaoEm: proxima, timezone: versao.timezone, recorrenciaJson: JSON.stringify(config.recorrencia) },
    update: { recorrenciaJson: JSON.stringify(config.recorrencia), ativo: true },
  });
    criadas++;
  }
  return { criadas };
}

export async function sincronizarAgendasAutomacoesAtivasBpm() {
  const versoes = await db.bpmAutomacaoVersao.findMany({
    where: { status: "ATIVA", gatilhoTipo: "RECORRENCIA_ATINGIDA", automacao: { ativa: true } },
    select: { id: true },
  });
  let criadas = 0;
  for (const versao of versoes) criadas += (await sincronizarAgendasVersaoAutomacao(versao.id)).criadas;
  return { versoes: versoes.length, criadas };
}

export async function materializarAgendasAutomacoesBpm(limite = 100) {
  const agora = new Date();
  const agendas = await db.bpmAutomacaoAgenda.findMany({ where: { ativo: true, proximaExecucaoEm: { lte: agora } }, include: { automacaoVersao: { include: { automacao: true } } }, orderBy: { proximaExecucaoEm: "asc" }, take: Math.min(Math.max(limite, 1), 500) });
  let materializadas = 0;
  for (const agenda of agendas) {
    if (agenda.tipo === "ESPERA") {
      const estado = parseObjeto(agenda.recorrenciaJson); const execucaoId = typeof estado.execucaoId === "string" ? estado.execucaoId : null;
      if (execucaoId) await db.bpmAutomacaoExecucao.updateMany({ where: { id: execucaoId, status: "AGUARDANDO" }, data: { status: "PENDENTE", disponivelEm: agora, resultadoJson: JSON.stringify({ proximoNodeId: estado.proximoNodeId }) } });
      await db.bpmAutomacaoAgenda.update({ where: { id: agenda.id }, data: { ativo: false, ultimaMaterializacaoEm: agora } }); materializadas++; continue;
    }
    if (!agenda.cardId || agenda.automacaoVersao.status !== "ATIVA" || !agenda.automacaoVersao.automacao.ativa) { await db.bpmAutomacaoAgenda.update({ where: { id: agenda.id }, data: { ativo: false } }); continue; }
    const ciclo = agenda.proximaExecucaoEm.toISOString();
    await publicarEventoBpm({ tipo: agenda.tipo === "RECORRENTE" ? "RECORRENCIA_ATINGIDA" : "TEMPO_NA_ETAPA_ATINGIDO", entidadeTipo: "SISTEMA", entidadeId: agenda.id, cardId: agenda.cardId, pipelineId: agenda.automacaoVersao.automacao.pipelineId, valorNovo: { agendaId: agenda.id, ciclo }, atorTipo: "SISTEMA", correlationId: `agenda:${agenda.id}:${ciclo}`, idempotencyKey: `agenda:${agenda.id}:${ciclo}` });
    const recorrencia = agenda.tipo === "RECORRENTE" ? gatilhoConfigSchema.shape.recorrencia.unwrap().parse(parseObjeto(agenda.recorrenciaJson)) : null;
    const proxima = recorrencia ? calcularProximaRecorrencia(recorrencia, agora, agenda.timezone) : null;
    await db.bpmAutomacaoAgenda.update({ where: { id: agenda.id }, data: { ultimaMaterializacaoEm: agora, ativo: Boolean(proxima), ...(proxima ? { proximaExecucaoEm: proxima } : {}) } }); materializadas++;
  }
  return { encontradas: agendas.length, materializadas };
}

export async function materializarGatilhosTemporaisBpm(limite = 100) {
  const agora = new Date();
  const [versoes, tarefas, alertas] = await Promise.all([
    db.bpmAutomacaoVersao.findMany({ where: { status: "ATIVA", gatilhoTipo: "TEMPO_NA_ETAPA_ATINGIDO", automacao: { ativa: true } }, include: { automacao: true } }),
    db.bpmTarefa.findMany({ where: { status: "PENDENTE", prazo: { lte: agora } }, include: { card: { select: { pipelineId: true } } }, take: Math.min(Math.max(limite, 1), 500) }),
    db.bpmTarefa.findMany({ where: { status: "PENDENTE", alertaEm: { lte: agora }, alertaDisparadoEm: null }, include: { card: { select: { pipelineId: true } } }, take: Math.min(Math.max(limite, 1), 500) }),
  ]);
  let criados = 0;
  for (const versao of versoes) {
    const config = gatilhoConfigSchema.parse(parseObjeto(versao.gatilhoConfigJson));
    const minutos = config.tempo?.unidade === "MINUTOS" ? config.tempo.quantidade : config.minutos ?? 60;
    const etapasIds = [...new Set([...(config.etapasIds ?? []), ...(config.etapaId ? [config.etapaId] : [])])];
    const cards = await db.bpmCard.findMany({ where: { pipelineId: versao.automacao.pipelineId, status: "ATIVO", ...(config.escopo === "GLOBAL_PIPELINE" ? {} : { etapaId: { in: etapasIds.length ? etapasIds : [versao.automacao.etapaId] } }) }, select: { id: true, pipelineId: true, etapaId: true, createdAt: true }, take: Math.min(Math.max(limite, 1), 500) });
    const historicos = cards.length ? await db.bpmCardHistorico.findMany({ where: { cardId: { in: cards.map((card) => card.id) }, acao: { in: ["CARD_MOVIDO", "CARD_MOVIDO_POR_AUTOMACAO", "MOVIDO_AUTOMACAO"] } }, select: { cardId: true, createdAt: true, valorNovoJson: true }, orderBy: { createdAt: "desc" } }) : [];
    const porCard = new Map<string, typeof historicos>();
    for (const historico of historicos) porCard.set(historico.cardId, [...(porCard.get(historico.cardId) ?? []), historico]);
    for (const card of cards) {
      const inicio = config.tempo?.ancora === "CRIACAO_CARD"
        ? card.createdAt
        : resolverInicioCicloNaEtapa(card.etapaId, card.createdAt, porCard.get(card.id) ?? []);
      const atingido = config.tempo?.unidade === "DIAS_UTEIS"
        ? contarDiasUteisDecorridos(inicio, agora) >= config.tempo.quantidade
        : config.tempo?.unidade === "DIAS_CORRIDOS"
          ? agora.getTime() - inicio.getTime() >= config.tempo.quantidade * 86_400_000
          : agora.getTime() - inicio.getTime() >= minutos * 60_000;
      if (!atingido) continue;
      const chave = `tempo-etapa:${versao.id}:${card.id}:${card.etapaId}:${inicio.getTime()}`;
      const evento = await publicarEventoBpm({ tipo: "TEMPO_NA_ETAPA_ATINGIDO", entidadeTipo: "CARD", entidadeId: card.id, cardId: card.id, pipelineId: card.pipelineId, valorNovo: { etapaId: card.etapaId, minutos, tempo: config.tempo }, atorTipo: "SISTEMA", correlationId: chave, idempotencyKey: chave });
      if (evento) criados++;
    }
  }
  for (const tarefa of tarefas) {
    const chave = `prazo-tarefa:${tarefa.id}:${tarefa.prazo?.toISOString()}`;
    const evento = await publicarEventoBpm({ tipo: "TAREFA_PRAZO_ATINGIDO", entidadeTipo: "TAREFA", entidadeId: tarefa.id, cardId: tarefa.cardId, pipelineId: tarefa.card.pipelineId, valorNovo: { tarefaId: tarefa.id, tipo: tarefa.tipo, prazo: tarefa.prazo }, atorTipo: "SISTEMA", correlationId: chave, idempotencyKey: chave });
    if (evento) criados++;
  }
  for (const tarefa of alertas) {
    const chave = `alerta-tarefa:${tarefa.id}:${tarefa.alertaEm?.toISOString()}`;
    const evento = await publicarEventoBpm({ tipo: "TAREFA_ALERTA_ATINGIDO", entidadeTipo: "TAREFA", entidadeId: tarefa.id, cardId: tarefa.cardId, pipelineId: tarefa.card.pipelineId, valorNovo: { tarefaId: tarefa.id, tipo: tarefa.tipo, alertaEm: tarefa.alertaEm }, atorTipo: "SISTEMA", correlationId: chave, idempotencyKey: chave });
    if (evento) criados++;
  }
  return { criados };
}
