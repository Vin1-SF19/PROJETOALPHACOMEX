import type {
  BpmSlaAlertaLimite,
  BpmSlaConfig,
  BpmSlaInstancia,
  BpmSlaInicioMomento,
  BpmSlaStatus,
  BpmSlaUnidade,
  Prisma,
} from "@prisma/client";

import db from "@/lib/prisma";
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { etapaEhStandbyFollowUp } from "@/lib/bpm/novos-leads";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

type ConfigPrazo = Pick<BpmSlaConfig, "quantidade" | "unidade">;
type InstanciaCalculavel = Pick<
  BpmSlaInstancia,
  "status" | "inicioContagem" | "prazoFinal" | "deadline" | "pausadoEm" | "concluidoEm"
>;
type LimiteCalculavel = Pick<
  BpmSlaAlertaLimite,
  "ativo" | "ordem" | "statusResultante" | "tipoLimite" | "unidade" | "valor"
> & { cor?: string };
type ClienteSla = Pick<
  Prisma.TransactionClient,
  "bpmCard" | "bpmTarefa" | "bpmSlaConfig" | "bpmSlaInstancia" | "bpmSlaEventoLog" | "bpmSlaDisparo" | "bpmEventoDominio"
>;

type InstanciaSlaCarregada = Prisma.BpmSlaInstanciaGetPayload<{
  include: {
    card: { select: { pipelineId: true } };
    eventos: true;
    slaConfig: { include: { alertaLimites: true } };
  };
}>;

export type StatusSlaCalculado =
  | "DENTRO_PRAZO"
  | "PROXIMO_VENCIMENTO"
  | "ATRASADO"
  | "PAUSADO"
  | "CONCLUIDO";

export type GatilhoSla = BpmSlaInicioMomento;

export interface ResumoSla {
  id: string;
  slaConfigId: string;
  nome: string;
  status: StatusSlaCalculado;
  cor: string;
  deadline: Date | null;
  tempoRestanteMs: number | null;
  pausadoEm: Date | null;
  concluidoEm: Date | null;
  statusAlterado: boolean;
  historicoPausas: Array<{
    id: string;
    statusAnterior: BpmSlaStatus | null;
    statusNovo: BpmSlaStatus;
    motivo: string | null;
    createdAt: Date;
  }>;
}

function exigirQuantidadeValida(quantidade: number): void {
  if (!Number.isInteger(quantidade) || quantidade < 0) {
    throw new Error("A quantidade do SLA deve ser um inteiro não negativo.");
  }
}

function adicionarDiasUteis(inicio: Date, quantidade: number): Date {
  const resultado = new Date(inicio);
  let restantes = quantidade;
  while (restantes > 0) {
    resultado.setUTCDate(resultado.getUTCDate() + 1);
    const dia = resultado.getUTCDay();
    if (dia !== 0 && dia !== 6) restantes -= 1;
  }
  return resultado;
}

export function calcularPrazoFinal(config: ConfigPrazo, inicioContagem: Date): Date {
  exigirQuantidadeValida(config.quantidade);
  if (Number.isNaN(inicioContagem.getTime())) throw new Error("Início de contagem inválido.");

  if (config.unidade === "DIAS_UTEIS") {
    return adicionarDiasUteis(inicioContagem, config.quantidade);
  }

  const multiplicador: Record<Exclude<BpmSlaUnidade, "DIAS_UTEIS">, number> = {
    MINUTOS: MINUTO_MS,
    HORAS: HORA_MS,
    DIAS: DIA_MS,
  };
  return new Date(inicioContagem.getTime() + config.quantidade * multiplicador[config.unidade]);
}

function limiteEmMs(valor: number, unidade: BpmSlaUnidade | null): number {
  const multiplicador: Record<BpmSlaUnidade, number> = {
    MINUTOS: MINUTO_MS,
    HORAS: HORA_MS,
    DIAS: DIA_MS,
    DIAS_UTEIS: DIA_MS,
  };
  return valor * multiplicador[unidade ?? "MINUTOS"];
}

