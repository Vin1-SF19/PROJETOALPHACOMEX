"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { exigirAcessoBpmCard, usuarioElegivelResponsavelBpm } from "@/lib/bpm/ownership";
import { DIRETOR_OPERACIONAL_VITOR_ID, PIPELINE_OPERACIONAL_ATIVO_ID, etapaEhBoasVindas, podeAgirBoasVindasOperacional } from "@/lib/bpm/boas-vindas";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import {
  criarEventoNoCalendario,
} from "@/actions/google-calendar-eventos";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { executarAutomacoesCentraisDoCardAgora } from "@/lib/bpm/automacoes/orquestrador";
import {
  atualizarEventoParcial as atualizarEventoParcialGoogle,
  cancelarEvento as cancelarEventoGoogle,
  obterEvento as obterEventoGoogle,
} from "@/lib/google-calendar/client";
import {
  obterUsuarioGoogleAtivo,
  obterUsuarioGoogleAtivoPorCalendario,
} from "@/lib/google-calendar/usuario-google";
import { dadosCacheDeEvento } from "@/lib/google-calendar/cache-eventos";
import { GoogleCalendarError } from "@/lib/google-calendar/errors";
import { cancelarCriacaoSemVinculo, registrarCompensacaoGooglePendente, reverterReagendamentoSemPersistencia, type EventoCriadoSemVinculo, type ReagendamentoPendente } from "@/lib/bpm/google-meet-compensacao";
import { destinoEhReuniaoAgendada, etapaEhAgendarReuniao } from "@/lib/bpm/agendar-reuniao";
import { extrairCodigoMeet } from "@/lib/bpm/transcricao-reuniao";
import { etapaEhReuniaoAgendada } from "@/lib/bpm/reuniao-agendada";
import { dataHoraObrigatoriaBpmSchema } from "@/lib/validations/bpm";
import {
  combinarParticipantesReuniao,
  emailClienteReuniaoSchema,
  emailsConvidadosReuniaoSchema,
} from "@/lib/bpm/email-reuniao";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";
const DURACAO_PADRAO_MINUTOS = 60; // decisão confirmada com o usuário (plano-novos-leads-bpm.md, Bloco 2)
const ERRO_ETAPA_REUNIAO = "O Google Meet só pode ser agendado na etapa Agendar Reunião.";
const ERRO_ETAPA_REAGENDAMENTO = "O Google Meet só pode ser reagendado em Agendar Reunião ou Reunião Agendada.";

/** Recupera convidados do evento sem duplicar sua lista no banco do CRM. */
export async function ListarConvidadosReuniaoGoogleMeetBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const userId = Number(session.user.id);
    if (!cardId.trim()) return { success: false as const, error: "Card inválido" };
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizar");
    const card = await db.bpmCard.findUnique({
      where: { id: cardId }, select: { googleEventId: true, googleCalendarId: true },
    });
    if (!card?.googleEventId || !card.googleCalendarId) return { success: true as const, data: [] as string[] };
    const calendario = await db.googleCalendarSelecionado.findFirst({
      where: { conexao: { userId }, googleCalendarId: card.googleCalendarId }, select: { id: true },
    });
    if (!calendario) return { success: false as const, error: "Agenda da reunião indisponível para esta conta." };
    const usuarioGoogle = await obterUsuarioGoogleAtivoPorCalendario(calendario.id);
    if (!usuarioGoogle.ok || usuarioGoogle.userId !== userId) {
      return { success: false as const, error: "Agenda Alpha não está ativa para esta conta." };
    }
    const evento = await obterEventoGoogle({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: card.googleCalendarId,
      googleEventId: card.googleEventId,
    });
    if (evento.googleEventId !== card.googleEventId || evento.status === "cancelled") {
      return { success: false as const, error: "Evento da reunião indisponível na Agenda Google." };
    }
    return { success: true as const, data: Array.from(new Set(evento.participantes
      .filter((participante) => !participante.organizador)
      .flatMap((participante) => {
        const email = emailClienteReuniaoSchema.safeParse(participante.email);
        return email.success ? [email.data] : [];
      }))) };
  } catch (error) {
    console.error("[ListarConvidadosReuniaoGoogleMeetBpm]", error instanceof GoogleCalendarError
      ? { kind: error.kind, status: error.status, reason: error.reason }
      : { tipo: error instanceof Error ? error.name : "Erro desconhecido" });
    return { success: false as const, error: "Não foi possível consultar os convidados desta reunião." };
  }
}

const iniciarBoasVindasSchema = z.object({
  cardId: z.string().min(1),
  dataHora: dataHoraObrigatoriaBpmSchema("Data e hora da reunião são obrigatórias"),
  emailCliente: emailClienteReuniaoSchema,
  analistaId: z.number().int().positive(),
});

export async function ListarAnalistasBoasVindasBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || !cardId.trim()) return { success: false as const, error: "Não autorizado" };
    const userId = Number(session.user.id);
    if (!podeAgirBoasVindasOperacional(userId, session.user.role)) {
      return { success: false as const, error: "Não autorizado" };
    }
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");
    const card = await db.bpmCard.findUnique({ where: { id: cardId }, select: {
      pipelineId: true, etapa: { select: { nome: true } },
    } });
    if (!card || card.pipelineId !== PIPELINE_OPERACIONAL_ATIVO_ID || !etapaEhBoasVindas(card.etapa.nome)) {
      return { success: false as const, error: "Card fora de Boas-vindas." };
    }
    const usuarios = await db.usuarios.findMany({ where: {
      role: "OPERACIONAL", status: "ATIVO", cargo: { contains: "Analista" },
      id: { not: DIRETOR_OPERACIONAL_VITOR_ID },
    }, select: { id: true, nome: true, email: true }, orderBy: { nome: "asc" } });
    const elegiveis = await Promise.all(usuarios.map(async (usuario) => ({
      usuario, elegivel: await usuarioElegivelResponsavelBpm(PIPELINE_OPERACIONAL_ATIVO_ID, usuario.id),
    })));
    return { success: true as const, data: elegiveis.filter((item) => item.elegivel)
      .map(({ usuario }) => ({ id: usuario.id, nome: usuario.nome, email: usuario.email })) };
  } catch {
    return { success: false as const, error: "Não foi possível listar as analistas." };
  }
}

