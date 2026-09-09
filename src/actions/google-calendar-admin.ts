"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { registrarAuditoriaCalendarioAlpha } from "@/lib/google-calendar/auditoria";
import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import {
  atualizarEventoParcial as atualizarEventoParcialGoogleApi,
  cancelarEvento as cancelarEventoGoogleApi,
  criarEvento as criarEventoGoogleApi,
  listarCalendarios,
  obterEvento as obterEventoGoogleApi,
  responderConvite as responderConviteGoogleApi,
} from "@/lib/google-calendar/client";
import { dadosCacheDeEvento } from "@/lib/google-calendar/cache-eventos";
import { GoogleCalendarError } from "@/lib/google-calendar/errors";
import {
  atualizarTarefaGoogleTasks,
  concluirTarefaGoogleTasks,
  criarTarefaGoogleTasks,
} from "@/lib/google-calendar/tasks";
import type { GoogleEventoDTO } from "@/lib/google-calendar/types";
import {
  atualizarEventoSchema,
  atualizarEventoParcialSchema,
  cancelarEventoSchema,
  criarEventoSchema,
  responderConviteSchema,
  type AtualizarEventoInput,
  type AtualizarEventoParcialInput,
  type CancelarEventoInput,
  type CriarEventoInput,
  type ResponderConviteInput,
} from "@/lib/validations/google-calendar";
import db from "@/lib/prisma";

type ResultadoAcao<T> = { success: true; data: T } | { success: false; error: string };
type ResultadoAtualizacaoParcial = {
  conflito: boolean;
  evento: GoogleEventoDTO | null;
  etag?: string;
};

const detalhesEventoColegaSchema = z
  .object({
    calendarId: z.string().trim().min(1).max(300),
    googleEventId: z.string().trim().min(1).max(1024),
  })
  .strict();

export type CarregarDetalhesEventoColegaInput = z.input<typeof detalhesEventoColegaSchema>;
const colegaIdSchema = z.number().int().positive();
const criarTarefaColegaSchema = z.object({
  taskListId: z.string().min(1).max(300),
  titulo: z.string().trim().min(1).max(1024),
  notas: z.string().trim().max(8192).optional(),
  vencimentoEm: z.coerce.date().optional(),
  inicioLocalEm: z.coerce.date().optional(),
  fimLocalEm: z.coerce.date().optional(),
}).strict();
const atualizarTarefaColegaSchema = criarTarefaColegaSchema.omit({ taskListId: true }).extend({
  tarefaCacheId: z.string().min(1),
}).strict();
const concluirTarefaColegaSchema = z.object({ tarefaCacheId: z.string().min(1) }).strict();

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

/**
 * Verifica que o chamador pode escrever na agenda do colega e resolve a identidade Workspace
 * exclusivamente no servidor. Todos os usuários, inclusive Admin/CEO, precisam de vínculo
 * aprovado com papel EDITOR; a função nunca aceita a identidade Google vinda do cliente.
 */
async function resolverAlvoGravavel(colegaId: number): Promise<
  { ok: true; autorUserId: number; colegaUserId: number; colegaEmail: string } | { ok: false; error: string }
> {
  const colegaIdValidado = colegaIdSchema.safeParse(colegaId);
  if (!colegaIdValidado.success) {
    return { ok: false, error: "Colaborador inválido." };
  }

  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { ok: false, error: "Não autorizado." };

  const vinculo = await db.googleCalendarColegaVisivel.findUnique({
    where: { userId_colegaId: { userId: acesso.userId, colegaId: colegaIdValidado.data } },
    select: { papel: true },
  });
  if (vinculo?.papel !== "EDITOR") {
    return { ok: false, error: "Você não tem permissão de edição nesta agenda compartilhada." };
  }

  const colega = await db.usuarios.findUnique({
    where: { id: colegaIdValidado.data },
    select: {
      email: true,
      status: true,
      googleCalendarConexao: { select: { status: true } },
    },
  });
  if (
    !colega ||
    colega.status !== "ATIVO" ||
    colega.googleCalendarConexao?.status !== "ATIVA"
  ) {
    return { ok: false, error: "Agenda do colaborador não está ativa." };
  }

  return {
    ok: true,
    autorUserId: acesso.userId,
    colegaUserId: colegaIdValidado.data,
    colegaEmail: colega.email,
  };
}

