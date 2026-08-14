import "server-only";

import db from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  carregarArtefatoTranscricaoMeet,
  GoogleMeetIntegracaoError,
  listarRegistrosConferenciaMeet,
} from "@/lib/google-meet/client";
import { obterUsuarioGoogleAtivoPorCalendario } from "@/lib/google-calendar/usuario-google";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  consolidarTranscricao,
  extrairCodigoMeet,
  selecionarRegistroConferencia,
} from "@/lib/bpm/transcricao-reuniao";
import { NOME_ETAPA_REUNIAO_AGENDADA } from "@/lib/bpm/reuniao-agendada";
import { NOME_ETAPA_STANDBY } from "@/lib/bpm/novos-leads";

const MAX_CARACTERES_TRANSCRICAO = 1_000_000;
const sincronizacoesEmAndamento = new Map<string, Promise<ResultadoSincronizacaoTranscricao>>();

export type ResultadoSincronizacaoTranscricao =
  | { status: "RECEBIDA"; atualizada: boolean; caracteres: number }
  | { status: "PENDENTE"; motivo: string }
  | { status: "ERRO"; erro: string; recuperavel: boolean };

export type RevalidarPersistenciaTranscricao = (
  tx: Prisma.TransactionClient,
) => Promise<void>;

export type ResumoPollingTranscricoes = {
  examinados: number;
  recebidos: number;
  pendentes: number;
  ignorados: number;
  falhos: number;
};

async function resolverEmailOrganizador(params: {
  googleEventId: string;
  googleCalendarId: string;
  googleMeetLink: string;
}): Promise<string> {
  const vinculos = await db.googleCalendarEventoCache.findMany({
    where: {
      googleEventId: params.googleEventId,
      linkMeet: params.googleMeetLink,
      calendario: { googleCalendarId: params.googleCalendarId },
    },
    select: { calendarioId: true },
    take: 2,
  });
  if (vinculos.length !== 1) {
    throw new GoogleMeetIntegracaoError(
      "Não foi possível confirmar de forma inequívoca o organizador desta reunião. Revise o vínculo na Agenda Alpha.",
    );
  }

  const usuarioGoogle = await obterUsuarioGoogleAtivoPorCalendario(vinculos[0].calendarioId);
  if (!usuarioGoogle.ok) {
    throw new GoogleMeetIntegracaoError(
      "O organizador da reunião não está com a Agenda Alpha ativa.",
    );
  }
  return usuarioGoogle.emailUsuario;
}

async function executarSincronizacaoTranscricaoCardBpm(
  cardId: string,
  origem: "manual" | "automatica",
  revalidarPersistencia?: RevalidarPersistenciaTranscricao,
): Promise<ResultadoSincronizacaoTranscricao> {
  try {
    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        pipelineId: true,
        status: true,
        dataReuniao: true,
        googleEventId: true,
        googleCalendarId: true,
        googleMeetLink: true,
        transcricaoReuniao: true,
      },
    });
    if (!card || card.status !== "ATIVO") {
      return { status: "ERRO", erro: "Card ativo não encontrado.", recuperavel: false };
    }
    if (!card.dataReuniao || card.dataReuniao.getTime() > Date.now()) {
      return { status: "PENDENTE", motivo: "A reunião ainda não ocorreu." };
    }
    if (!card.googleEventId || !card.googleCalendarId || !card.googleMeetLink) {
      return {
        status: "ERRO",
        erro: "O card não possui um vínculo completo com a reunião do Google Meet.",
        recuperavel: false,
      };
    }

    const meetingCode = extrairCodigoMeet(card.googleMeetLink);
    if (!meetingCode) {
      return { status: "ERRO", erro: "O link do Google Meet vinculado ao card é inválido.", recuperavel: false };
    }

    const emailOrganizador = await resolverEmailOrganizador({
      googleEventId: card.googleEventId,
      googleCalendarId: card.googleCalendarId,
      googleMeetLink: card.googleMeetLink,
    });
    const registros = await listarRegistrosConferenciaMeet(emailOrganizador, meetingCode);
    const registro = selecionarRegistroConferencia(registros, card.dataReuniao);
    if (!registro) {
      return {
        status: "PENDENTE",
        motivo: "A conferência encerrada ainda não está disponível no Google Meet.",
      };
    }

    const artefato = await carregarArtefatoTranscricaoMeet(emailOrganizador, registro.name);
    const transcricao = consolidarTranscricao(artefato.entradas, artefato.participantes);
    if (!transcricao) {
      return {
        status: "PENDENTE",
        motivo: artefato.transcriptsEncontrados > 0
          ? "A transcrição ainda está sendo processada pelo Google Meet."
          : "A reunião foi encontrada, mas ainda não possui transcrição gerada.",
      };
    }
    if (transcricao.length > MAX_CARACTERES_TRANSCRICAO) {
      return {
        status: "ERRO",
        erro: "A transcrição excede o limite seguro de armazenamento. Exporte-a diretamente pelo Google Meet.",
        recuperavel: false,
      };
    }

    if (card.transcricaoReuniao === transcricao) {
      return { status: "RECEBIDA", atualizada: false, caracteres: transcricao.length };
    }

    const atualizada = await db.$transaction(async (tx) => {
      // A ação manual pode ficar aguardando a API do Google por algum tempo.
      // Revalida o acesso dentro da transação, imediatamente antes da escrita,
      // para não persistir depois de uma revogação de permissão.
      if (origem === "manual") await revalidarPersistencia?.(tx);
      const update = await tx.bpmCard.updateMany({
        where: {
          id: card.id,
          status: "ATIVO",
          etapa: {
            nome: { in: [NOME_ETAPA_REUNIAO_AGENDADA, NOME_ETAPA_STANDBY] },
            ativo: true,
          },
          dataReuniao: card.dataReuniao,
          googleCalendarId: card.googleCalendarId,
          googleEventId: card.googleEventId,
          googleMeetLink: card.googleMeetLink,
          transcricaoReuniao: card.transcricaoReuniao,
        },
        data: { transcricaoReuniao: transcricao },
      });
      if (update.count !== 1) return false;

      await tx.bpmCardHistorico.create({
        data: {
          cardId: card.id,
          acao: card.transcricaoReuniao
            ? "TRANSCRICAO_REUNIAO_ATUALIZADA"
            : "TRANSCRICAO_REUNIAO_RECEBIDA",
          automacaoOrigem: origem === "automatica" ? "google_meet_polling" : undefined,
          valorNovoJson: JSON.stringify({
            origem,
            conferenceRecord: registro.name,
            entradas: artefato.entradas.length,
            caracteres: transcricao.length,
          }),
        },
      });
      return true;
    });

    if (atualizada) {
      await notificarPipelineBpm({
        pipelineId: card.pipelineId,
        cardId: card.id,
        tipo: "REUNIAO_ALTERADA",
      });
    }
    return { status: "RECEBIDA", atualizada, caracteres: transcricao.length };
  } catch (erro) {
    if (erro instanceof Error && erro.message === "Não autorizado") {
      return { status: "ERRO", erro: "Não autorizado", recuperavel: false };
    }
    const falha = erro instanceof GoogleMeetIntegracaoError
      ? erro
      : new GoogleMeetIntegracaoError("Não foi possível sincronizar a transcrição.");
    return { status: "ERRO", erro: falha.message, recuperavel: falha.recuperavel };
  }
}