/** A direção escolhe a analista e o horário; o servidor cria o Meet antes de confirmar a atribuição. */
export async function IniciarBoasVindasOperacionalBpm(dados: unknown) {
  let eventoCriado: EventoCriadoSemVinculo | null = null;
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const userId = Number(session.user.id);
    const parsed = iniciarBoasVindasSchema.safeParse(dados);
    if (!parsed.success) return { success: false as const, error: parsed.error.flatten() };
    const { cardId, analistaId, dataHora, emailCliente } = parsed.data;
    if (dataHora.getTime() <= Date.now()) return { success: false as const, error: "Escolha um horário futuro para a reunião." };
    if (analistaId === DIRETOR_OPERACIONAL_VITOR_ID) {
      return { success: false as const, error: "Escolha uma analista diferente do Diretor Operacional." };
    }
    if (!podeAgirBoasVindasOperacional(userId, session.user.role)) {
      return { success: false as const, error: "Somente Admin ou Vitor podem iniciar Boas-vindas." };
    }
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");
    const [card, analista] = await Promise.all([
      db.bpmCard.findUnique({ where: { id: cardId }, select: {
        pipelineId: true, etapaId: true, updatedAt: true, googleEventId: true, responsavelId: true,
        etapa: { select: { nome: true } },
        empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      } }),
      db.usuarios.findUnique({ where: { id: analistaId }, select: {
        id: true, nome: true, email: true, role: true, cargo: true, status: true,
      } }),
    ]);
    if (!card || card.pipelineId !== PIPELINE_OPERACIONAL_ATIVO_ID || !etapaEhBoasVindas(card.etapa.nome)) {
      return { success: false as const, error: "O card não está em Boas-vindas do Operacional." };
    }
    if (card.googleEventId) return { success: false as const, error: "A primeira reunião já está agendada." };
    if (!analista || analista.status !== "ATIVO" || analista.role.toUpperCase() !== "OPERACIONAL"
      || !/analista/i.test(analista.cargo ?? "")
      || !await usuarioElegivelResponsavelBpm(card.pipelineId, analistaId)) {
      return { success: false as const, error: "A analista selecionada não está apta para este processo." };
    }
    const emailAnalista = emailClienteReuniaoSchema.safeParse(analista.email);
    if (!emailAnalista.success) return { success: false as const, error: "A analista não possui e-mail válido." };
    const convidados = emailsConvidadosReuniaoSchema.parse([emailCliente, emailAnalista.data]);
    const calendarioResolvido = await resolverCalendarioPrincipal(userId);
    if (!calendarioResolvido.ok) return { success: false as const, error: calendarioResolvido.erro };
    const { calendario } = calendarioResolvido;
    const cardAtual = await db.bpmCard.findUnique({ where: { id: cardId }, select: {
      etapaId: true, updatedAt: true, googleEventId: true,
    } });
    if (!cardAtual || cardAtual.etapaId !== card.etapaId || cardAtual.googleEventId
      || cardAtual.updatedAt.getTime() !== card.updatedAt.getTime()) {
      return { success: false as const, error: "O card mudou. Recarregue antes de agendar." };
    }
    const resultado = await criarEventoNoCalendario({
      calendarId: calendario.googleCalendarId,
      titulo: `Primeira reunião operacional — ${card.empresa.nomeFantasia || card.empresa.razaoSocial}`,
      timezone: calendario.timezone || "America/Sao_Paulo", diaInteiro: false,
      inicio: dataHora, fim: new Date(dataHora.getTime() + DURACAO_PADRAO_MINUTOS * 60_000),
      participantes: convidados, criarMeet: true, eventType: "default",
      visibilidade: "default", transparencia: "opaque", lembretesMinutos: [],
    });
    if (!resultado.success) return { success: false as const, error: resultado.error };
    eventoCriado = { cardId, userId, calendarioId: calendario.id,
      googleCalendarId: calendario.googleCalendarId, googleEventId: resultado.data.googleEventId };
    const eventoCache = await db.googleCalendarEventoCache.findUnique({
      where: { calendarioId_googleEventId: { calendarioId: calendario.id,
        googleEventId: resultado.data.googleEventId } }, select: { linkMeet: true },
    });
    const googleMeetLink = eventoCache?.linkMeet ?? await confirmarLinkMeetCriado({
      userId, calendarioId: calendario.id, googleCalendarId: calendario.googleCalendarId,
      googleEventId: resultado.data.googleEventId,
    });
    if (!googleMeetLink) {
      await compensarCriacaoComRegistro(eventoCriado);
      eventoCriado = null;
      return { success: false as const, error: "O Google não confirmou o link do Meet. Tente novamente." };
    }
    const persistencia = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard", tx);
      const atualizado = await tx.bpmCard.updateMany({ where: {
        id: cardId, pipelineId: PIPELINE_OPERACIONAL_ATIVO_ID, etapaId: card.etapaId,
        updatedAt: card.updatedAt, googleEventId: null,
      }, data: {
        responsavelId: analistaId, dataReuniao: dataHora,
        googleEventId: resultado.data.googleEventId,
        googleCalendarId: calendario.googleCalendarId, googleMeetLink,
        versao: { increment: 1 },
      } });
      if (atualizado.count !== 1) return false;
      await tx.bpmCardMembro.upsert({
        where: { cardId_userId: { cardId, userId: analistaId } },
        create: { cardId, userId: analistaId, role: "RESPONSAVEL" },
        update: { role: "RESPONSAVEL" },
      });
      await tx.bpmCardMembro.upsert({
        where: { cardId_userId: { cardId, userId: DIRETOR_OPERACIONAL_VITOR_ID } },
        create: { cardId, userId: DIRETOR_OPERACIONAL_VITOR_ID, role: "ADMINISTRADOR" },
        update: { role: "ADMINISTRADOR" },
      });
      if (card.responsavelId !== analistaId && card.responsavelId !== DIRETOR_OPERACIONAL_VITOR_ID) {
        await tx.bpmCardMembro.deleteMany({ where: { cardId, userId: card.responsavelId } });
      }
      await tx.bpmCardReuniao.upsert({ where: { cardId_chave: { cardId, chave: "principal" } },
        create: { cardId, chave: "principal", status: "AGENDADA", agendadaEm: dataHora,
          googleEventId: resultado.data.googleEventId, googleCalendarId: calendario.googleCalendarId,
          googleMeetLink, emailCliente },
        update: { status: "AGENDADA", agendadaEm: dataHora,
          googleEventId: resultado.data.googleEventId, googleCalendarId: calendario.googleCalendarId,
          googleMeetLink, emailCliente },
      });
      await registrarHistoricoCard({ cardId, acao: "BOAS_VINDAS_INICIADAS", usuarioId: userId,
        valorNovoJson: JSON.stringify({ analistaId, dataReuniao: dataHora.toISOString(),
          googleEventId: resultado.data.googleEventId }) }, tx);
      await publicarEventoBpm({ tipo: "REUNIAO_AGENDADA", entidadeTipo: "CARD", entidadeId: cardId,
        cardId, pipelineId: PIPELINE_OPERACIONAL_ATIVO_ID,
        valorNovo: { etapaId: card.etapaId, dataReuniao: dataHora.toISOString(), analistaId },
        atorTipo: "USUARIO", atorUserId: userId, correlationId: randomUUID(),
        idempotencyKey: `boas-vindas-reuniao:${cardId}:${resultado.data.googleEventId}` }, tx);
      return true;
    });
    if (!persistencia) {
      await compensarCriacaoComRegistro(eventoCriado);
      eventoCriado = null;
      return { success: false as const, error: "O card mudou enquanto a reunião era agendada. Recarregue e tente novamente." };
    }
    eventoCriado = null;
    try {
      revalidatePath(`${ROTA_BASE}/pipeline`);
      await notificarPipelineBpm({ pipelineId: PIPELINE_OPERACIONAL_ATIVO_ID, cardId, tipo: "REUNIAO_ALTERADA" });
    } catch (notificacaoErro) {
      console.error("[IniciarBoasVindasOperacionalBpm] Notificação pendente", {
        tipo: notificacaoErro instanceof Error ? notificacaoErro.name : "Erro desconhecido",
      });
    }
    return { success: true as const, data: { googleEventId: resultado.data.googleEventId } };
  } catch (error) {
    if (eventoCriado) await compensarCriacaoComRegistro(eventoCriado);
    console.error("[IniciarBoasVindasOperacionalBpm]", error instanceof GoogleCalendarError
      ? { kind: error.kind, status: error.status, reason: error.reason }
      : { tipo: error instanceof Error ? error.name : "Erro desconhecido" });
    return { success: false as const, error: error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado" : "Não foi possível iniciar Boas-vindas." };
  }
}