function limiteAtingido(
  limite: LimiteCalculavel,
  inicioMs: number,
  deadlineMs: number,
  agoraMs: number,
): boolean {
  if (limite.tipoLimite === "PERCENTUAL_CONSUMIDO") {
    const duracao = Math.max(1, deadlineMs - inicioMs);
    return ((agoraMs - inicioMs) / duracao) * 100 >= limite.valor;
  }
  if (limite.tipoLimite === "TEMPO_RESTANTE") {
    return deadlineMs - agoraMs <= limiteEmMs(limite.valor, limite.unidade);
  }
  return agoraMs - deadlineMs >= limiteEmMs(limite.valor, limite.unidade);
}

export function calcularStatusSla(
  instancia: InstanciaCalculavel,
  limites: LimiteCalculavel | readonly LimiteCalculavel[],
  agora = new Date(),
): StatusSlaCalculado {
  if (instancia.concluidoEm || instancia.status === "CONCLUIDO") return "CONCLUIDO";
  if (instancia.pausadoEm || instancia.status === "PAUSADO") return "PAUSADO";

  const deadline = instancia.deadline ?? instancia.prazoFinal;
  const inicio = instancia.inicioContagem;
  if (!deadline || !inicio) return "DENTRO_PRAZO";

  const agoraMs = agora.getTime();
  const deadlineMs = deadline.getTime();
  if (agoraMs > deadlineMs) return "ATRASADO";

  const candidatos = (Array.isArray(limites) ? limites : [limites])
    .filter((limite) => limite.ativo && limite.statusResultante === "PROXIMO_VENCIMENTO")
    .sort((a, b) => a.ordem - b.ordem);
  return candidatos.some((limite) => limiteAtingido(limite, inicio.getTime(), deadlineMs, agoraMs))
    ? "PROXIMO_VENCIMENTO"
    : "DENTRO_PRAZO";
}

function normalizar(valor: string | null | undefined): string {
  return valor?.trim().toLocaleLowerCase("pt-BR") ?? "";
}

function condicaoConfigAtendida(config: BpmSlaConfig, card: {
  id: string;
  pipelineId: string;
  etapaId: string;
  responsavelId: number | null;
  servico: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  concluidoEm: Date | null;
  primeiraVisualizacaoEm: Date | null;
  proximoContatoEm: Date | null;
  dataReuniao: Date | null;
  statusPosFechamento: string | null;
  pipeline: { nome: string };
  etapa: { nome: string };
}): boolean {
  if (!config.condicaoRegraJson) return true;
  try {
    const parsed = grupoCondicaoSchema.safeParse(JSON.parse(config.condicaoRegraJson));
    if (!parsed.success) return false;
    return avaliarGrupo(parsed.data, {
      card,
      processo: {
        pipelineId: card.pipelineId,
        pipelineNome: card.pipeline.nome,
        etapaDestinoId: card.etapaId,
        etapaDestinoNome: card.etapa.nome,
        origemMovimentacao: "SLA",
      },
      contratacao: { servico: card.servico },
    });
  } catch {
    return false;
  }
}

async function resolverConfiguracaoAplicavel(
  alvo: { cardId?: string; tarefaId?: string },
  gatilho: GatilhoSla,
  client: ClienteSla,
): Promise<{ config: BpmSlaConfig; cardId: string } | null> {
  const tarefa = alvo.tarefaId
    ? await client.bpmTarefa.findUnique({ where: { id: alvo.tarefaId }, select: { id: true, cardId: true, tipo: true } })
    : null;
  const cardId = alvo.cardId ?? tarefa?.cardId;
  if (!cardId) return null;
  const card = await client.bpmCard.findUnique({
    where: { id: cardId },
    select: {
      id: true, pipelineId: true, etapaId: true, responsavelId: true, servico: true,
      status: true, createdAt: true, updatedAt: true, concluidoEm: true,
      primeiraVisualizacaoEm: true, proximoContatoEm: true, dataReuniao: true,
      statusPosFechamento: true, pipeline: { select: { nome: true } },
      etapa: { select: { nome: true } },
    },
  });
  if (!card) return null;

  const candidatas = await client.bpmSlaConfig.findMany({
    where: {
      ativa: true,
      inicioMomento: gatilho,
      AND: [
        { OR: [{ pipelineId: null }, { pipelineId: card.pipelineId }] },
        { OR: [{ etapaId: null }, { etapaId: card.etapaId }] },
        { OR: [{ tipoTarefa: null }, { tipoTarefa: tarefa?.tipo ?? "__SEM_TAREFA__" }] },
      ],
    },
    include: { servicoCatalogo: { select: { nome: true } } },
    orderBy: [{ prioridade: "desc" }, { createdAt: "asc" }],
  });

  const config = candidatas
    .filter((item) => !item.servicoId || normalizar(item.servicoCatalogo?.nome) === normalizar(card.servico))
    .filter((item) => !item.tipoProcesso || normalizar(item.tipoProcesso) === normalizar(card.pipeline.nome))
    .filter((item) => condicaoConfigAtendida(item, card))
    .sort((a, b) => {
      const especificidade = (item: BpmSlaConfig) =>
        [item.pipelineId, item.etapaId, item.servicoId, item.tipoProcesso, item.tipoTarefa, item.condicaoRegraJson]
          .filter(Boolean).length;
      return b.prioridade - a.prioridade || especificidade(b) - especificidade(a);
    })[0];
  return config ? { config, cardId } : null;
}

