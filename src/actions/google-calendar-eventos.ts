"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import { dadosCacheDeEvento } from "@/lib/google-calendar/cache-eventos";
import {
  atualizarEventoParcial as atualizarEventoParcialGoogleApi,
  cancelarEvento as cancelarEventoGoogleApi,
  consultarFreeBusy,
  criarEvento as criarEventoGoogleApi,
  listarCalendarios,
  obterEvento as obterEventoGoogleApi,
  responderConvite as responderConviteGoogleApi,
} from "@/lib/google-calendar/client";
import { GoogleCalendarError } from "@/lib/google-calendar/errors";
import type { GoogleCalendarioDTO, GoogleEventoDTO } from "@/lib/google-calendar/types";
import { obterUsuarioGoogleAtivo } from "@/lib/google-calendar/usuario-google";
import {
  atualizarEventoSchema,
  atualizarEventoParcialSchema,
  cancelarEventoSchema,
  consultarFreeBusySchema,
  corHexSchema,
  criarEventoSchema,
  responderConviteSchema,
  selecionarCalendarioSchema,
  type AtualizarEventoInput,
  type AtualizarEventoParcialInput,
  type CancelarEventoInput,
  type ConsultarFreeBusyInput,
  type CriarEventoInput,
  type ResponderConviteInput,
  type SelecionarCalendarioInput,
} from "@/lib/validations/google-calendar";
import db from "@/lib/prisma";

export type ResultadoAcao<T> = { success: true; data: T } | { success: false; error: string };
type ResultadoAtualizacaoParcial = {
  conflito: boolean;
  evento: GoogleEventoDTO | null;
  etag?: string;
};

const intervaloCacheSchema = z
  .object({
    calendarioId: z.string().trim().min(1).max(100),
    inicioISO: z.string().datetime({ offset: true }),
    fimISO: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine(
    (dados) => new Date(dados.fimISO).getTime() > new Date(dados.inicioISO).getTime(),
    { message: "O fim deve ser posterior ao início.", path: ["fimISO"] },
  );

export type ListarEventosCacheInput = z.input<typeof intervaloCacheSchema>;

const detalhesEventoSchema = z
  .object({
    calendarioId: z.string().trim().min(1).max(100),
    googleEventId: z.string().trim().min(1).max(1024),
  })
  .strict();

export type CarregarDetalhesEventoInput = z.input<typeof detalhesEventoSchema>;

function erroMensagemAmigavel(motivo: "sem_conexao" | "desativada"): string {
  return motivo === "desativada"
    ? "Calendário Alpha está desativado para sua conta. Ative de novo para continuar."
    : "Ative o Calendário Alpha primeiro.";
}

function primeiroErroZod(erro: { issues: { message: string }[] }): string {
  return erro.issues[0]?.message ?? "Dados inválidos.";
}

function paraInputEventoGoogle(dados: CriarEventoInput | AtualizarEventoInput) {
  return {
    titulo: dados.titulo,
    descricaoGoogle: dados.descricaoGoogle,
    localizacao: dados.localizacao,
    timezone: dados.timezone,
    diaInteiro: dados.diaInteiro,
    inicio: dados.inicio,
    fim: dados.fim,
    participantes: dados.participantes,
    criarMeet: dados.criarMeet,
    recorrenciaRegras: dados.recorrenciaRegras,
    visibilidade: dados.visibilidade,
    transparencia: dados.transparencia,
    lembretesMinutos: dados.lembretesMinutos,
  };
}

function paraInputEventoParcialGoogle(
  dados: AtualizarEventoParcialInput | AtualizarEventoInput,
  timezonePadrao: string,
  preservarParticipantesQuandoListaVazia = false,
) {
  return {
    titulo: dados.titulo,
    descricaoGoogle: dados.descricaoGoogle,
    localizacao: dados.localizacao,
    timezone: dados.inicio !== undefined ? (dados.timezone ?? timezonePadrao) : undefined,
    diaInteiro: dados.diaInteiro,
    inicio: dados.inicio,
    fim: dados.fim,
    participantes:
      preservarParticipantesQuandoListaVazia && dados.participantes?.length === 0
        ? undefined
        : dados.participantes,
    criarMeet: dados.criarMeet,
  };
}

/** Calendários Google autorizados (ao vivo, via impersonation, para a tela de seleção). */
export async function listarCalendariosGoogleDisponiveis(): Promise<ResultadoAcao<GoogleCalendarioDTO[]>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) return { success: false, error: erroMensagemAmigavel(usuarioGoogle.motivo) };

  try {
    const calendarios = await listarCalendarios(usuarioGoogle.emailUsuario);
    return { success: true, data: calendarios };
  } catch {
    return { success: false, error: "Não foi possível listar os calendários do Google agora." };
  }
}