async function compensarCriacaoComRegistro(evento: EventoCriadoSemVinculo) {
  try {
    await cancelarCriacaoSemVinculo(evento);
  } catch (error) {
    console.error("[AgendarReuniaoGoogleMeetBpm] Compensação pendente", { evento, error });
    await registrarCompensacaoGooglePendente(evento.cardId, "REUNIAO_CRIACAO_COMPENSACAO_PENDENTE", evento);
  }
}

async function compensarReagendamentoComRegistro(pendente: ReagendamentoPendente) {
  try {
    await reverterReagendamentoSemPersistencia(pendente);
  } catch (error) {
    console.error("[ReagendarReuniaoBpm] Rollback pendente", { pendente, error });
    await registrarCompensacaoGooglePendente(
      pendente.cardId, "REUNIAO_REAGENDAMENTO_COMPENSACAO_PENDENTE", pendente,
    );
  }
}

function cardEstaNaEtapaDeReuniao(card: { etapa: { nome: string } } | null): boolean {
  return Boolean(card && etapaEhAgendarReuniao(card.etapa.nome));
}

function cardEstaNaEtapaDeReagendamento(card: { etapa: { nome: string } } | null): boolean {
  return Boolean(card && (etapaEhAgendarReuniao(card.etapa.nome) || etapaEhReuniaoAgendada(card.etapa.nome)));
}

const ERRO_REUNIAO_ENCERRADA = "O horário desta reunião já passou. Preserve o evento para receber a transcrição; para uma nova reunião, crie outro agendamento.";

function reuniaoJaOcorreu(data: Date | null | undefined): boolean {
  return Boolean(data && data.getTime() <= Date.now());
}

function mesmoEspacoMeet(linkDoCard: string, linkDoGoogle: string | null): boolean {
  const codigoDoCard = extrairCodigoMeet(linkDoCard);
  return Boolean(codigoDoCard && codigoDoCard === extrairCodigoMeet(linkDoGoogle));
}

async function confirmarLinkMeetCriado(params: {
  userId: number;
  calendarioId: string;
  googleCalendarId: string;
  googleEventId: string;
}) {
  const usuarioGoogle = await obterUsuarioGoogleAtivo(params.userId);
  if (!usuarioGoogle.ok) return null;

  let ultimoEvento: Awaited<ReturnType<typeof obterEventoGoogle>> | null = null;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    if (tentativa > 0) {
      await new Promise((resolve) => setTimeout(resolve, 300 * tentativa));
    }
    ultimoEvento = await obterEventoGoogle({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: params.googleCalendarId,
      googleEventId: params.googleEventId,
    });
    if (ultimoEvento.linkMeet) {
      await db.googleCalendarEventoCache.upsert({
        where: {
          calendarioId_googleEventId: {
            calendarioId: params.calendarioId,
            googleEventId: params.googleEventId,
          },
        },
        create: { calendarioId: params.calendarioId, googleEventId: params.googleEventId, ...dadosCacheDeEvento(ultimoEvento) },
        update: dadosCacheDeEvento(ultimoEvento),
      });
      return ultimoEvento.linkMeet;
    }
  }

  if (ultimoEvento) {
    await cancelarEventoGoogle({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: params.googleCalendarId,
      googleEventId: params.googleEventId,
      etagConhecido: ultimoEvento.etag,
    });
    await db.googleCalendarEventoCache.deleteMany({
      where: { calendarioId: params.calendarioId, googleEventId: params.googleEventId },
    });
  }
  return null;
}