function erroUnicidade(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function criarSlaInstancia(
  alvo: { cardId?: string; tarefaId?: string },
  gatilho: GatilhoSla,
  client: ClienteSla,
  agora = new Date(),
) {
  if (!(client as unknown as { bpmCard?: { findUnique?: unknown }; bpmSlaConfig?: { findMany?: unknown } }).bpmCard?.findUnique
    || !(client as unknown as { bpmSlaConfig?: { findMany?: unknown } }).bpmSlaConfig?.findMany) {
    if (process.env.NODE_ENV === "test") return null;
    throw new Error("Persistência de SLA indisponível");
  }
  const aplicavel = await resolverConfiguracaoAplicavel(alvo, gatilho, client);
  if (!aplicavel) return null;
  const existente = await client.bpmSlaInstancia.findFirst({
    where: {
      slaConfigId: aplicavel.config.id,
      ...(alvo.tarefaId ? { tarefaId: alvo.tarefaId } : { cardId: aplicavel.cardId, tarefaId: null }),
    },
    include: { slaConfig: { include: { alertaLimites: true } } },
  });
  if (existente) return existente;

  const prazoFinal = calcularPrazoFinal(aplicavel.config, agora);
  try {
    const criada = await client.bpmSlaInstancia.create({
      data: {
        cardId: aplicavel.cardId,
        tarefaId: alvo.tarefaId,
        slaConfigId: aplicavel.config.id,
        status: "DENTRO_PRAZO",
        inicioContagem: agora,
        prazoFinal,
        deadline: prazoFinal,
        eventos: {
          create: { statusNovo: "DENTRO_PRAZO", motivo: gatilho, origem: "SISTEMA" },
        },
      },
      include: { slaConfig: { include: { alertaLimites: true } } },
    });
    return criada;
  } catch (error) {
    if (!erroUnicidade(error)) throw error;
    return client.bpmSlaInstancia.findFirst({
      where: {
        slaConfigId: aplicavel.config.id,
        ...(alvo.tarefaId ? { tarefaId: alvo.tarefaId } : { cardId: aplicavel.cardId, tarefaId: null }),
      },
      include: { slaConfig: { include: { alertaLimites: true } } },
    });
  }
}

async function pausarComCliente(
  instanciaId: string,
  motivo: string,
  client: ClienteSla,
  agora: Date,
) {
  const instancia = await client.bpmSlaInstancia.findUnique({ where: { id: instanciaId } });
  if (!instancia || instancia.pausadoEm || ["PAUSADO", "CONCLUIDO", "CANCELADO"].includes(instancia.status)) {
    return instancia;
  }
  const atualizada = await client.bpmSlaInstancia.updateMany({
    where: { id: instanciaId, status: instancia.status, pausadoEm: null, updatedAt: instancia.updatedAt },
    data: { statusAnterior: instancia.status, status: "PAUSADO", pausadoEm: agora },
  });
  if (atualizada.count !== 1) return client.bpmSlaInstancia.findUnique({ where: { id: instanciaId } });
  await client.bpmSlaEventoLog.create({
    data: { instanciaId, statusAnterior: instancia.status, statusNovo: "PAUSADO", motivo, origem: "SISTEMA" },
  });
  return client.bpmSlaInstancia.findUnique({ where: { id: instanciaId } });
}

async function retomarComCliente(instanciaId: string, client: ClienteSla, agora: Date) {
  const instancia = await client.bpmSlaInstancia.findUnique({ where: { id: instanciaId } });
  if (!instancia || !instancia.pausadoEm || instancia.status !== "PAUSADO") return instancia;
  const pausaMs = Math.max(0, agora.getTime() - instancia.pausadoEm.getTime());
  const novoPrazo = instancia.prazoFinal ? new Date(instancia.prazoFinal.getTime() + pausaMs) : null;
  const novoDeadline = instancia.deadline ? new Date(instancia.deadline.getTime() + pausaMs) : novoPrazo;
  const statusRetomado = instancia.statusAnterior && !["PAUSADO", "CONCLUIDO", "CANCELADO"].includes(instancia.statusAnterior)
    ? instancia.statusAnterior
    : "DENTRO_PRAZO";
  const atualizada = await client.bpmSlaInstancia.updateMany({
    where: { id: instanciaId, status: "PAUSADO", pausadoEm: instancia.pausadoEm, updatedAt: instancia.updatedAt },
    data: {
      status: statusRetomado,
      statusAnterior: "PAUSADO",
      pausadoEm: null,
      tempoPausadoAcumuladoMs: instancia.tempoPausadoAcumuladoMs + BigInt(pausaMs),
      prazoFinal: novoPrazo,
      deadline: novoDeadline,
    },
  });
  if (atualizada.count !== 1) return client.bpmSlaInstancia.findUnique({ where: { id: instanciaId } });
  await client.bpmSlaEventoLog.create({
    data: { instanciaId, statusAnterior: "PAUSADO", statusNovo: statusRetomado, motivo: "RETOMADA", origem: "SISTEMA" },
  });
  return client.bpmSlaInstancia.findUnique({ where: { id: instanciaId } });
}

export async function pausarSla(instanciaId: string, motivo: string, agora = new Date()) {
  return db.$transaction((tx) => pausarComCliente(instanciaId, motivo, tx, agora));
}

export async function retomarSla(instanciaId: string, agora = new Date()) {
  return db.$transaction((tx) => retomarComCliente(instanciaId, tx, agora));
}

async function concluirInstanciasEtapa(
  cardId: string,
  etapaId: string,
  client: ClienteSla,
  agora: Date,
  preservarPausaveis = false,
): Promise<void> {
  const instancias = await client.bpmSlaInstancia.findMany({
    where: {
      cardId,
      concluidoEm: null,
      status: { notIn: ["CONCLUIDO", "CANCELADO"] },
      slaConfig: { etapaId },
    },
    select: {
      id: true,
      status: true,
      slaConfig: { select: { pausaCondicaoJson: true } },
    },
  });
  for (const instancia of instancias) {
    if (preservarPausaveis && instancia.slaConfig.pausaCondicaoJson?.includes("STANDBY")) {
      continue;
    }
    const atualizada = await client.bpmSlaInstancia.updateMany({
      where: { id: instancia.id, status: instancia.status, concluidoEm: null },
      data: { statusAnterior: instancia.status, status: "CONCLUIDO", concluidoEm: agora, pausadoEm: null },
    });
    if (atualizada.count === 1) {
      await client.bpmSlaEventoLog.create({
        data: { instanciaId: instancia.id, statusAnterior: instancia.status, statusNovo: "CONCLUIDO", motivo: "SAIDA_ETAPA", origem: "SISTEMA" },
      });
    }
  }
}

export async function sincronizarSlaMovimentoBpm(input: {
  cardId: string;
  etapaOrigemId: string;
  etapaOrigemNome: string;
  etapaDestinoNome: string;
  client: ClienteSla;
  agora?: Date;
}): Promise<void> {
  if (!(input.client as unknown as { bpmSlaInstancia?: { findMany?: unknown } }).bpmSlaInstancia?.findMany) {
    if (process.env.NODE_ENV === "test") return;
    throw new Error("Persistência de SLA indisponível");
  }
  const agora = input.agora ?? new Date();
  const entrouStandby = !etapaEhStandbyFollowUp(input.etapaOrigemNome)
    && etapaEhStandbyFollowUp(input.etapaDestinoNome);
  const saiuStandby = etapaEhStandbyFollowUp(input.etapaOrigemNome)
    && !etapaEhStandbyFollowUp(input.etapaDestinoNome);

  await concluirInstanciasEtapa(
    input.cardId,
    input.etapaOrigemId,
    input.client,
    agora,
    entrouStandby,
  );

  if (saiuStandby) {
    const pausadas = await input.client.bpmSlaInstancia.findMany({
      where: { cardId: input.cardId, status: "PAUSADO", concluidoEm: null },
      select: { id: true },
    });
    for (const instancia of pausadas) await retomarComCliente(instancia.id, input.client, agora);
  }

  const criada = await criarSlaInstancia({ cardId: input.cardId }, "ENTRADA_ETAPA", input.client, agora);
  if (entrouStandby) {
    const ativas = await input.client.bpmSlaInstancia.findMany({
      where: {
        cardId: input.cardId,
        status: { notIn: ["PAUSADO", "CONCLUIDO", "CANCELADO"] },
        concluidoEm: null,
        slaConfig: { pausaCondicaoJson: { contains: "STANDBY" } },
      },
      select: { id: true },
    });
    for (const instancia of ativas) await pausarComCliente(instancia.id, "ENTRADA_STANDBY", input.client, agora);
  } else if (criada?.status === "PAUSADO") {
    await retomarComCliente(criada.id, input.client, agora);
  }
}

function corStatusSla(instancia: InstanciaSlaCarregada, status: StatusSlaCalculado): string {
  const limite = instancia.slaConfig.alertaLimites.find(
    (item) => item.ativo && item.statusResultante === status,
  );
  if (limite?.cor) return limite.cor;
  if (status === "PAUSADO") return "AZUL";
  if (status === "CONCLUIDO") return "VERDE";
  return "VERDE";
}

async function registrarDisparoStatus(
  instancia: InstanciaSlaCarregada,
  status: StatusSlaCalculado,
  client: ClienteSla,
  agora: Date,
): Promise<void> {
  const tipoDisparo = status === "PROXIMO_VENCIMENTO"
    ? "ALERTA_PROXIMO"
    : status === "ATRASADO"
      ? "ALERTA_VENCIDO"
      : null;
  if (!tipoDisparo) return;
  try {
    await client.bpmSlaDisparo.create({
      data: {
        instanciaId: instancia.id,
        slaConfigId: instancia.slaConfigId,
        cardId: instancia.cardId,
        tipoDisparo,
        disparadoEm: agora,
      },
    });
    await client.bpmSlaInstancia.update({
      where: { id: instancia.id },
      data: status === "PROXIMO_VENCIMENTO"
        ? { alertaPrazoEm: agora, alertaPrazoDisparadoEm: agora }
        : { vencidoEm: instancia.vencidoEm ?? agora },
    });
  } catch (error) {
    if (!erroUnicidade(error)) throw error;
  }
}

async function processarInstanciaSla(
  instancia: InstanciaSlaCarregada,
  client: ClienteSla,
  agora: Date,
): Promise<ResumoSla> {
  const status = calcularStatusSla(instancia, instancia.slaConfig.alertaLimites, agora);
  const deadline = instancia.deadline ?? instancia.prazoFinal;
  const referencia = instancia.pausadoEm ?? agora;
  const tempoRestanteMs = deadline ? deadline.getTime() - referencia.getTime() : null;
  let statusAlterado = false;

  if (status !== instancia.status && !["PAUSADO", "CONCLUIDO", "CANCELADO"].includes(instancia.status)) {
    const statusAnterior = instancia.status;
    const atualizada = await client.bpmSlaInstancia.updateMany({
      where: { id: instancia.id, status: statusAnterior, updatedAt: instancia.updatedAt },
      data: {
        status,
        statusAnterior,
        ...(status === "ATRASADO" && !instancia.vencidoEm ? { vencidoEm: agora } : {}),
      },
    });
    if (atualizada.count === 1) {
      statusAlterado = true;
      const evento = await client.bpmSlaEventoLog.create({
        data: {
          instanciaId: instancia.id,
          statusAnterior,
          statusNovo: status,
          motivo: "RECALCULO_LEITURA",
          origem: "SISTEMA",
        },
      });
      await registrarDisparoStatus(instancia, status, client, agora);
      if (instancia.cardId && instancia.card?.pipelineId) {
        await publicarEventoBpm({
          tipo: "SLA_STATUS_ALTERADO",
          entidadeTipo: "SLA",
          entidadeId: instancia.id,
          cardId: instancia.cardId,
          pipelineId: instancia.card.pipelineId,
          valorAnterior: { status: statusAnterior },
          valorNovo: {
            status,
            slaConfigId: instancia.slaConfigId,
            deadline,
          },
          atorTipo: "SISTEMA",
          correlationId: `sla:${instancia.id}`,
          idempotencyKey: `sla-evento:${evento.id}`,
          ocorridoEm: agora,
        }, client);
      }
    }
  }

  return {
    id: instancia.id,
    slaConfigId: instancia.slaConfigId,
    nome: instancia.slaConfig.nome,
    status,
    cor: corStatusSla(instancia, status),
    deadline,
    tempoRestanteMs,
    pausadoEm: instancia.pausadoEm,
    concluidoEm: instancia.concluidoEm,
    statusAlterado,
    historicoPausas: instancia.eventos
      .filter((evento) => evento.statusNovo === "PAUSADO" || evento.statusAnterior === "PAUSADO")
      .map((evento) => ({
        id: evento.id,
        statusAnterior: evento.statusAnterior,
        statusNovo: evento.statusNovo,
        motivo: evento.motivo,
        createdAt: evento.createdAt,
      })),
  };
}

const includeStatusSla = {
  card: { select: { pipelineId: true } },
  eventos: { orderBy: { createdAt: "desc" as const } },
  slaConfig: {
    include: {
      alertaLimites: {
        where: { ativo: true },
        orderBy: { ordem: "asc" as const },
      },
    },
  },
} satisfies Prisma.BpmSlaInstanciaInclude;

async function obterStatusSlaComCliente(
  alvo: { cardId?: string; tarefaId?: string },
  client: ClienteSla,
  agora: Date,
): Promise<ResumoSla[]> {
  const instancias = await client.bpmSlaInstancia.findMany({
    where: alvo.tarefaId ? { tarefaId: alvo.tarefaId } : { cardId: alvo.cardId },
    include: includeStatusSla,
    orderBy: { createdAt: "desc" },
  });
  const resultados: ResumoSla[] = [];
  for (const instancia of instancias) {
    resultados.push(await processarInstanciaSla(instancia, client, agora));
  }
  return resultados;
}

export async function obterStatusSla(
  alvo: { cardId?: string; tarefaId?: string },
  client?: ClienteSla,
  agora = new Date(),
): Promise<ResumoSla[]> {
  if (client) return obterStatusSlaComCliente(alvo, client, agora);
  return db.$transaction((tx) => obterStatusSlaComCliente(alvo, tx, agora));
}

export async function obterStatusSlaCards(
  cardIds: readonly string[],
  agora = new Date(),
): Promise<Map<string, ResumoSla[]>> {
  const unicos = [...new Set(cardIds.filter(Boolean))];
  const porCard = new Map(unicos.map((cardId) => [cardId, [] as ResumoSla[]]));
  if (unicos.length === 0) return porCard;

  return db.$transaction(async (tx) => {
    const instancias = await tx.bpmSlaInstancia.findMany({
      where: { cardId: { in: unicos } },
      include: includeStatusSla,
      orderBy: { createdAt: "desc" },
    });
    for (const instancia of instancias) {
      if (!instancia.cardId) continue;
      const lista = porCard.get(instancia.cardId) ?? [];
      lista.push(await processarInstanciaSla(instancia, tx, agora));
      porCard.set(instancia.cardId, lista);
    }
    return porCard;
  });
}

export function prioridadeStatusSla(status: StatusSlaCalculado): number {
  const prioridades: Record<StatusSlaCalculado, number> = {
    ATRASADO: 5,
    PROXIMO_VENCIMENTO: 4,
    PAUSADO: 3,
    DENTRO_PRAZO: 2,
    CONCLUIDO: 1,
  };
  return prioridades[status];
}

export function statusPersistivel(status: StatusSlaCalculado): BpmSlaStatus {
  return status;
}