async function resolverCalendarioGravavelDoColega(
  colegaEmail: string,
  calendarId: string,
): Promise<
  | { ok: true; calendarId: string; timezone: string }
  | { ok: false; error: string }
> {
  const calendariosGoogle = await listarCalendarios(colegaEmail);
  const calendario = calendariosGoogle.find(
    (item) => item.googleCalendarId === calendarId,
  );
  if (!calendario) {
    return { ok: false, error: "Calendário não encontrado na conta do colaborador." };
  }
  if (calendario.papelAcesso !== "owner" && calendario.papelAcesso !== "writer") {
    return {
      ok: false,
      error: "Este calendário do colaborador está disponível só para leitura.",
    };
  }
  return {
    ok: true,
    calendarId: calendario.googleCalendarId,
    timezone: calendario.timezone || "America/Sao_Paulo",
  };
}

async function resolverListaTarefasDoColega(colegaUserId: number, taskListId: string) {
  return db.googleCalendarTaskListCache.findFirst({
    where: {
      conexao: { userId: colegaUserId, status: "ATIVA" },
      googleTaskListId: taskListId,
    },
    select: { id: true, googleTaskListId: true },
  });
}

export async function criarTarefaParaColega(
  colegaId: number,
  input: z.input<typeof criarTarefaColegaSchema>,
): Promise<ResultadoAcao<{ id: string }>> {
  const alvo = await resolverAlvoGravavel(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = criarTarefaColegaSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const lista = await resolverListaTarefasDoColega(alvo.colegaUserId, validacao.data.taskListId);
  if (!lista) return { success: false, error: "Lista de tarefas não encontrada na agenda compartilhada." };

  try {
    const { inicioLocalEm, fimLocalEm, ...dadosGoogle } = validacao.data;
    const tarefa = await criarTarefaGoogleTasks({
      emailUsuario: alvo.colegaEmail,
      ...dadosGoogle,
    });
    const salva = await db.googleCalendarTaskCache.upsert({
      where: {
        taskListId_googleTaskId: {
          taskListId: lista.id,
          googleTaskId: tarefa.googleTaskId,
        },
      },
      create: {
        taskListId: lista.id,
        ...tarefa,
        inicioLocalEm: inicioLocalEm ?? null,
        fimLocalEm: fimLocalEm ?? null,
      },
      update: {
        ...tarefa,
        inicioLocalEm: inicioLocalEm ?? null,
        fimLocalEm: fimLocalEm ?? null,
      },
    });
    await registrarAuditoriaCalendarioAlpha(
      alvo.autorUserId,
      "CALENDARIO_ALPHA_CRIOU_TAREFA_COLEGA",
      `colegaId=${colegaId} tarefaCacheId=${salva.id}`,
    );
    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { id: salva.id } };
  } catch {
    return { success: false, error: "Não foi possível criar a tarefa na agenda compartilhada." };
  }
}