async function reagendarEventoVinculado(params: {
  cardId: string;
  userId: number;
  googleEventId: string;
  googleCalendarId: string;
  googleMeetLink: string;
  inicio: Date;
  fim: Date;
  emailCliente: string;
  emailsAdicionais: string[];
}) {
  // O ID "primary" pode existir em várias contas. A agenda usada deve ser
  // sempre a de quem solicitou o reagendamento, sem depender do cache local.
  const vinculo = await db.googleCalendarSelecionado.findFirst({
    where: {
      conexao: { userId: params.userId },
      googleCalendarId: params.googleCalendarId,
      gravavel: true,
    },
    select: { id: true, timezone: true },
  });
  if (!vinculo) {
    return { success: false as const, error: "O calendário desta reunião não está disponível para edição na sua Agenda Alpha. Revise a conexão e a permissão de escrita." };
  }
  const usuarioGoogle = await obterUsuarioGoogleAtivoPorCalendario(vinculo.id);
  if (!usuarioGoogle.ok || usuarioGoogle.userId !== params.userId) {
    return { success: false as const, error: "Sua Agenda Alpha não está ativa." };
  }

  let eventoAtual: Awaited<ReturnType<typeof obterEventoGoogle>>;
  try {
    eventoAtual = await obterEventoGoogle({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: params.googleCalendarId,
      googleEventId: params.googleEventId,
    });
  } catch (error) {
    if (error instanceof GoogleCalendarError && error.kind === "not_found") {
      return { success: false as const, error: "Esta reunião não foi encontrada na sua Agenda Alpha. Confira se o card foi agendado por esta conta." };
    }
    throw error;
  }
  if (eventoAtual.status === "cancelled" || !mesmoEspacoMeet(params.googleMeetLink, eventoAtual.linkMeet)) {
    return { success: false as const, error: "O espaço do Google Meet foi alterado fora do painel. Revise o evento antes de reagendar." };
  }
  if (!eventoAtual.inicio.dataHora || !eventoAtual.fim.dataHora) {
    return { success: false as const, error: "O evento Google não tem horário válido para rollback seguro." };
  }

  const eventoAtualizado = await atualizarEventoParcialGoogle({
    emailUsuario: usuarioGoogle.emailUsuario,
    calendarId: params.googleCalendarId,
    googleEventId: params.googleEventId,
    etagConhecido: eventoAtual.etag,
    evento: {
      inicio: params.inicio,
      fim: params.fim,
      diaInteiro: false,
      timezone: vinculo.timezone || "America/Sao_Paulo",
      participantes: combinarParticipantesReuniao(eventoAtual.participantes, params.emailCliente, params.emailsAdicionais),
    },
  });
  const compensacao: ReagendamentoPendente = {
    cardId: params.cardId,
    calendarioId: vinculo.id,
    googleCalendarId: params.googleCalendarId,
    googleEventId: params.googleEventId,
    googleMeetLink: params.googleMeetLink,
    inicioAnterior: eventoAtual.inicio.dataHora,
    fimAnterior: eventoAtual.fim.dataHora,
    inicioNovo: params.inicio.toISOString(),
    participantesAnteriores: eventoAtual.participantes.map((p) => p.email),
    timezone: vinculo.timezone || "America/Sao_Paulo",
  };
  if (!mesmoEspacoMeet(params.googleMeetLink, eventoAtualizado.linkMeet)) {
    return { success: false as const, error: "O Google devolveu um espaço de reunião diferente. O card não foi alterado; revise o evento na Agenda Alpha.", compensacao };
  }
  await db.googleCalendarEventoCache.upsert({
    where: {
      calendarioId_googleEventId: {
        calendarioId: vinculo.id,
        googleEventId: params.googleEventId,
      },
    },
    create: { calendarioId: vinculo.id, googleEventId: params.googleEventId, ...dadosCacheDeEvento(eventoAtualizado) },
    update: dadosCacheDeEvento(eventoAtualizado),
  }).catch((error) => console.error("[ReagendarReuniaoBpm] Cache Google será sincronizado depois", error));
  return { success: true as const, compensacao };
}

const agendarSchema = z.object({
  cardId: z.string().min(1),
  dataHora: dataHoraObrigatoriaBpmSchema("Data e hora da reunião são obrigatórias"),
  emailCliente: emailClienteReuniaoSchema,
  emailsAdicionais: z.array(emailClienteReuniaoSchema).max(49).default([]),
});

/**
 * Resolve o calendário "principal" de quem está agendando — mesmo critério já usado
 * pelo Bibble ao criar eventos via chat (src/lib/bibble/calendar-tools.ts):
 * googleCalendarId === "primary" ou igual ao próprio e-mail; se só houver 1 calendário
 * gravável, usa ele. Sem ambiguidade automática — se houver mais de 1 candidato, falha
 * com mensagem clara em vez de escolher arbitrariamente.
 */
async function resolverCalendarioPrincipal(userId: number) {
  const usuario = await db.usuarios.findUnique({ where: { id: userId }, select: { email: true } });
  const emailUsuario = usuario?.email.trim().toLocaleLowerCase();

  const calendarios = await db.googleCalendarSelecionado.findMany({
    where: { conexao: { userId }, gravavel: true },
    select: { id: true, googleCalendarId: true, nome: true, timezone: true },
  });

  if (calendarios.length === 0) {
    return { ok: false as const, erro: "Nenhum calendário gravável encontrado. Conecte sua Agenda Alpha em Perfil → Agenda." };
  }

  const principais = calendarios.filter((c) => {
    const id = c.googleCalendarId.trim().toLocaleLowerCase();
    return id === "primary" || Boolean(emailUsuario && id === emailUsuario);
  });
  if (principais.length === 1) return { ok: true as const, calendario: principais[0] };
  if (calendarios.length === 1) return { ok: true as const, calendario: calendarios[0] };

  return {
    ok: false as const,
    erro: "Você tem mais de um calendário configurado — abra a Agenda Alpha e defina qual usar antes de agendar pelo card.",
  };
}

