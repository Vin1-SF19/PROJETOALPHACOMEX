"use server";

import { revalidatePath } from "next/cache";

import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import { dadosCacheDeEvento } from "@/lib/google-calendar/cache-eventos";
import {
  atualizarEvento as atualizarEventoGoogleApi,
  cancelarEvento as cancelarEventoGoogleApi,
  consultarFreeBusy,
  criarEvento as criarEventoGoogleApi,
  listarCalendarios,
} from "@/lib/google-calendar/client";
import { sincronizarCalendario } from "@/lib/google-calendar/sync";
import type { GoogleCalendarioDTO } from "@/lib/google-calendar/types";
import { obterUsuarioGoogleAtivo } from "@/lib/google-calendar/usuario-google";
import {
  atualizarEventoSchema,
  cancelarEventoSchema,
  consultarFreeBusySchema,
  corHexSchema,
  criarEventoSchema,
  selecionarCalendarioSchema,
  type AtualizarEventoInput,
  type CancelarEventoInput,
  type ConsultarFreeBusyInput,
  type CriarEventoInput,
  type SelecionarCalendarioInput,
} from "@/lib/validations/google-calendar";
import db from "@/lib/prisma";

type ResultadoAcao<T> = { success: true; data: T } | { success: false; error: string };

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
    include: { conexao: true },
  });
  if (!calendario || calendario.conexao.userId !== userId) return null;
  return calendario;
}

/** Sincroniza (full ou incremental) e retorna os eventos em cache dentro da janela [inicio, fim]. */
export async function listarEventosDoCalendario(calendarioId: string, inicioISO: string, fimISO: string) {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false as const, error: "Não autorizado." };

  const calendario = await carregarCalendarioComOwnership(calendarioId, acesso.userId);
  if (!calendario) return { success: false as const, error: "Calendário não encontrado." };

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) return { success: false as const, error: erroMensagemAmigavel(usuarioGoogle.motivo) };

  const sync = await sincronizarCalendario(calendario, usuarioGoogle.emailUsuario);
  if (!sync.ok) return { success: false as const, error: sync.erro, stale: true as const };

  const eventos = await db.googleCalendarEventoCache.findMany({
    where: {
      calendarioId,
      inicioEm: { lte: new Date(fimISO) },
      OR: [{ fimEm: { gte: new Date(inicioISO) } }, { fimEm: null }],
    },
    orderBy: { inicioEm: "asc" },
  });

  return { success: true as const, data: eventos };
}

export async function consultarDisponibilidade(
  input: ConsultarFreeBusyInput,
): Promise<ResultadoAcao<Awaited<ReturnType<typeof consultarFreeBusy>>>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = consultarFreeBusySchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) return { success: false, error: erroMensagemAmigavel(usuarioGoogle.motivo) };

  try {
    const resultado = await consultarFreeBusy({
      emailUsuario: usuarioGoogle.emailUsuario,
      googleCalendarIds: dados.googleCalendarIds,
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

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) return { success: false, error: erroMensagemAmigavel(usuarioGoogle.motivo) };

  try {
    const eventoAtualizado = await atualizarEventoGoogleApi({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: dados.calendarId,
      googleEventId: dados.googleEventId,
      evento: paraInputEventoGoogle(dados),
    });

    const dadosCache = dadosCacheDeEvento(eventoAtualizado);
    await db.googleCalendarEventoCache.upsert({
      where: { calendarioId_googleEventId: { calendarioId: calendario.id, googleEventId: dados.googleEventId } },
      create: { calendarioId: calendario.id, googleEventId: eventoAtualizado.googleEventId, ...dadosCache },
      update: dadosCache,
    });

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { conflito: false } };
  } catch {
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
    });

    // Idempotente: já removido no Google (404/410) ou removido agora — nos dois casos some do cache.
    await db.googleCalendarEventoCache.deleteMany({
      where: { calendarioId: calendario.id, googleEventId: dados.googleEventId },
    });

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { ok: true } };
  } catch {
    return { success: false, error: "Não foi possível cancelar o evento no Google Agenda." };
  }
}