export async function atualizarTarefaParaColega(
  colegaId: number,
  input: z.input<typeof atualizarTarefaColegaSchema>,
): Promise<ResultadoAcao<{ id: string }>> {
  const alvo = await resolverAlvoGravavel(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = atualizarTarefaColegaSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const tarefa = await db.googleCalendarTaskCache.findFirst({
    where: {
      id: validacao.data.tarefaCacheId,
      taskList: { conexao: { userId: alvo.colegaUserId, status: "ATIVA" } },
    },
    include: { taskList: { select: { googleTaskListId: true } } },
  });
  if (!tarefa) return { success: false, error: "Tarefa não encontrada na agenda compartilhada." };

  try {
    const atualizada = await atualizarTarefaGoogleTasks({
      emailUsuario: alvo.colegaEmail,
      taskListId: tarefa.taskList.googleTaskListId,
      taskId: tarefa.googleTaskId,
      titulo: validacao.data.titulo,
      notas: validacao.data.notas,
      vencimentoEm: validacao.data.vencimentoEm,
    });
    await db.googleCalendarTaskCache.update({
      where: { id: tarefa.id },
      data: {
        ...atualizada,
        inicioLocalEm: validacao.data.inicioLocalEm ?? null,
        fimLocalEm: validacao.data.fimLocalEm ?? null,
      },
    });
    await registrarAuditoriaCalendarioAlpha(
      alvo.autorUserId,
      "CALENDARIO_ALPHA_EDITOU_TAREFA_COLEGA",
      `colegaId=${colegaId} tarefaCacheId=${tarefa.id}`,
    );
    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { id: tarefa.id } };
  } catch {
    return { success: false, error: "Não foi possível atualizar a tarefa na agenda compartilhada." };
  }
}

export async function concluirTarefaParaColega(
  colegaId: number,
  input: z.input<typeof concluirTarefaColegaSchema>,
): Promise<ResultadoAcao<{ id: string }>> {
  const alvo = await resolverAlvoGravavel(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = concluirTarefaColegaSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: "Tarefa inválida." };
  const tarefa = await db.googleCalendarTaskCache.findFirst({
    where: {
      id: validacao.data.tarefaCacheId,
      taskList: { conexao: { userId: alvo.colegaUserId, status: "ATIVA" } },
    },
    include: { taskList: { select: { googleTaskListId: true } } },
  });
  if (!tarefa) return { success: false, error: "Tarefa não encontrada na agenda compartilhada." };

  try {
    const atualizada = await concluirTarefaGoogleTasks({
      emailUsuario: alvo.colegaEmail,
      taskListId: tarefa.taskList.googleTaskListId,
      taskId: tarefa.googleTaskId,
    });
    await db.googleCalendarTaskCache.update({ where: { id: tarefa.id }, data: atualizada });
    await registrarAuditoriaCalendarioAlpha(
      alvo.autorUserId,
      "CALENDARIO_ALPHA_CONCLUIU_TAREFA_COLEGA",
      `colegaId=${colegaId} tarefaCacheId=${tarefa.id}`,
    );
    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { id: tarefa.id } };
  } catch {
    return { success: false, error: "Não foi possível concluir a tarefa na agenda compartilhada." };
  }
}

/** Carrega do Google o evento completo de um colega antes da edição por vínculo EDITOR. */
export async function carregarDetalhesEventoColegaParaEdicao(
  colegaId: number,
  input: CarregarDetalhesEventoColegaInput,
): Promise<ResultadoAcao<GoogleEventoDTO>> {
  const alvo = await resolverAlvoGravavel(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = detalhesEventoColegaSchema.safeParse(input);
  if (!validacao.success) {
    return { success: false, error: primeiroErroZod(validacao.error) };
  }
  const dados = validacao.data;

  try {
    const calendario = await resolverCalendarioGravavelDoColega(
      alvo.colegaEmail,
      dados.calendarId,
    );
    if (!calendario.ok) return { success: false, error: calendario.error };

    const evento = await obterEventoGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: calendario.calendarId,
      googleEventId: dados.googleEventId,
    });
    return { success: true, data: evento };
  } catch (erro) {
    if (
      erro instanceof GoogleCalendarError &&
      (erro.kind === "not_found" || erro.kind === "gone")
    ) {
      return { success: false, error: "Evento não encontrado na agenda do colaborador." };
    }
    return {
      success: false,
      error: "Não foi possível carregar os detalhes do evento do colaborador agora.",
    };
  }
}

