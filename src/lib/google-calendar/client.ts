import { calendar_v3, google } from "googleapis";

type ClienteJWT = InstanceType<typeof google.auth.JWT>;

import { classificarErroGoogle, GoogleCalendarError } from "./errors";
import { ESCOPOS_CALENDARIO_ALPHA } from "./scopes";
import type { AtualizarEventoParcialInput } from "../validations/google-calendar";
import type {
  CriarOuAtualizarEventoInput,
  FreeBusyResultadoDTO,
  GoogleCalendarioDTO,
  GoogleEventoDTO,
  ResultadoPaginaEventos,
} from "./types";

const MAX_TENTATIVAS_RETRY = 3;
const JANELA_MAXIMA_CONSULTA_DIAS = 400;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Executa uma chamada à Google Calendar API com retry/backoff apenas para erros retryable (429/5xx). */
async function executarComRetry<T>(chamada: () => Promise<T>): Promise<T> {
  let tentativa = 0;
  for (;;) {
    try {
      return await chamada();
    } catch (erroOriginal) {
      const erro = classificarErroGoogle(erroOriginal);
      if (!erro.retryable || tentativa >= MAX_TENTATIVAS_RETRY - 1) {
        throw erro;
      }
      await esperar((erro.retryAfterMs ?? 500) * 2 ** tentativa);
      tentativa += 1;
    }
  }
}

function obterEnvObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} não configurada.`);
  return valor;
}

/**
 * Credenciais da Service Account com Domain-Wide Delegation. A chave privada é gravada no `.env`
 * com `\n` literais (padrão de exportação do Google) — decodificados aqui para quebras de linha reais.
 */
function obterCredenciaisServiceAccount(): { email: string; chavePrivada: string } {
  const email = obterEnvObrigatoria("GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL");
  const chavePrivada = obterEnvObrigatoria("GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
  return { email, chavePrivada };
}

/**
 * Reutiliza o mesmo cliente JWT por `emailUsuario` por alguns minutos — evita uma troca de
 * token nova a cada chamada (ex: cada página de uma sincronização longa). O próprio
 * `google.auth.JWT` já cacheia/renova o access token internamente enquanto a instância viver.
 */
const CACHE_CLIENTES_TTL_MS = 45 * 60 * 1000; // margem segura abaixo da validade de ~1h do access token
const clientesImpersonadosCache = new Map<string, { cliente: ClienteJWT; criadoEm: number }>();

/**
 * Cliente autenticado como a Service Account, impersonando `emailUsuario` (Domain-Wide Delegation).
 * `emailUsuario` DEVE vir sempre de `usuarios.email` da sessão autenticada no servidor —
 * nunca de um valor fornecido pelo cliente (isso permitiria impersonar qualquer colaborador).
 */
function clienteImpersonado(emailUsuario: string): ClienteJWT {
  const existente = clientesImpersonadosCache.get(emailUsuario);
  if (existente && Date.now() - existente.criadoEm < CACHE_CLIENTES_TTL_MS) {
    return existente.cliente;
  }

  const { email, chavePrivada } = obterCredenciaisServiceAccount();
  const cliente = new google.auth.JWT({
    email,
    key: chavePrivada,
    scopes: [...ESCOPOS_CALENDARIO_ALPHA],
    subject: emailUsuario,
  });
  clientesImpersonadosCache.set(emailUsuario, { cliente, criadoEm: Date.now() });
  return cliente;
}

function clienteCalendar(emailUsuario: string): calendar_v3.Calendar {
  return google.calendar({ version: "v3", auth: clienteImpersonado(emailUsuario) });
}

/** Lista os calendários autorizados do usuário (calendarList, não os metadados completos do calendário). */
export async function listarCalendarios(emailUsuario: string): Promise<GoogleCalendarioDTO[]> {
  const calendar = clienteCalendar(emailUsuario);
  try {
    const resposta = await executarComRetry(() => calendar.calendarList.list({ maxResults: 250 }));
    return (resposta.data.items ?? []).map((item) => ({
      googleCalendarId: item.id ?? "",
      nome: item.summaryOverride ?? item.summary ?? item.id ?? "Sem nome",
      corHex: item.backgroundColor ?? null,
      timezone: item.timeZone ?? "UTC",
      papelAcesso: (item.accessRole as GoogleCalendarioDTO["papelAcesso"]) ?? "reader",
      principal: item.primary === true,
    }));
  } catch (erroOriginal) {
    throw classificarErroGoogle(erroOriginal);
  }
}

export interface IniciarWatchEventosInput {
  emailUsuario: string;
  calendarId: string;
  channelId: string;
  channelToken: string;
  webhookUrl: string;
  expirationMs: number;
}

export interface WatchEventosAtivo {
  googleChannelId: string;
  googleResourceId: string;
  resourceUri: string | null;
  expiresAt: Date;
}

/**
 * Registra um canal `events.watch`. O subject DWD continua sendo fornecido pelo
 * chamador server-side; nunca use valores recebidos do webhook nesta função.
 */
export async function iniciarWatchEventos(
  input: IniciarWatchEventosInput,
): Promise<WatchEventosAtivo> {
  const calendar = clienteCalendar(input.emailUsuario);
  try {
    const resposta = await calendar.events.watch({
      calendarId: input.calendarId,
      requestBody: {
        id: input.channelId,
        type: "web_hook",
        address: input.webhookUrl,
        token: input.channelToken,
        expiration: String(input.expirationMs),
      },
    });
    const googleChannelId = resposta.data.id?.trim();
    const googleResourceId = resposta.data.resourceId?.trim();
    const expiration = Number(resposta.data.expiration);
    if (
      !googleChannelId ||
      !googleResourceId ||
      !Number.isSafeInteger(expiration) ||
      expiration <= Date.now()
    ) {
      throw new GoogleCalendarError("Resposta inválida ao criar canal push.", {
        kind: "invalid_request",
      });
    }
    return {
      googleChannelId,
      googleResourceId,
      resourceUri: resposta.data.resourceUri?.trim() || null,
      expiresAt: new Date(expiration),
    };
  } catch (erroOriginal) {
    if (erroOriginal instanceof GoogleCalendarError) throw erroOriginal;
    throw classificarErroGoogle(erroOriginal);
  }
}

export interface EncerrarWatchEventosInput {
  emailUsuario: string;
  channelId: string;
  resourceId: string;
}

/** Encerra um canal usando o par opaco channel/resource devolvido pelo Google. */
export async function encerrarWatchEventos(
  input: EncerrarWatchEventosInput,
): Promise<void> {
  const calendar = clienteCalendar(input.emailUsuario);
  try {
    await calendar.channels.stop({
      requestBody: {
        id: input.channelId,
        resourceId: input.resourceId,
      },
    });
  } catch (erroOriginal) {
    throw classificarErroGoogle(erroOriginal);
  }
}

function paraGoogleEventoDataDTO(data: calendar_v3.Schema$EventDateTime | undefined) {
  return {
    dataHora: data?.dateTime ?? undefined,
    data: data?.date ?? undefined,
    timezone: data?.timeZone ?? undefined,
  };
}

function mapEventoParaDTO(evento: calendar_v3.Schema$Event): GoogleEventoDTO {
  const entradasConferencia = evento.conferenceData?.entryPoints ?? [];
  const linkMeet = entradasConferencia.find((entrada) => entrada.entryPointType === "video")?.uri ?? null;

  return {
    googleEventId: evento.id ?? "",
    status: (evento.status as GoogleEventoDTO["status"]) ?? "confirmed",
    titulo: evento.summary ?? null,
    descricao: evento.description ?? null,
    localizacao: evento.location ?? null,
    inicio: paraGoogleEventoDataDTO(evento.start),
    fim: paraGoogleEventoDataDTO(evento.end),
    diaInteiro: Boolean(evento.start?.date && !evento.start?.dateTime),
    recorrenciaRegras: evento.recurrence ?? null,
    eventoRecorrenteIdOrigem: evento.recurringEventId ?? null,
    participantes: (evento.attendees ?? []).map((participante) => ({
      email: participante.email ?? "",
      nome: participante.displayName ?? null,
      status: (participante.responseStatus as "needsAction" | "accepted" | "declined" | "tentative") ?? "needsAction",
      organizador: participante.organizer === true,
    })),
    conferencia: evento.conferenceData ? {
      videoUrl: linkMeet,
      telefones: entradasConferencia
        .filter((entrada) => entrada.entryPointType === "phone" && entrada.uri)
        .map((entrada) => entrada.uri!),
    } : null,
    linkMeet,
    etag: evento.etag ?? "",
    atualizadoEm: evento.updated ?? new Date().toISOString(),
    visibilidade: (evento.visibility as GoogleEventoDTO["visibilidade"]) ?? "default",
    eventType: (evento.eventType as GoogleEventoDTO["eventType"]) ?? "default",
    statusPropertiesJson: (() => {
      // `self` é definido pela Calendar API para o participante que corresponde
      // ao usuário impersonado. Ele permite reproduzir o visual de convite
      // recusado do Google Calendar sem depender de e-mail no cliente.
      const respostaDoUsuario = evento.attendees?.find((participante) => participante.self === true)?.responseStatus ?? null;
      const compartilhadoComUsuario = Boolean(
        evento.organizer?.email && evento.organizer.self !== true,
      );
      const statusProperties = {
        focusTimeProperties: evento.focusTimeProperties,
        outOfOfficeProperties: evento.outOfOfficeProperties,
        workingLocationProperties: evento.workingLocationProperties,
        respostaDoUsuario,
        compartilhadoComUsuario,
      };
      if (!Object.values(statusProperties).some(Boolean)) return null;
      return JSON.stringify(statusProperties) ?? null;
    })(),
  };
}

interface ObterEventoParams {
  emailUsuario: string;
  calendarId: string;
  googleEventId: string;
}

/** Carrega o recurso completo diretamente do Google antes de uma edição. */
export async function obterEvento(params: ObterEventoParams): Promise<GoogleEventoDTO> {
  const calendar = clienteCalendar(params.emailUsuario);
  try {
    const resposta = await executarComRetry(() =>
      calendar.events.get({
        calendarId: params.calendarId,
        eventId: params.googleEventId,
      }),
    );
    return mapEventoParaDTO(resposta.data);
  } catch (erroOriginal) {
    throw classificarErroGoogle(erroOriginal);
  }
}

interface ListarEventosPaginaParams {
  emailUsuario: string;
  calendarId: string;
  pageToken?: string;
  /** Se presente, faz sync incremental (ignora timeMin/timeMax — regra da própria Google API). */
  syncToken?: string;
  timeMin?: string;
  timeMax?: string;
}

/** Lista uma página de eventos — full sync (timeMin/timeMax) ou incremental (syncToken), nunca os dois juntos. */
export async function listarEventosPagina(params: ListarEventosPaginaParams): Promise<ResultadoPaginaEventos> {
  const calendar = clienteCalendar(params.emailUsuario);
  try {
    const resposta = await executarComRetry(() =>
      calendar.events.list({
        calendarId: params.calendarId,
        pageToken: params.pageToken,
        syncToken: params.syncToken,
        timeMin: params.syncToken ? undefined : params.timeMin,
        timeMax: params.syncToken ? undefined : params.timeMax,
        singleEvents: true,
        showDeleted: true,
        maxResults: 250,
      }),
    );

    return {
      eventos: (resposta.data.items ?? []).map(mapEventoParaDTO),
      proximoPageToken: resposta.data.nextPageToken ?? null,
      proximoSyncToken: resposta.data.nextSyncToken ?? null,
    };
  } catch (erroOriginal) {
    // 410 (Gone) precisa subir intacto — quem chama decide fazer full sync.
    throw classificarErroGoogle(erroOriginal);
  }
}

interface ConsultarFreeBusyParams {
  emailUsuario: string;
  googleCalendarIds: string[];
  timeMin: string;
  timeMax: string;
}

/** Consulta disponibilidade sem revelar título/descrição — usar sempre que FreeBusy for suficiente. */
export async function consultarFreeBusy(params: ConsultarFreeBusyParams): Promise<FreeBusyResultadoDTO> {
  const intervaloMs = new Date(params.timeMax).getTime() - new Date(params.timeMin).getTime();
  if (intervaloMs <= 0 || intervaloMs > JANELA_MAXIMA_CONSULTA_DIAS * 24 * 60 * 60 * 1000) {
    throw new GoogleCalendarError("Janela de consulta de disponibilidade inválida.", { kind: "invalid_request" });
  }

  const calendar = clienteCalendar(params.emailUsuario);
  try {
    const resposta = await executarComRetry(() =>
      calendar.freebusy.query({
        requestBody: {
          timeMin: params.timeMin,
          timeMax: params.timeMax,
          items: params.googleCalendarIds.map((id) => ({ id })),
        },
      }),
    );

    const resultado: FreeBusyResultadoDTO = {};
    for (const [calendarId, dados] of Object.entries(resposta.data.calendars ?? {})) {
      resultado[calendarId] = {
        ocupado: (dados.busy ?? []).map((intervalo) => ({
          inicio: intervalo.start ?? "",
          fim: intervalo.end ?? "",
        })),
        erro: dados.errors?.[0]?.reason ?? undefined,
      };
    }
    return resultado;
  } catch (erroOriginal) {
    throw classificarErroGoogle(erroOriginal);
  }
}

function paraSchemaEvento(input: CriarOuAtualizarEventoInput): calendar_v3.Schema$Event {
  const dataInicio = input.diaInteiro
    ? { date: input.inicio.toISOString().slice(0, 10) }
    : { dateTime: input.inicio.toISOString(), timeZone: input.timezone };
  const dataFim = input.diaInteiro
    ? { date: input.fim.toISOString().slice(0, 10) }
    : { dateTime: input.fim.toISOString(), timeZone: input.timezone };

  const eventType = input.eventType ?? "default";
  const statusProperties = eventType === "focusTime"
    ? { focusTimeProperties: { autoDeclineMode: "declineNone" as const } }
    : eventType === "outOfOffice"
      ? { outOfOfficeProperties: { autoDeclineMode: "declineNone" as const } }
      : eventType === "workingLocation"
        ? { workingLocationProperties: { type: "homeOffice" as const } }
        : {};
  return {
    summary: input.titulo,
    description: input.descricaoGoogle,
    location: input.localizacao,
    start: dataInicio,
    end: dataFim,
    attendees: input.participantes.map((email) => ({ email })),
    recurrence: input.recorrenciaRegras,
    visibility: input.visibilidade,
    transparency: input.transparencia,
    reminders: input.lembretesMinutos
      ? {
          useDefault: input.lembretesMinutos.length === 0,
          overrides: input.lembretesMinutos.map((minutes) => ({ method: "popup" as const, minutes })),
        }
      : undefined,
    conferenceData: input.criarMeet
      ? {
          createRequest: {
            requestId: `calalpha-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        }
      : undefined,
    eventType,
    ...statusProperties,
  };
}