export async function AgendarReuniaoGoogleMeetBpm(dados: unknown) {
  let eventoCriado: EventoCriadoSemVinculo | null = null;
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = agendarSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, dataHora, emailCliente, emailsAdicionais } = parsed.data;
    const convidados = emailsConvidadosReuniaoSchema.parse([emailCliente, ...emailsAdicionais]);

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        pipelineId: true,
        etapaId: true,
        updatedAt: true,
        googleEventId: true,
        etapa: { select: { nome: true } },
        empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      },
    });
    if (!card) return { success: false, error: "Card não encontrado" };
    if (!cardEstaNaEtapaDeReuniao(card)) return { success: false, error: ERRO_ETAPA_REUNIAO };
    if (card.googleEventId) {
      return { success: false, error: "Este card já tem uma reunião agendada — use Reagendar em vez de criar uma nova." };
    }

    const calendarioResolvido = await resolverCalendarioPrincipal(userId);
    if (!calendarioResolvido.ok) return { success: false, error: calendarioResolvido.erro };
    const { calendario } = calendarioResolvido;

    const inicio = dataHora;
    const fim = new Date(inicio.getTime() + DURACAO_PADRAO_MINUTOS * 60_000);
    const nomeEmpresa = card.empresa.nomeFantasia || card.empresa.razaoSocial;

    // Não basta a UI ocultar o formulário: a etapa é reavaliada junto da
    // versão que será usada no CAS, imediatamente antes da chamada externa.
    const cardAntesDeCriarEvento = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        etapaId: true,
        updatedAt: true,
        googleEventId: true,
        etapa: { select: { nome: true } },
      },
    });
    if (!cardAntesDeCriarEvento || !cardEstaNaEtapaDeReuniao(cardAntesDeCriarEvento)) {
      return { success: false, error: ERRO_ETAPA_REUNIAO };
    }
    if (cardAntesDeCriarEvento.googleEventId) {
      return { success: false, error: "Este card já tem uma reunião agendada — use Reagendar em vez de criar uma nova." };
    }
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");
    const resultado = await criarEventoNoCalendario({
      calendarId: calendario.googleCalendarId,
      titulo: `Reunião — ${nomeEmpresa}`,
      timezone: calendario.timezone || "America/Sao_Paulo",
      diaInteiro: false,
      inicio,
      fim,
      participantes: convidados,
      criarMeet: true,
      eventType: "default",
      visibilidade: "default",
      transparencia: "opaque",
      lembretesMinutos: [],
    });

    if (!resultado.success) return { success: false, error: resultado.error };
    eventoCriado = { cardId, userId, calendarioId: calendario.id, googleCalendarId: calendario.googleCalendarId, googleEventId: resultado.data.googleEventId };

    const eventoCache = await db.googleCalendarEventoCache.findUnique({
      where: {
        calendarioId_googleEventId: { calendarioId: calendario.id, googleEventId: resultado.data.googleEventId },
      },
      select: { linkMeet: true },
    });
    const googleMeetLink = eventoCache?.linkMeet ?? await confirmarLinkMeetCriado({
      userId,
      calendarioId: calendario.id,
      googleCalendarId: calendario.googleCalendarId,
      googleEventId: resultado.data.googleEventId,
    });
    if (!googleMeetLink) {
      return {
        success: false,
        error: "O Google não confirmou o link do Meet. O evento incompleto foi desfeito; tente agendar novamente.",
      };
    }

    const persistencia = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard", tx);
      const cardAntesDePersistir = await tx.bpmCard.findUnique({
        where: { id: cardId },
        select: {
          etapa: { select: { nome: true } },
          googleEventId: true,
        },
      });
      if (!cardAntesDePersistir || !cardEstaNaEtapaDeReuniao(cardAntesDePersistir)) {
        return { success: false as const, error: ERRO_ETAPA_REUNIAO };
      }
      if (cardAntesDePersistir.googleEventId) {
        return { success: false as const, error: "Este card já tem uma reunião agendada — use Reagendar em vez de criar uma nova." };
      }
      const atualizado = await tx.bpmCard.updateMany({
        where: {
          id: cardId,
          etapaId: cardAntesDeCriarEvento.etapaId,
          updatedAt: cardAntesDeCriarEvento.updatedAt,
          googleEventId: null,
        },
        data: {
          dataReuniao: inicio,
          googleEventId: resultado.data.googleEventId,
          googleCalendarId: calendario.googleCalendarId,
          googleMeetLink,
        },
      });
      if (atualizado.count !== 1) {
        return { success: false as const, error: "O card mudou enquanto a reunião era agendada. Recarregue e tente novamente." };
      }
      await tx.bpmCardReuniao.upsert({
        where: { cardId_chave: { cardId, chave: "principal" } },
        create: {
          cardId,
          chave: "principal",
          status: "AGENDADA",
          agendadaEm: inicio,
          googleEventId: resultado.data.googleEventId,
          googleCalendarId: calendario.googleCalendarId,
          googleMeetLink,
          emailCliente,
        },
        update: {
          status: "AGENDADA",
          agendadaEm: inicio,
          googleEventId: resultado.data.googleEventId,
          googleCalendarId: calendario.googleCalendarId,
          googleMeetLink,
          emailCliente,
        },
      });
      await registrarHistoricoCard(
        {
          cardId,
          acao: "REUNIAO_AGENDADA",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ dataReuniao: inicio, googleEventId: resultado.data.googleEventId }),
        },
        tx,
      );
      await publicarEventoBpm({
        tipo: "REUNIAO_AGENDADA",
        entidadeTipo: "CARD",
        entidadeId: cardId,
        cardId,
        pipelineId: card.pipelineId,
        valorNovo: { etapaId: cardAntesDeCriarEvento.etapaId, dataReuniao: inicio.toISOString() },
        atorTipo: "USUARIO",
        atorUserId: userId,
        correlationId: randomUUID(),
        idempotencyKey: `reuniao-agendada:${cardId}:${resultado.data.googleEventId}`,
      }, tx);
      return { success: true as const };
    });
    if (!persistencia.success) {
      await compensarCriacaoComRegistro(eventoCriado);
      return persistencia;
    }
    eventoCriado = null;

    let avancoConcluido = false;
    try {
      await executarAutomacoesCentraisDoCardAgora(cardId);
      const etapaAtual = await db.bpmCard.findUnique({
        where: { id: cardId }, select: { etapa: { select: { nome: true } } },
      });
      avancoConcluido = Boolean(etapaAtual && destinoEhReuniaoAgendada(etapaAtual.etapa.nome));
    } catch (error) {
      console.error("[AgendarReuniaoGoogleMeetBpm] Automação pendente", {
        tipo: error instanceof Error ? error.name : "Erro desconhecido",
      });
    }
    try {
      revalidatePath(`${ROTA_BASE}/pipeline`);
      await notificarPipelineBpm({ cardId, tipo: "REUNIAO_ALTERADA" });
    } catch (error) {
      console.error("[AgendarReuniaoGoogleMeetBpm] Notificação pendente", {
        tipo: error instanceof Error ? error.name : "Erro desconhecido",
      });
    }
    return { success: true, data: { googleEventId: resultado.data.googleEventId, avancoConcluido } };
  } catch (error) {
    if (eventoCriado) await compensarCriacaoComRegistro(eventoCriado);
    console.error("[AgendarReuniaoGoogleMeetBpm]", error instanceof GoogleCalendarError
      ? { kind: error.kind, status: error.status, message: error.message }
      : { message: error instanceof Error ? error.message : "Erro desconhecido" });
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao agendar reunião";
    return { success: false, error: msg };
  }
}