export async function criarEventoParaColega(
  colegaId: number,
  input: CriarEventoInput,
): Promise<ResultadoAcao<{ googleEventId: string }>> {
  const alvo = await resolverAlvoGravavel(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = criarEventoSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  try {
    const calendario = await resolverCalendarioGravavelDoColega(
      alvo.colegaEmail,
      dados.calendarId,
    );
    if (!calendario.ok) return { success: false, error: calendario.error };
    const eventoCriado = await criarEventoGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: calendario.calendarId,
      evento: paraInputEventoGoogle(dados),
    });

    await registrarAuditoriaCalendarioAlpha(
      alvo.autorUserId,
      "CALENDARIO_ALPHA_CRIOU_EVENTO_COLEGA",
      `colegaId=${colegaId} googleEventId=${eventoCriado.googleEventId}`,
    );

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { googleEventId: eventoCriado.googleEventId } };
  } catch {
    return { success: false, error: "Não foi possível criar o evento na agenda do colaborador." };
  }
}

export async function atualizarEventoParaColega(
  colegaId: number,
  input: AtualizarEventoInput,
): Promise<ResultadoAcao<{ conflito: boolean }>> {
  const alvo = await resolverAlvoGravavel(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = atualizarEventoSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;
  if (!dados.etagConhecido) {
    return {
      success: false,
      error: "Abra novamente o evento para carregar a versão atual antes de salvar.",
    };
  }

  try {
    const calendario = await resolverCalendarioGravavelDoColega(
      alvo.colegaEmail,
      dados.calendarId,
    );
    if (!calendario.ok) return { success: false, error: calendario.error };
    await atualizarEventoParcialGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: calendario.calendarId,
      googleEventId: dados.googleEventId,
      etagConhecido: dados.etagConhecido,
      evento: paraInputEventoParcialGoogle(dados, calendario.timezone, true),
    });

    await registrarAuditoriaCalendarioAlpha(
      alvo.autorUserId,
      "CALENDARIO_ALPHA_EDITOU_EVENTO_COLEGA",
      `colegaId=${colegaId} googleEventId=${dados.googleEventId}`,
    );

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { conflito: false } };
  } catch (erro) {
    if (erro instanceof GoogleCalendarError && erro.status === 412) {
      return { success: true, data: { conflito: true } };
    }
    return { success: false, error: "Não foi possível atualizar o evento na agenda do colaborador." };
  }
}

/**
 * Variante parcial para a Agenda Alpha. O calendário é sempre revalidado contra a conta Workspace do
 * colega resolvida pelo servidor; um `calendarId` arbitrário do chamador não autoriza impersonation.
 */
export async function atualizarEventoParcialParaColega(
  colegaId: number,
  input: AtualizarEventoParcialInput,
): Promise<ResultadoAcao<ResultadoAtualizacaoParcial>> {
  const alvo = await resolverAlvoGravavel(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = atualizarEventoParcialSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  try {
    const calendario = await resolverCalendarioGravavelDoColega(
      alvo.colegaEmail,
      dados.calendarId,
    );
    if (!calendario.ok) return { success: false, error: calendario.error };

    const calendarioCache = await db.googleCalendarSelecionado.findFirst({
      where: {
        conexao: { userId: alvo.colegaUserId },
        googleCalendarId: dados.calendarId,
      },
    });
    const eventoCache = calendarioCache
      ? await db.googleCalendarEventoCache.findUnique({
          where: {
            calendarioId_googleEventId: {
              calendarioId: calendarioCache.id,
              googleEventId: dados.googleEventId,
            },
          },
        })
      : null;

    if (dados.etagConhecido && eventoCache && eventoCache.etag !== dados.etagConhecido) {
      return { success: true, data: { conflito: true, evento: null } };
    }
    const etagParaPatch = dados.etagConhecido ?? eventoCache?.etag;
    if (!etagParaPatch) {
      return {
        success: false,
        error: "Abra novamente o evento para carregar a versão atual antes de salvar.",
      };
    }

    const eventoAtualizado = await atualizarEventoParcialGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: calendario.calendarId,
      googleEventId: dados.googleEventId,
      etagConhecido: etagParaPatch,
      evento: paraInputEventoParcialGoogle(
        dados,
        calendario.timezone,
      ),
    });

    if (calendarioCache) {
      const dadosCache = dadosCacheDeEvento(eventoAtualizado);
      await db.googleCalendarEventoCache.upsert({
        where: {
          calendarioId_googleEventId: {
            calendarioId: calendarioCache.id,
            googleEventId: dados.googleEventId,
          },
        },
        create: {
          calendarioId: calendarioCache.id,
          googleEventId: eventoAtualizado.googleEventId,
          ...dadosCache,
        },
        update: dadosCache,
      });
    }

    await registrarAuditoriaCalendarioAlpha(
      alvo.autorUserId,
      "CALENDARIO_ALPHA_EDITOU_EVENTO_COLEGA",
      `colegaId=${colegaId} googleEventId=${dados.googleEventId}`,
    );

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
    return {
      success: false,
      error: "Não foi possível atualizar o evento na agenda do colaborador.",
    };
  }
}