/** Calendários já selecionados pelo usuário no Painel (persistidos). */
export async function listarCalendariosSelecionados() {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false as const, error: "Não autorizado." };

  const calendarios = await db.googleCalendarSelecionado.findMany({
    where: { conexao: { userId: acesso.userId } },
    orderBy: { nome: "asc" },
  });
  return { success: true as const, data: calendarios };
}

export async function definirCalendarioSelecionado(
  input: SelecionarCalendarioInput,
): Promise<ResultadoAcao<{ id: string }>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = selecionarCalendarioSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  const conexao = await db.googleCalendarConexao.findUnique({ where: { id: dados.conexaoId } });
  if (!conexao || conexao.userId !== acesso.userId) {
    return { success: false, error: "Conexão inválida." };
  }

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) return { success: false, error: erroMensagemAmigavel(usuarioGoogle.motivo) };

  const calendariosGoogle = await listarCalendarios(usuarioGoogle.emailUsuario);
  const alvo = calendariosGoogle.find((c) => c.googleCalendarId === dados.googleCalendarId);
  if (!alvo) return { success: false, error: "Calendário não encontrado na conta Google." };

  const registro = await db.googleCalendarSelecionado.upsert({
    where: { conexaoId_googleCalendarId: { conexaoId: dados.conexaoId, googleCalendarId: dados.googleCalendarId } },
    create: {
      conexaoId: dados.conexaoId,
      googleCalendarId: alvo.googleCalendarId,
      nome: alvo.nome,
      corHex: alvo.corHex,
      timezone: alvo.timezone,
      papelAcesso: alvo.papelAcesso,
      visivel: dados.visivel,
      gravavel: dados.gravavel && (alvo.papelAcesso === "owner" || alvo.papelAcesso === "writer"),
    },
    // `corHex` fica de fora do update: se o usuário personalizou a cor depois, alternar
    // visibilidade/gravável não pode resetar para a cor original do Google.
    update: {
      nome: alvo.nome,
      timezone: alvo.timezone,
      papelAcesso: alvo.papelAcesso,
      visivel: dados.visivel,
      gravavel: dados.gravavel && (alvo.papelAcesso === "owner" || alvo.papelAcesso === "writer"),
    },
    select: { id: true },
  });

  revalidatePath("/PainelAlpha/CalendarioAlpha");
  return { success: true, data: registro };
}

/** Permite personalizar a cor de um calendário próprio já selecionado (independente da cor do Google). */
export async function personalizarCorCalendario(calendarioId: string, corHex: string): Promise<ResultadoAcao<{ ok: true }>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = corHexSchema.safeParse(corHex);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };

  const calendario = await carregarCalendarioComOwnership(calendarioId, acesso.userId);
  if (!calendario) return { success: false, error: "Calendário não encontrado." };

  await db.googleCalendarSelecionado.update({ where: { id: calendarioId }, data: { corHex: validacao.data } });
  revalidatePath("/PainelAlpha/CalendarioAlpha");
  return { success: true, data: { ok: true } };
}