export type AtualizarEventoParcialGoogleInput = Omit<
  AtualizarEventoParcialInput,
  "calendarId" | "googleEventId" | "etagConhecido"
>;

/**
 * Constrói o payload de `events.patch` apenas com campos explicitamente informados.
 * Propriedades ausentes não entram no JSON e, portanto, não apagam dados já existentes no Google.
 */
export function paraSchemaEventoParcial(input: AtualizarEventoParcialGoogleInput): calendar_v3.Schema$Event {
  const evento: calendar_v3.Schema$Event = {};

  if (input.titulo !== undefined) evento.summary = input.titulo;
  if (input.descricaoGoogle !== undefined) evento.description = input.descricaoGoogle;
  if (input.localizacao !== undefined) evento.location = input.localizacao;
  if (input.participantes !== undefined) {
    evento.attendees = input.participantes.map((email) => ({ email }));
  }

  if (input.inicio !== undefined && input.fim !== undefined && input.diaInteiro !== undefined) {
    evento.start = input.diaInteiro
      ? { date: input.inicio.toISOString().slice(0, 10) }
      : { dateTime: input.inicio.toISOString(), timeZone: input.timezone };
    evento.end = input.diaInteiro
      ? { date: input.fim.toISOString().slice(0, 10) }
      : { dateTime: input.fim.toISOString(), timeZone: input.timezone };
  }

  if (input.criarMeet === true) {
    evento.conferenceData = {
      createRequest: {
        requestId: `calalpha-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  return evento;
}

/**
 * Preserva metadados gerenciados pelo Google para participantes mantidos
 * (responseStatus, optional, resource, organizer etc.). Novos e-mails recebem
 * apenas o objeto mínimo aceito pela API.
 */
export function mesclarParticipantesGoogle(
  existentes: calendar_v3.Schema$EventAttendee[],
  emailsSolicitados: string[],
): calendar_v3.Schema$EventAttendee[] {
  const porEmail = new Map<string, calendar_v3.Schema$EventAttendee>();
  for (const participante of existentes) {
    if (participante.email) {
      porEmail.set(participante.email.trim().toLowerCase(), participante);
    }
  }
  const unicos = Array.from(
    new Set(emailsSolicitados.map((email) => email.trim().toLowerCase())),
  );

  return unicos.map((email) => {
    const existente = porEmail.get(email);
    return existente ? { ...existente, email: existente.email ?? email } : { email };
  });
}

interface CriarEventoParams {
  emailUsuario: string;
  calendarId: string;
  evento: CriarOuAtualizarEventoInput;
}

export async function criarEvento(params: CriarEventoParams): Promise<GoogleEventoDTO> {
  const calendar = clienteCalendar(params.emailUsuario);
  try {
    const resposta = await executarComRetry(() =>
      calendar.events.insert({
        calendarId: params.calendarId,
        requestBody: paraSchemaEvento(params.evento),
        conferenceDataVersion: params.evento.criarMeet ? 1 : 0,
      }),
    );
    return mapEventoParaDTO(resposta.data);
  } catch (erroOriginal) {
    throw classificarErroGoogle(erroOriginal);
  }
}

interface AtualizarEventoParams {
  emailUsuario: string;
  calendarId: string;
  googleEventId: string;
  evento: CriarOuAtualizarEventoInput;
}

export async function atualizarEvento(params: AtualizarEventoParams): Promise<GoogleEventoDTO> {
  const calendar = clienteCalendar(params.emailUsuario);
  try {
    const resposta = await executarComRetry(() =>
      calendar.events.update({
        calendarId: params.calendarId,
        eventId: params.googleEventId,
        requestBody: paraSchemaEvento(params.evento),
        conferenceDataVersion: params.evento.criarMeet ? 1 : 0,
      }),
    );
    return mapEventoParaDTO(resposta.data);
  } catch (erroOriginal) {
    throw classificarErroGoogle(erroOriginal);
  }
}

interface AtualizarEventoParcialParams {
  emailUsuario: string;
  calendarId: string;
  googleEventId: string;
  etagConhecido?: string;
  evento: AtualizarEventoParcialGoogleInput;
}

export async function atualizarEventoParcial(params: AtualizarEventoParcialParams): Promise<GoogleEventoDTO> {
  const calendar = clienteCalendar(params.emailUsuario);
  try {
    const requestBody = paraSchemaEventoParcial(params.evento);
    if (params.evento.participantes !== undefined) {
      const eventoAtual = await executarComRetry(() =>
        calendar.events.get({
          calendarId: params.calendarId,
          eventId: params.googleEventId,
        }),
      );
      requestBody.attendees = mesclarParticipantesGoogle(
        eventoAtual.data.attendees ?? [],
        params.evento.participantes,
      );
    }

    const resposta = await executarComRetry(() =>
      calendar.events.patch(
        {
          calendarId: params.calendarId,
          eventId: params.googleEventId,
          requestBody,
          // Mantém suporte a conferenceData também quando o Meet existente foi apenas preservado.
          conferenceDataVersion: 1,
        },
        params.etagConhecido
          ? {
              headers: { "If-Match": params.etagConhecido },
            }
          : undefined,
      ),
    );
    return mapEventoParaDTO(resposta.data);
  } catch (erroOriginal) {
    if (erroOriginal instanceof GoogleCalendarError) throw erroOriginal;
    throw classificarErroGoogle(erroOriginal);
  }
}

interface CancelarEventoParams {
  emailUsuario: string;
  calendarId: string;
  googleEventId: string;
  etagConhecido?: string;
}

const MAX_TENTATIVAS_CONFIRMACAO_CANCELAMENTO = 3;

function normalizarErroGoogle(erroOriginal: unknown): GoogleCalendarError {
  return erroOriginal instanceof GoogleCalendarError
    ? erroOriginal
    : classificarErroGoogle(erroOriginal);
}

async function confirmarEventoCancelado(
  calendar: calendar_v3.Calendar,
  params: Pick<CancelarEventoParams, "calendarId" | "googleEventId">,
): Promise<void> {
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_CONFIRMACAO_CANCELAMENTO; tentativa += 1) {
    try {
      const resposta = await executarComRetry(() =>
        calendar.events.get({
          calendarId: params.calendarId,
          eventId: params.googleEventId,
        }),
      );

      if (resposta.data.status === "cancelled") return;
    } catch (erroOriginal) {
      const erro = normalizarErroGoogle(erroOriginal);
      if (erro.kind === "not_found" || erro.kind === "gone") return;
      throw erro;
    }

    if (tentativa < MAX_TENTATIVAS_CONFIRMACAO_CANCELAMENTO - 1) {
      await esperar(100 * 2 ** tentativa);
    }
  }

  throw new GoogleCalendarError(
    "O Google Calendar não confirmou o cancelamento do evento.",
    { kind: "unknown" },
  );
}

/**
 * Idempotente: evento já removido/inexistente (404/410) é tratado como já cancelado.
 * Depois de um DELETE aceito, confirma a ausência (ou o status `cancelled`) antes do sucesso.
 */
export async function cancelarEvento(
  params: CancelarEventoParams,
): Promise<{ jaEstavaCancelado: boolean; confirmado: true }> {
  const calendar = clienteCalendar(params.emailUsuario);
  try {
    await executarComRetry(() =>
      calendar.events.delete(
        {
          calendarId: params.calendarId,
          eventId: params.googleEventId,
        },
        params.etagConhecido
          ? {
              headers: { "If-Match": params.etagConhecido },
            }
          : undefined,
      ),
    );
  } catch (erroOriginal) {
    const erro = normalizarErroGoogle(erroOriginal);
    if (erro.kind === "not_found" || erro.kind === "gone") {
      return { jaEstavaCancelado: true, confirmado: true };
    }
    throw erro;
  }

  await confirmarEventoCancelado(calendar, params);
  return { jaEstavaCancelado: false, confirmado: true };
}