export async function cancelarEventoParaColega(
  colegaId: number,
  input: CancelarEventoInput,
): Promise<ResultadoAcao<{ ok: true }>> {
  const alvo = await resolverAlvoGravavel(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = cancelarEventoSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  try {
    const calendario = await resolverCalendarioGravavelDoColega(
      alvo.colegaEmail,
      dados.calendarId,
    );
    if (!calendario.ok) return { success: false, error: calendario.error };
    await cancelarEventoGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: calendario.calendarId,
      googleEventId: dados.googleEventId,
      etagConhecido: dados.etagConhecido,
    });

    await registrarAuditoriaCalendarioAlpha(
      alvo.autorUserId,
      "CALENDARIO_ALPHA_CANCELOU_EVENTO_COLEGA",
      `colegaId=${colegaId} googleEventId=${dados.googleEventId}`,
    );

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { ok: true } };
  } catch (erro) {
    if (erro instanceof GoogleCalendarError && erro.status === 412) {
      return {
        success: false,
        error:
          "O evento mudou desde a última leitura. Consulte a agenda do colaborador novamente antes de cancelar.",
      };
    }
    return { success: false, error: "Não foi possível cancelar o evento na agenda do colaborador." };
  }
}

/** Registra a resposta (aceitar/recusar/talvez) ao convite de um evento na agenda de um colaborador. */
export async function responderConviteParaColega(
  colegaId: number,
  input: ResponderConviteInput,
): Promise<ResultadoAcao<GoogleEventoDTO>> {
  const alvo = await resolverAlvoGravavel(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = responderConviteSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  try {
    const calendario = await resolverCalendarioGravavelDoColega(alvo.colegaEmail, dados.calendarId);
    if (!calendario.ok) return { success: false, error: calendario.error };

    const evento = await responderConviteGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: calendario.calendarId,
      googleEventId: dados.googleEventId,
      resposta: dados.resposta,
      etagConhecido: dados.etagConhecido,
    });

    await registrarAuditoriaCalendarioAlpha(
      alvo.autorUserId,
      "CALENDARIO_ALPHA_RESPONDEU_CONVITE_COLEGA",
      `colegaId=${colegaId} googleEventId=${dados.googleEventId} resposta=${dados.resposta}`,
    );

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: evento };
  } catch (erro) {
    if (erro instanceof GoogleCalendarError && erro.status === 412) {
      return {
        success: false,
        error: "O evento mudou desde a última leitura. Consulte a agenda do colaborador novamente antes de responder.",
      };
    }
    if (erro instanceof GoogleCalendarError && erro.kind === "invalid_request") {
      return { success: false, error: erro.message };
    }
    return { success: false, error: "Não foi possível registrar a resposta na agenda do colaborador." };
  }
}