async function carregarCalendarioComOwnership(calendarioId: string, userId: number) {
  const calendario = await db.googleCalendarSelecionado.findUnique({
    where: { id: calendarioId },
    select: {
      id: true,
      googleCalendarId: true,
      timezone: true,
      gravavel: true,
      syncToken: true,
      ultimaSincronizacaoEm: true,
      conexao: { select: { userId: true } },
    },
  });
  if (!calendario || calendario.conexao.userId !== userId) return null;
  return calendario;
}

/** Leitura cache-only: nunca chama a Google Calendar API nem dispara sincronização. */
export async function listarEventosCache(input: ListarEventosCacheInput) {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false as const, error: "Não autorizado." };

  const validacao = intervaloCacheSchema.safeParse(input);
  if (!validacao.success) {
    return {
      success: false as const,
      error: validacao.error.issues[0]?.message ?? "Intervalo inválido.",
    };
  }
  const dados = validacao.data;

  const calendario = await carregarCalendarioComOwnership(dados.calendarioId, acesso.userId);
  if (!calendario) return { success: false as const, error: "Calendário não encontrado." };

  const eventos = await db.googleCalendarEventoCache.findMany({
    where: {
      calendarioId: dados.calendarioId,
      inicioEm: { lte: new Date(dados.fimISO) },
      OR: [{ fimEm: { gte: new Date(dados.inicioISO) } }, { fimEm: null }],
    },
    orderBy: { inicioEm: "asc" },
  });

  return {
    success: true as const,
    data: eventos,
    ultimaSincronizacaoEm: calendario.ultimaSincronizacaoEm?.toISOString() ?? null,
  };
}

/**
 * Alias compatível com a UI e as tools existentes do Bibble. Desde 2026-07-30,
 * esta função é deliberadamente cache-only; sincronização é uma action separada.
 */
export async function listarEventosDoCalendario(
  calendarioId: string,
  inicioISO: string,
  fimISO: string,
) {
  return listarEventosCache({ calendarioId, inicioISO, fimISO });
}

/**
 * Hidrata o formulário com o recurso completo do Google. O cliente informa
 * apenas o id local do calendário; o googleCalendarId e o e-mail impersonado
 * são resolvidos no servidor depois das checagens de sessão e ownership.
 */
export async function carregarDetalhesEventoParaEdicao(
  input: CarregarDetalhesEventoInput,
): Promise<ResultadoAcao<GoogleEventoDTO>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = detalhesEventoSchema.safeParse(input);
  if (!validacao.success) {
    return {
      success: false,
      error: validacao.error.issues[0]?.message ?? "Evento inválido.",
    };
  }
  const dados = validacao.data;

  const calendario = await carregarCalendarioComOwnership(dados.calendarioId, acesso.userId);
  if (!calendario) return { success: false, error: "Calendário não encontrado." };
  if (!calendario.gravavel) {
    return { success: false, error: "Este calendário está disponível só para leitura." };
  }

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) {
    return { success: false, error: erroMensagemAmigavel(usuarioGoogle.motivo) };
  }

  try {
    const evento = await obterEventoGoogleApi({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: calendario.googleCalendarId,
      googleEventId: dados.googleEventId,
    });
    const dadosCache = dadosCacheDeEvento(evento);
    await db.googleCalendarEventoCache.upsert({
      where: {
        calendarioId_googleEventId: {
          calendarioId: calendario.id,
          googleEventId: dados.googleEventId,
        },
      },
      create: {
        calendarioId: calendario.id,
        googleEventId: dados.googleEventId,
        ...dadosCache,
      },
      update: dadosCache,
    });
    return { success: true, data: evento };
  } catch (erro) {
    if (
      erro instanceof GoogleCalendarError &&
      (erro.kind === "not_found" || erro.kind === "gone")
    ) {
      return { success: false, error: "Evento não encontrado no Google Agenda." };
    }
    return { success: false, error: "Não foi possível carregar os detalhes do evento agora." };
  }
}