export function sincronizarTranscricaoCardBpm(
  cardId: string,
  origem: "manual" | "automatica",
  revalidarPersistencia?: RevalidarPersistenciaTranscricao,
): Promise<ResultadoSincronizacaoTranscricao> {
  const existente = sincronizacoesEmAndamento.get(cardId);
  if (existente) return existente;
  const sincronizacao = executarSincronizacaoTranscricaoCardBpm(cardId, origem, revalidarPersistencia)
    .finally(() => sincronizacoesEmAndamento.delete(cardId));
  sincronizacoesEmAndamento.set(cardId, sincronizacao);
  return sincronizacao;
}

export async function executarPollingTranscricoesBpm(
  agora = new Date(),
): Promise<ResumoPollingTranscricoes> {
  const resumo: ResumoPollingTranscricoes = {
    examinados: 0,
    recebidos: 0,
    pendentes: 0,
    ignorados: 0,
    falhos: 0,
  };
  const baseWhere = {
    status: "ATIVO" as const,
    etapa: { nome: { in: [NOME_ETAPA_REUNIAO_AGENDADA, NOME_ETAPA_STANDBY] }, ativo: true },
    dataReuniao: { lte: agora },
    googleMeetLink: { not: null },
    googleEventId: { not: null },
  };
  const [semValor, candidatosEmBranco] = await Promise.all([
    db.bpmCard.findMany({
      where: {
        ...baseWhere,
        OR: [{ transcricaoReuniao: null }, { transcricaoReuniao: "" }],
      },
      select: { id: true, transcricaoReuniao: true },
      orderBy: { dataReuniao: "asc" },
      take: 50,
    }),
    db.bpmCard.findMany({
      where: {
        ...baseWhere,
        transcricaoReuniao: { not: null },
      },
      select: { id: true, transcricaoReuniao: true },
      orderBy: { dataReuniao: "asc" },
      take: 500,
    }),
  ]);
  const pendentes = [
    ...semValor,
    ...candidatosEmBranco.filter((card) => !card.transcricaoReuniao?.trim()),
  ].filter((card, indice, lista) => lista.findIndex((item) => item.id === card.id) === indice)
    .slice(0, 50);
  resumo.examinados = pendentes.length;
  resumo.ignorados = candidatosEmBranco.length
    - candidatosEmBranco.filter((card) => !card.transcricaoReuniao?.trim()).length;

  for (let inicio = 0; inicio < pendentes.length; inicio += 4) {
    const lote = pendentes.slice(inicio, inicio + 4);
    const resultados = await Promise.all(lote.map(async (card) => ({
      cardId: card.id,
      resultado: await sincronizarTranscricaoCardBpm(card.id, "automatica"),
    })));
    for (const { cardId, resultado } of resultados) {
      if (resultado.status === "RECEBIDA") resumo.recebidos += 1;
      else if (resultado.status === "PENDENTE") resumo.pendentes += 1;
      else {
        resumo.falhos += 1;
        console.error("[PollingTranscricaoMeet] Falha ao processar card", {
          cardId,
          erro: resultado.erro,
        });
      }
    }
  }
  return resumo;
}