const reagendarSchema = z.object({
  cardId: z.string().min(1),
  dataHora: dataHoraObrigatoriaBpmSchema("Data e hora da reunião são obrigatórias"),
  emailCliente: emailClienteReuniaoSchema,
  emailsAdicionais: z.array(emailClienteReuniaoSchema).max(49).default([]),
});

export async function ReagendarReuniaoBpm(dados: unknown) {
  let compensacao: ReagendamentoPendente | null = null;
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = reagendarSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, dataHora, emailCliente, emailsAdicionais } = parsed.data;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        etapaId: true,
        updatedAt: true,
        etapa: { select: { nome: true } },
        googleEventId: true,
        googleCalendarId: true,
        googleMeetLink: true,
        dataReuniao: true,
        transcricaoReuniao: true,
      },
    });
    if (!card) return { success: false, error: "Card não encontrado" };
    if (!cardEstaNaEtapaDeReagendamento(card)) return { success: false, error: ERRO_ETAPA_REAGENDAMENTO };
    if (!card.googleEventId || !card.googleCalendarId || !card.googleMeetLink) {
      return { success: false, error: "Este card ainda não tem reunião agendada — use Agendar pelo Google Meet primeiro." };
    }
    if (reuniaoJaOcorreu(card.dataReuniao)) {
      return { success: false, error: ERRO_REUNIAO_ENCERRADA };
    }
    if (card.transcricaoReuniao?.trim()) {
      return {
        success: false,
        error: "Esta reunião já possui transcrição recebida e não pode ser reutilizada em outra data. Avance o card para preservar o vínculo da evidência.",
      };
    }

    const inicio = dataHora;
    const fim = new Date(inicio.getTime() + DURACAO_PADRAO_MINUTOS * 60_000);

    const cardAntesDeReagendar = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        etapaId: true,
        updatedAt: true,
        etapa: { select: { nome: true } },
        googleEventId: true,
        googleCalendarId: true,
        googleMeetLink: true,
        dataReuniao: true,
        transcricaoReuniao: true,
      },
    });
    if (!cardAntesDeReagendar || !cardEstaNaEtapaDeReagendamento(cardAntesDeReagendar)) {
      return { success: false, error: ERRO_ETAPA_REAGENDAMENTO };
    }
    if (
      cardAntesDeReagendar.googleEventId !== card.googleEventId
      || cardAntesDeReagendar.googleCalendarId !== card.googleCalendarId
      || cardAntesDeReagendar.googleMeetLink !== card.googleMeetLink
    ) {
      return { success: false, error: "A reunião mudou enquanto era reagendada. Recarregue e tente novamente." };
    }
    if (cardAntesDeReagendar.transcricaoReuniao?.trim()) {
      return {
        success: false,
        error: "Esta reunião já possui transcrição recebida e não pode ser reutilizada em outra data. Avance o card para preservar o vínculo da evidência.",
      };
    }
    if (reuniaoJaOcorreu(cardAntesDeReagendar.dataReuniao)) {
      return { success: false, error: ERRO_REUNIAO_ENCERRADA };
    }
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");
    const resultado = await reagendarEventoVinculado({
      cardId,
      userId,
      googleCalendarId: card.googleCalendarId,
      googleEventId: card.googleEventId,
      googleMeetLink: card.googleMeetLink,
      inicio,
      fim,
      emailCliente,
      emailsAdicionais,
    });

    if (!resultado.success) {
      if ("compensacao" in resultado && resultado.compensacao) {
        await compensarReagendamentoComRegistro(resultado.compensacao);
      }
      return { success: false, error: resultado.error };
    }
    compensacao = resultado.compensacao;

    const persistencia = await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard", tx);
      const cardAntesDePersistir = await tx.bpmCard.findUnique({
        where: { id: cardId },
        select: {
          etapa: { select: { nome: true } },
          googleEventId: true,
          googleCalendarId: true,
          googleMeetLink: true,
          dataReuniao: true,
          transcricaoReuniao: true,
        },
      });
      if (!cardAntesDePersistir || !cardEstaNaEtapaDeReagendamento(cardAntesDePersistir)) {
        return { success: false as const, error: ERRO_ETAPA_REAGENDAMENTO };
      }
      if (cardAntesDePersistir.transcricaoReuniao?.trim()) {
        return {
          success: false as const,
          error: "Esta reunião já possui transcrição recebida e não pode ser reutilizada em outra data. Avance o card para preservar o vínculo da evidência.",
        };
      }
      if (reuniaoJaOcorreu(cardAntesDePersistir.dataReuniao)) {
        return { success: false as const, error: ERRO_REUNIAO_ENCERRADA };
      }
      const atualizado = await tx.bpmCard.updateMany({
        where: {
          id: cardId,
          etapaId: cardAntesDeReagendar.etapaId,
          updatedAt: cardAntesDeReagendar.updatedAt,
          googleEventId: card.googleEventId,
          googleCalendarId: card.googleCalendarId,
          googleMeetLink: card.googleMeetLink,
        },
        data: { dataReuniao: inicio },
      });
      if (atualizado.count !== 1) {
        return { success: false as const, error: "O card mudou enquanto a reunião era reagendada. Recarregue e tente novamente." };
      }
      await tx.bpmCardReuniao.upsert({
        where: { cardId_chave: { cardId, chave: "principal" } },
        create: {
          cardId,
          chave: "principal",
          status: "AGENDADA",
          agendadaEm: inicio,
          googleEventId: card.googleEventId,
          googleCalendarId: card.googleCalendarId,
          googleMeetLink: card.googleMeetLink,
          emailCliente,
        },
        update: {
          status: "AGENDADA",
          agendadaEm: inicio,
          googleEventId: card.googleEventId,
          googleCalendarId: card.googleCalendarId,
          googleMeetLink: card.googleMeetLink,
          emailCliente,
        },
      });
      await registrarHistoricoCard(
        {
          cardId,
          acao: "REUNIAO_REAGENDADA",
          usuarioId: userId,
          valorAnteriorJson: JSON.stringify({ dataReuniao: card.dataReuniao }),
          valorNovoJson: JSON.stringify({
            dataReuniao: inicio,
            googleEventId: card.googleEventId,
            googleMeetLink: card.googleMeetLink,
            transcricaoPreservada: Boolean(card.transcricaoReuniao?.trim()),
          }),
        },
        tx,
      );
      return { success: true as const };
    });
    if (!persistencia.success) {
      await compensarReagendamentoComRegistro(compensacao);
      return persistencia;
    }
    compensacao = null;

    revalidatePath(`${ROTA_BASE}/pipeline`);
    await notificarPipelineBpm({ cardId, tipo: "REUNIAO_ALTERADA" });
    return { success: true };
  } catch (error) {
    if (compensacao) await compensarReagendamentoComRegistro(compensacao);
    console.error("[ReagendarReuniaoBpm]", error instanceof GoogleCalendarError
      ? { kind: error.kind, status: error.status, reason: error.reason, message: error.message }
      : { message: error instanceof Error ? error.message : "Erro desconhecido" });
    const msg = error instanceof GoogleCalendarError
      ? error.kind === "forbidden"
        ? "O Google recusou atualizar os convidados. Confira a permissão da conta organizadora para convidar pessoas externas."
        : error.message
      : error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao reagendar reunião";
    return { success: false, error: msg };
  }
}