/** Carrega detalhes de leitura de um convite, inclusive quando o calendário é somente leitura. */
export async function carregarDetalhesEventoParaVisualizacao(
  input: CarregarDetalhesEventoInput,
): Promise<ResultadoAcao<GoogleEventoDTO>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = detalhesEventoSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const calendario = await carregarCalendarioComOwnership(validacao.data.calendarioId, acesso.userId);
  if (!calendario) return { success: false, error: "Calendário não encontrado." };

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) return { success: false, error: erroMensagemAmigavel(usuarioGoogle.motivo) };

  try {
    const evento = await obterEventoGoogleApi({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: calendario.googleCalendarId,
      googleEventId: validacao.data.googleEventId,
    });
    const dadosCache = dadosCacheDeEvento(evento);
    await db.googleCalendarEventoCache.upsert({
      where: { calendarioId_googleEventId: { calendarioId: calendario.id, googleEventId: validacao.data.googleEventId } },
      create: { calendarioId: calendario.id, googleEventId: validacao.data.googleEventId, ...dadosCache },
      update: dadosCache,
    });
    return { success: true, data: evento };
  } catch {
    return { success: false, error: "Não foi possível carregar os detalhes do convite agora." };
  }
}

export async function consultarDisponibilidade(
  input: ConsultarFreeBusyInput,
): Promise<ResultadoAcao<Awaited<ReturnType<typeof consultarFreeBusy>>>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = consultarFreeBusySchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;
  const idsSolicitados = Array.from(new Set(dados.googleCalendarIds));
  const calendariosAutorizados = await db.googleCalendarSelecionado.findMany({
    where: {
      conexao: { userId: acesso.userId },
      googleCalendarId: { in: idsSolicitados },
    },
    select: { googleCalendarId: true },
  });
  if (calendariosAutorizados.length !== idsSolicitados.length) {
    return {
      success: false,
      error: "Um ou mais calendários não pertencem à configuração do usuário.",
    };
  }

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) return { success: false, error: erroMensagemAmigavel(usuarioGoogle.motivo) };

  try {
    const resultado = await consultarFreeBusy({
      emailUsuario: usuarioGoogle.emailUsuario,
      googleCalendarIds: idsSolicitados,
      timeMin: dados.inicio.toISOString(),
      timeMax: dados.fim.toISOString(),
    });
    return { success: true, data: resultado };
  } catch {
    return { success: false, error: "Não foi possível consultar disponibilidade agora." };
  }
}

export async function criarEventoNoCalendario(input: CriarEventoInput): Promise<ResultadoAcao<{ googleEventId: string }>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = criarEventoSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  const calendario = await db.googleCalendarSelecionado.findFirst({
    where: { conexao: { userId: acesso.userId }, googleCalendarId: dados.calendarId },
  });
  if (!calendario) return { success: false, error: "Calendário não encontrado." };
  if (!calendario.gravavel) return { success: false, error: "Este calendário está disponível só para leitura." };

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) return { success: false, error: erroMensagemAmigavel(usuarioGoogle.motivo) };

  try {
    const eventoCriado = await criarEventoGoogleApi({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: dados.calendarId,
      evento: paraInputEventoGoogle(dados),
    });

    await db.googleCalendarEventoCache.create({
      data: {
        calendarioId: calendario.id,
        googleEventId: eventoCriado.googleEventId,
        ...dadosCacheDeEvento(eventoCriado),
      },
    });

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { googleEventId: eventoCriado.googleEventId } };
  } catch {
    return { success: false, error: "Não foi possível criar o evento no Google Agenda." };
  }
}

export async function atualizarEventoNoCalendario(
  input: AtualizarEventoInput,
): Promise<ResultadoAcao<{ conflito: boolean }>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = atualizarEventoSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  const calendario = await db.googleCalendarSelecionado.findFirst({
    where: { conexao: { userId: acesso.userId }, googleCalendarId: dados.calendarId },
  });
  if (!calendario) return { success: false, error: "Calendário não encontrado." };
  if (!calendario.gravavel) return { success: false, error: "Este calendário está disponível só para leitura." };

  const cacheAtual = await db.googleCalendarEventoCache.findUnique({
    where: { calendarioId_googleEventId: { calendarioId: calendario.id, googleEventId: dados.googleEventId } },
  });

  // Se o cliente leu uma versão e o Google já mudou (etag diferente), avisa em vez de sobrescrever silenciosamente.
  if (dados.etagConhecido && cacheAtual && cacheAtual.etag !== dados.etagConhecido) {
    return { success: true, data: { conflito: true } };
  }
  const etagParaPatch = dados.etagConhecido ?? cacheAtual?.etag;
  if (!etagParaPatch) {
    return {
      success: false,
      error: "Abra novamente o evento para carregar a versão atual antes de salvar.",
    };
  }

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) return { success: false, error: erroMensagemAmigavel(usuarioGoogle.motivo) };

  try {
    const eventoAtualizado = await atualizarEventoParcialGoogleApi({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: dados.calendarId,
      googleEventId: dados.googleEventId,
      etagConhecido: etagParaPatch,
      evento: paraInputEventoParcialGoogle(
        dados,
        calendario.timezone || "America/Sao_Paulo",
        true,
      ),
    });

    const dadosCache = dadosCacheDeEvento(eventoAtualizado);
    await db.googleCalendarEventoCache.upsert({
      where: { calendarioId_googleEventId: { calendarioId: calendario.id, googleEventId: dados.googleEventId } },
      create: { calendarioId: calendario.id, googleEventId: eventoAtualizado.googleEventId, ...dadosCache },
      update: dadosCache,
    });

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { conflito: false } };
  } catch (erro) {
    if (erro instanceof GoogleCalendarError && erro.status === 412) {
      return { success: true, data: { conflito: true } };
    }
    return { success: false, error: "Não foi possível atualizar o evento no Google Agenda." };
  }
}

/**
 * Atualização parcial usada pelo IAlpha: só envia ao Google os campos explicitamente informados,
 * preservando descrição, participantes, conferência e demais detalhes quando forem omitidos.
 */
export async function atualizarEventoParcialNoCalendario(
  input: AtualizarEventoParcialInput,
): Promise<ResultadoAcao<ResultadoAtualizacaoParcial>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = atualizarEventoParcialSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  const calendario = await db.googleCalendarSelecionado.findFirst({
    where: { conexao: { userId: acesso.userId }, googleCalendarId: dados.calendarId },
  });
  if (!calendario) return { success: false, error: "Calendário não encontrado." };
  if (!calendario.gravavel) {
    return { success: false, error: "Este calendário está disponível só para leitura." };
  }

  const cacheAtual = await db.googleCalendarEventoCache.findUnique({
    where: {
      calendarioId_googleEventId: {
        calendarioId: calendario.id,
        googleEventId: dados.googleEventId,
      },
    },
  });
  if (dados.etagConhecido && cacheAtual && cacheAtual.etag !== dados.etagConhecido) {
    return { success: true, data: { conflito: true, evento: null } };
  }
  const etagParaPatch = dados.etagConhecido ?? cacheAtual?.etag;
  if (!etagParaPatch) {
    return {
      success: false,
      error: "Abra novamente o evento para carregar a versão atual antes de salvar.",
    };
  }

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) {
    return { success: false, error: erroMensagemAmigavel(usuarioGoogle.motivo) };
  }

  try {
    const eventoAtualizado = await atualizarEventoParcialGoogleApi({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: dados.calendarId,
      googleEventId: dados.googleEventId,
      etagConhecido: etagParaPatch,
      evento: paraInputEventoParcialGoogle(dados, calendario.timezone || "America/Sao_Paulo"),
    });

    const dadosCache = dadosCacheDeEvento(eventoAtualizado);
    await db.googleCalendarEventoCache.upsert({
      where: {
        calendarioId_googleEventId: {
          calendarioId: calendario.id,
          googleEventId: dados.googleEventId,
        },
      },
      create: {
        calendarioId: calendario.id,
        googleEventId: eventoAtualizado.googleEventId,
        ...dadosCache,
      },
      update: dadosCache,
    });

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return {
      success: true,
      data: {
        conflito: false,
        evento: eventoAtualizado,
        etag: eventoAtualizado.etag,
      },
    };
  } catch (erro) {
    if (erro instanceof GoogleCalendarError && erro.status === 412) {
      return { success: true, data: { conflito: true, evento: null } };
    }
    return { success: false, error: "Não foi possível atualizar o evento no Google Agenda." };
  }
}

export async function cancelarEventoNoCalendario(input: CancelarEventoInput): Promise<ResultadoAcao<{ ok: true }>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = cancelarEventoSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  const calendario = await db.googleCalendarSelecionado.findFirst({
    where: { conexao: { userId: acesso.userId }, googleCalendarId: dados.calendarId },
  });
  if (!calendario) return { success: false, error: "Calendário não encontrado." };
  if (!calendario.gravavel) return { success: false, error: "Este calendário está disponível só para leitura." };

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) return { success: false, error: erroMensagemAmigavel(usuarioGoogle.motivo) };

  try {
    await cancelarEventoGoogleApi({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: dados.calendarId,
      googleEventId: dados.googleEventId,
      etagConhecido: dados.etagConhecido,
    });

    // Idempotente: já removido no Google (404/410) ou removido agora — nos dois casos some do cache.
    await db.googleCalendarEventoCache.deleteMany({
      where: { calendarioId: calendario.id, googleEventId: dados.googleEventId },
    });

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { ok: true } };
  } catch (erro) {
    if (erro instanceof GoogleCalendarError && erro.status === 412) {
      return {
        success: false,
        error: "O evento mudou desde a última leitura. Liste a agenda novamente antes de cancelar.",
      };
    }
    return { success: false, error: "Não foi possível cancelar o evento no Google Agenda." };
  }
}

/** Registra a resposta (aceitar/recusar/talvez) ao convite de um evento compartilhado com o usuário. */
export async function responderConvite(input: ResponderConviteInput): Promise<ResultadoAcao<GoogleEventoDTO>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = responderConviteSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  const calendario = await db.googleCalendarSelecionado.findFirst({
    where: { conexao: { userId: acesso.userId }, googleCalendarId: dados.calendarId },
  });
  if (!calendario) return { success: false, error: "Calendário não encontrado." };

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) return { success: false, error: erroMensagemAmigavel(usuarioGoogle.motivo) };

  try {
    const evento = await responderConviteGoogleApi({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: dados.calendarId,
      googleEventId: dados.googleEventId,
      resposta: dados.resposta,
      etagConhecido: dados.etagConhecido,
    });

    const dadosCache = dadosCacheDeEvento(evento);
    await db.googleCalendarEventoCache.upsert({
      where: { calendarioId_googleEventId: { calendarioId: calendario.id, googleEventId: dados.googleEventId } },
      create: { calendarioId: calendario.id, googleEventId: dados.googleEventId, ...dadosCache },
      update: dadosCache,
    });

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: evento };
  } catch (erro) {
    if (erro instanceof GoogleCalendarError && erro.status === 412) {
      return { success: false, error: "O evento mudou desde a última leitura. Reabra o evento e tente responder de novo." };
    }
    if (erro instanceof GoogleCalendarError && erro.kind === "invalid_request") {
      return { success: false, error: erro.message };
    }
    return { success: false, error: "Não foi possível registrar sua resposta agora." };
  }
}
