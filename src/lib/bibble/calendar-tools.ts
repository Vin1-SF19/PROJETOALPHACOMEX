import { z } from "zod";

import db from "@/lib/prisma";
import {
  formatarDataCalendarioParaBibble,
  TIMEZONE_CALENDARIO_BIBBLE,
} from "@/lib/bibble/calendar-timezone";

const TIMEZONE_PADRAO = TIMEZONE_CALENDARIO_BIBBLE;
const MS_DIA = 24 * 60 * 60 * 1000;
const JANELA_MAXIMA_DIAS = 60;
const MAX_EVENTOS_RESPOSTA = 200;
const ISO_DATA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATA_HORA_COM_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export interface CalendarToolContext {
  userId: number;
  role: string;
  permissoes: string[];
  confirmouCancelamentoCalendario?: boolean;
}

const CALENDAR_TOOL_NAMES = new Set([
  "listar_calendarios_calendario",
  "listar_eventos_calendario",
  "criar_evento_calendario",
  "editar_evento_calendario",
  "cancelar_evento_calendario",
  "consultar_disponibilidade_calendario",
  "consultar_agenda_colega",
  "criar_evento_calendario_colega",
  "editar_evento_calendario_colega",
  "cancelar_evento_calendario_colega",
]);

const textoCurto = z.string().trim().min(1).max(300);
const nomeCalendarioSchema = z.string().trim().min(1).max(300).optional();
const dataFlexivelSchema = z
  .string()
  .trim()
  .refine((valor) => ISO_DATA_CIVIL.test(valor) || ISO_DATA_HORA_COM_OFFSET.test(valor), {
    message: "Use YYYY-MM-DD ou data/hora ISO com offset (ex.: 2026-07-23T14:00:00-03:00).",
  });
const dataHoraOffsetSchema = z
  .string()
  .trim()
  .regex(
    ISO_DATA_HORA_COM_OFFSET,
    "Use data/hora ISO com offset (ex.: 2026-07-23T14:00:00-03:00).",
  );
const participantesTextoSchema = z
  .string()
  .trim()
  .max(5000)
  .superRefine((valor, ctx) => {
    const emails = valor
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);
    if (emails.length > 50) {
      ctx.addIssue({ code: "custom", message: "Máximo de 50 participantes." });
      return;
    }
    if (emails.some((email) => !z.string().email().safeParse(email).success)) {
      ctx.addIssue({
        code: "custom",
        message: "Participantes devem ser e-mails válidos separados por vírgula.",
      });
    }
  });

const periodoSchema = z
  .object({
    dias_a_frente: z.number().int().min(1).max(60).optional(),
    data_inicio: dataFlexivelSchema.optional(),
    data_fim: dataFlexivelSchema.optional(),
    calendario_nome: nomeCalendarioSchema,
  })
  .strict()
  .superRefine((dados, ctx) => validarPeriodo(dados, ctx));

const eventoBaseSemCalendario = {
  titulo: textoCurto,
  data_inicio: dataFlexivelSchema,
  data_fim: dataFlexivelSchema.optional(),
  dia_inteiro: z.boolean().optional(),
  descricao: z.string().trim().max(8000).optional(),
  local: z.string().trim().max(300).optional(),
  participantes: participantesTextoSchema.optional(),
  criar_meet: z.boolean().optional(),
};
const eventoBase = {
  ...eventoBaseSemCalendario,
  calendario_nome: nomeCalendarioSchema,
};

const criarEventoSchema = z
  .object(eventoBase)
  .strict()
  .superRefine((dados, ctx) => validarDatasEvento(dados, ctx));

const editarEventoBaseSemCalendario = {
  google_event_id: z.string().trim().min(1).max(1024),
  etag: z.string().trim().min(1).max(1024),
  titulo: textoCurto.optional(),
  data_inicio: dataFlexivelSchema.optional(),
  data_fim: dataFlexivelSchema.optional(),
  dia_inteiro: z.boolean().optional(),
  descricao: z.string().trim().max(8000).optional(),
  local: z.string().trim().max(300).optional(),
  participantes: participantesTextoSchema.optional(),
  criar_meet: z.literal(true).optional(),
};

const editarEventoSchema = z
  .object({
    ...editarEventoBaseSemCalendario,
    calendario_nome: nomeCalendarioSchema,
  })
  .strict()
  .superRefine((dados, ctx) => validarEdicaoEvento(dados, ctx));

const cancelarEventoBaseSemCalendario = {
  google_event_id: z.string().trim().min(1).max(1024),
  etag: z.string().trim().min(1).max(1024),
  confirmado: z.literal(true, {
    error: "O cancelamento só pode ser executado após confirmação explícita do usuário.",
  }),
};
const cancelarEventoSchema = z
  .object({ ...cancelarEventoBaseSemCalendario, calendario_nome: nomeCalendarioSchema })
  .strict();

const disponibilidadeSchema = z
  .object({
    data_inicio: dataHoraOffsetSchema,
    data_fim: dataHoraOffsetSchema,
    calendario_nome: nomeCalendarioSchema,
  })
  .strict();

const colegaPeriodoSchema = z
  .object({
    dias_a_frente: z.number().int().min(1).max(60).optional(),
    data_inicio: dataFlexivelSchema.optional(),
    data_fim: dataFlexivelSchema.optional(),
    nome_ou_email: z.string().trim().min(1).max(320),
  })
  .strict()
  .superRefine((dados, ctx) => validarPeriodo(dados, ctx));

const colegaCriarSchema = z
  .object({
    ...eventoBaseSemCalendario,
    colega_nome_ou_email: z.string().trim().min(1).max(320),
  })
  .strict()
  .superRefine((dados, ctx) => validarDatasEvento(dados, ctx));

const colegaEditarSchema = z
  .object({
    ...editarEventoBaseSemCalendario,
    colega_nome_ou_email: z.string().trim().min(1).max(320),
  })
  .strict()
  .superRefine((dados, ctx) => validarEdicaoEvento(dados, ctx));

const colegaCancelarSchema = z
  .object({
    ...cancelarEventoBaseSemCalendario,
    colega_nome_ou_email: z.string().trim().min(1).max(320),
  })
  .strict();

type DadosEventoCriar = z.infer<typeof criarEventoSchema>;

type CalendarioSelecionado = Awaited<ReturnType<typeof buscarCalendariosDoUsuario>>[number];

type ResolucaoCalendario =
  | { ok: true; calendario: CalendarioSelecionado }
  | { ok: false; resposta: string };

type ColegaResolvido = { id: number; nome: string; email: string };
type ResolucaoColega = { ok: true; colega: ColegaResolvido } | { ok: false; resposta: string };

function validarPeriodo(
  dados: { data_inicio?: string; data_fim?: string },
  ctx: z.RefinementCtx,
): void {
  if (Boolean(dados.data_inicio) !== Boolean(dados.data_fim)) {
    ctx.addIssue({
      code: "custom",
      message: "Informe data_inicio e data_fim juntas.",
    });
    return;
  }
  if (dados.data_inicio && dados.data_fim) {
    const inicio = limitePeriodo(dados.data_inicio, false);
    const fim = limitePeriodo(dados.data_fim, true);
    if (!intervaloEhValido(inicio, fim)) {
      ctx.addIssue({ code: "custom", message: "O intervalo informado é inválido." });
    } else if (fim.getTime() - inicio.getTime() > JANELA_MAXIMA_DIAS * MS_DIA) {
      ctx.addIssue({
        code: "custom",
        message: `O intervalo máximo para consulta é de ${JANELA_MAXIMA_DIAS} dias.`,
      });
    }
  }
}

function validarEdicaoEvento(
  dados: {
    titulo?: string;
    data_inicio?: string;
    data_fim?: string;
    dia_inteiro?: boolean;
    descricao?: string;
    local?: string;
    participantes?: string;
    criar_meet?: true;
  },
  ctx: z.RefinementCtx,
): void {
  const camposEditaveis = [
    dados.titulo,
    dados.data_inicio,
    dados.data_fim,
    dados.dia_inteiro,
    dados.descricao,
    dados.local,
    dados.participantes,
    dados.criar_meet,
  ];
  if (camposEditaveis.every((valor) => valor === undefined)) {
    ctx.addIssue({ code: "custom", message: "Informe ao menos um campo para editar." });
  }
  const camposTemporais = [dados.data_inicio, dados.data_fim, dados.dia_inteiro];
  const informouAlgumCampoTemporal = camposTemporais.some((valor) => valor !== undefined);
  const informouTodosCamposTemporais = camposTemporais.every((valor) => valor !== undefined);
  if (informouAlgumCampoTemporal && !informouTodosCamposTemporais) {
    ctx.addIssue({
      code: "custom",
      message: "Para alterar data ou horário, informe data_inicio, data_fim e dia_inteiro juntos.",
    });
  }
  validarDatasEvento(dados, ctx);
}

function validarDatasEvento(
  dados: {
    data_inicio?: string;
    data_fim?: string;
    dia_inteiro?: boolean;
  },
  ctx: z.RefinementCtx,
): void {
  const diaInteiroEfetivo =
    dados.dia_inteiro ??
    (dados.data_inicio ? ISO_DATA_CIVIL.test(dados.data_inicio) : undefined);

  for (const [campo, valor] of [
    ["data_inicio", dados.data_inicio],
    ["data_fim", dados.data_fim],
  ] as const) {
    if (!valor) continue;
    if (diaInteiroEfetivo === true && !ISO_DATA_CIVIL.test(valor)) {
      ctx.addIssue({
        code: "custom",
        path: [campo],
        message: "Eventos de dia inteiro exigem data civil YYYY-MM-DD.",
      });
    }
    if (diaInteiroEfetivo === false && !ISO_DATA_HORA_COM_OFFSET.test(valor)) {
      ctx.addIssue({
        code: "custom",
        path: [campo],
        message: "Eventos com horário exigem ISO com offset.",
      });
    }
  }
}

function json(valor: unknown): string {
  return JSON.stringify(valor);
}

function erroValidacao(erro: z.ZodError): string {
  return json({
    ok: false,
    erro: "Parâmetros inválidos.",
    detalhes: erro.issues.map((issue) => ({
      campo: issue.path.join("."),
      mensagem: issue.message,
    })),
  });
}

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function dataCivilEmSaoPaulo(valor: string): Date {
  return new Date(`${valor}T00:00:00-03:00`);
}

function paraDate(valor: string): Date {
  return ISO_DATA_CIVIL.test(valor) ? dataCivilEmSaoPaulo(valor) : new Date(valor);
}

function limitePeriodo(valor: string, ehFim: boolean): Date {
  const data = paraDate(valor);
  if (ehFim && ISO_DATA_CIVIL.test(valor)) return new Date(data.getTime() + MS_DIA);
  return data;
}

function resolverPeriodo(dados: z.infer<typeof periodoSchema>): { inicio: Date; fim: Date } {
  if (dados.data_inicio && dados.data_fim) {
    return {
      inicio: limitePeriodo(dados.data_inicio, false),
      fim: limitePeriodo(dados.data_fim, true),
    };
  }
  const inicio = new Date();
  return {
    inicio,
    fim: new Date(inicio.getTime() + (dados.dias_a_frente ?? 7) * MS_DIA),
  };
}

function participantesDeTexto(valor: string | undefined): string[] {
  if (!valor?.trim()) return [];
  return valor
    .split(",")
    .map((email) => email.trim().toLocaleLowerCase())
    .filter(Boolean);
}

function construirDatasEvento(
  dados: Pick<DadosEventoCriar, "data_inicio" | "data_fim" | "dia_inteiro">,
): { inicio: Date; fim: Date; diaInteiro: boolean } {
  const diaInteiro = dados.dia_inteiro ?? ISO_DATA_CIVIL.test(dados.data_inicio);
  const inicio = paraDate(dados.data_inicio);
  const fim = dados.data_fim
    ? paraDate(dados.data_fim)
    : new Date(inicio.getTime() + (diaInteiro ? MS_DIA : 60 * 60 * 1000));
  return { inicio, fim, diaInteiro };
}

function intervaloEhValido(inicio: Date, fim: Date): boolean {
  return (
    Number.isFinite(inicio.getTime()) &&
    Number.isFinite(fim.getTime()) &&
    fim.getTime() > inicio.getTime()
  );
}

async function buscarCalendariosDoUsuario(userId: number, apenasGravaveis = false) {
  return db.googleCalendarSelecionado.findMany({
    where: {
      conexao: { userId },
      ...(apenasGravaveis ? { gravavel: true } : {}),
    },
    select: {
      id: true,
      googleCalendarId: true,
      nome: true,
      timezone: true,
      papelAcesso: true,
      visivel: true,
      gravavel: true,
    },
    orderBy: { nome: "asc" },
  });
}

async function resolverCalendario(
  userId: number,
  nome: string | undefined,
  apenasGravaveis: boolean,
): Promise<ResolucaoCalendario> {
  const calendarios = await buscarCalendariosDoUsuario(userId, apenasGravaveis);
  if (calendarios.length === 0) {
    return {
      ok: false,
      resposta: apenasGravaveis
        ? "Nenhum calendário gravável está configurado no Calendário Alpha."
        : "Nenhum calendário está configurado no Calendário Alpha.",
    };
  }

  if (nome) {
    const busca = normalizarTexto(nome);
    const exatos = calendarios.filter((item) => normalizarTexto(item.nome) === busca);
    if (exatos.length === 1) return { ok: true, calendario: exatos[0] };

    const parciais = calendarios.filter((item) => normalizarTexto(item.nome).includes(busca));
    if (parciais.length === 1) return { ok: true, calendario: parciais[0] };
    const candidatos = (exatos.length > 1 ? exatos : parciais).map((item) => item.nome);
    return {
      ok: false,
      resposta: json({
        ok: false,
        erro: candidatos.length > 0 ? "Calendário ambíguo." : "Calendário não encontrado.",
        candidatos,
      }),
    };
  }

  const usuario = await db.usuarios.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const emailUsuario = usuario?.email.trim().toLocaleLowerCase();
  const principais = calendarios.filter((item) => {
    const id = item.googleCalendarId.trim().toLocaleLowerCase();
    return id === "primary" || Boolean(emailUsuario && id === emailUsuario);
  });
  if (principais.length === 1) return { ok: true, calendario: principais[0] };
  if (calendarios.length === 1) return { ok: true, calendario: calendarios[0] };

  return {
    ok: false,
    resposta: json({
      ok: false,
      erro: "Há mais de um calendário possível. Informe calendario_nome.",
      candidatos: calendarios.map((item) => ({
        nome: item.nome,
        gravavel: item.gravavel,
        visivel: item.visivel,
      })),
    }),
  };
}

async function resolverColega(
  ctx: CalendarToolContext,
  nomeOuEmail: string,
): Promise<ResolucaoColega> {
  const busca = normalizarTexto(nomeOuEmail);
  const termo = nomeOuEmail.trim();
  const termoEmail = termo.toLocaleLowerCase();
  let usuarios: ColegaResolvido[];

  if (ctx.role === "Admin" || ctx.role === "CEO") {
    usuarios = await db.usuarios.findMany({
      where: {
        status: "ATIVO",
        id: { not: ctx.userId },
        OR: [
          { nome: { contains: termo } },
          { email: { contains: termoEmail } },
        ],
      },
      select: { id: true, nome: true, email: true },
      orderBy: { nome: "asc" },
      take: 11,
    });
  } else {
    const compartilhados = await db.googleCalendarColegaVisivel.findMany({
      where: {
        userId: ctx.userId,
        visivel: true,
        colega: {
          status: "ATIVO",
          OR: [
            { nome: { contains: termo } },
            { email: { contains: termoEmail } },
          ],
        },
      },
      select: {
        colega: {
          select: { id: true, nome: true, email: true },
        },
      },
      orderBy: { colega: { nome: "asc" } },
      take: 11,
    });
    usuarios = compartilhados.map(({ colega }) => colega);
  }

  const exatos = usuarios.filter(
    (usuario) =>
      normalizarTexto(usuario.nome) === busca ||
      usuario.email.trim().toLocaleLowerCase() === termoEmail,
  );
  if (exatos.length === 1) return { ok: true, colega: exatos[0] };

  const parciais = usuarios.filter(
    (usuario) =>
      normalizarTexto(usuario.nome).includes(busca) ||
      usuario.email.trim().toLocaleLowerCase().includes(termoEmail),
  );
  if (parciais.length === 1) return { ok: true, colega: parciais[0] };

  const candidatos = (exatos.length > 1 ? exatos : parciais).slice(0, 10);
  return {
    ok: false,
    resposta: json({
      ok: false,
      erro: candidatos.length > 0 ? "Colaborador ambíguo." : "Colaborador não encontrado.",
      candidatos: candidatos.map(({ nome, email }) => ({ nome, email })),
    }),
  };
}

async function resolverEventoProprio(
  userId: number,
  googleEventId: string,
  calendarioNome?: string,
) {
  const caches = await db.googleCalendarEventoCache.findMany({
    where: {
      googleEventId,
      calendario: { conexao: { userId } },
    },
    include: {
      calendario: {
        select: {
          id: true,
          googleCalendarId: true,
          nome: true,
          gravavel: true,
          timezone: true,
        },
      },
    },
    take: 10,
  });
  const filtrados = calendarioNome
    ? caches.filter((item) => normalizarTexto(item.calendario.nome) === normalizarTexto(calendarioNome))
    : caches;
  if (filtrados.length === 1) return { ok: true as const, evento: filtrados[0] };
  return {
    ok: false as const,
    resposta: json({
      ok: false,
      erro:
        filtrados.length > 1
          ? "O ID aparece em mais de um calendário. Informe calendario_nome."
          : "Evento não encontrado na agenda sincronizada. Liste a agenda antes de editar ou cancelar.",
      candidatos: filtrados.map((item) => item.calendario.nome),
    }),
  };
}

function mapearEventoProprio(
  evento: {
    googleEventId: string;
    titulo: string | null;
    inicioEm: Date | null;
    fimEm: Date | null;
    diaInteiro: boolean;
    etag: string;
    linkMeet: string | null;
  },
  calendarioNome: string,
) {
  return {
    id: evento.googleEventId,
    etag: evento.etag,
    titulo: evento.titulo,
    inicio: formatarDataCalendarioParaBibble(evento.inicioEm, evento.diaInteiro),
    fim: formatarDataCalendarioParaBibble(evento.fimEm, evento.diaInteiro),
    dia_inteiro: evento.diaInteiro,
    timezone: TIMEZONE_PADRAO,
    link_meet: evento.linkMeet,
    calendario: calendarioNome,
  };
}

function mapearEventoColega(evento: {
  googleEventId: string;
  etag: string;
  titulo: string | null;
  inicioEm: string | null;
  fimEm: string | null;
  diaInteiro: boolean;
  linkMeet: string | null;
}) {
  return {
    id: evento.googleEventId,
    etag: evento.etag,
    titulo: evento.titulo,
    inicio: formatarDataCalendarioParaBibble(evento.inicioEm, evento.diaInteiro),
    fim: formatarDataCalendarioParaBibble(evento.fimEm, evento.diaInteiro),
    dia_inteiro: evento.diaInteiro,
    timezone: TIMEZONE_PADRAO,
    link_meet: evento.linkMeet,
  };
}

function mapearEventoGoogle(evento: {
  googleEventId: string;
  etag: string;
  titulo: string | null;
  inicio: { dataHora?: string; data?: string };
  fim: { dataHora?: string; data?: string };
  diaInteiro: boolean;
  linkMeet: string | null;
}) {
  return {
    id: evento.googleEventId,
    etag: evento.etag,
    titulo: evento.titulo,
    inicio: formatarDataCalendarioParaBibble(
      evento.inicio.dataHora ?? evento.inicio.data ?? null,
      evento.diaInteiro,
    ),
    fim: formatarDataCalendarioParaBibble(
      evento.fim.dataHora ?? evento.fim.data ?? null,
      evento.diaInteiro,
    ),
    dia_inteiro: evento.diaInteiro,
    timezone: TIMEZONE_PADRAO,
    link_meet: evento.linkMeet,
  };
}

function exigirAdmin(ctx: CalendarToolContext): string | null {
  return ctx.role === "Admin" || ctx.role === "CEO"
    ? null
    : "Somente Admin/CEO pode criar, editar ou cancelar eventos na agenda de outro colaborador.";
}

function validarPermissao(ctx: CalendarToolContext): string | null {
  return ctx.role === "Admin" ||
    ctx.role === "CEO" ||
    ctx.permissoes.includes("calendarioAlpha")
    ? null
    : 'Você não tem permissão para acessar o módulo "Calendário Alpha".';
}

export function isCalendarTool(nome: string): boolean {
  return CALENDAR_TOOL_NAMES.has(nome);
}

export async function executarCalendarTool(
  nome: string,
  input: unknown,
  ctx: CalendarToolContext,
): Promise<string> {
  const negado = validarPermissao(ctx);
  if (negado) return negado;

  switch (nome) {
    case "listar_calendarios_calendario": {
      const validacao = z.object({}).strict().safeParse(input);
      if (!validacao.success) return erroValidacao(validacao.error);
      const calendarios = await buscarCalendariosDoUsuario(ctx.userId);
      return json({
        ok: true,
        total: calendarios.length,
        calendarios: calendarios.map(({ nome: nomeCalendario, timezone, papelAcesso, visivel, gravavel }) => ({
          nome: nomeCalendario,
          timezone,
          papel_acesso: papelAcesso,
          visivel,
          gravavel,
        })),
      });
    }

    case "listar_eventos_calendario": {
      const validacao = periodoSchema.safeParse(input);
      if (!validacao.success) return erroValidacao(validacao.error);
      const { inicio, fim } = resolverPeriodo(validacao.data);
      if (!intervaloEhValido(inicio, fim)) return "O intervalo informado é inválido.";

      const todos = await buscarCalendariosDoUsuario(ctx.userId);
      let calendarios = todos.filter((item) => item.visivel);
      if (validacao.data.calendario_nome) {
        const resolucao = await resolverCalendario(
          ctx.userId,
          validacao.data.calendario_nome,
          false,
        );
        if (!resolucao.ok) return resolucao.resposta;
        calendarios = [resolucao.calendario];
      }
      if (calendarios.length === 0) {
        return "Nenhum calendário visível está configurado no Calendário Alpha.";
      }

      const { listarEventosDoCalendario } = await import("@/actions/google-calendar-eventos");
      const eventos: ReturnType<typeof mapearEventoProprio>[] = [];
      const falhas: { calendario: string; erro: string }[] = [];
      for (const calendario of calendarios) {
        const resultado = await listarEventosDoCalendario(
          calendario.id,
          inicio.toISOString(),
          fim.toISOString(),
        );
        if (!resultado.success) {
          falhas.push({ calendario: calendario.nome, erro: resultado.error });
          continue;
        }
        eventos.push(
          ...resultado.data
            .filter((evento) => evento.status !== "cancelled")
            .map((evento) => mapearEventoProprio(evento, calendario.nome)),
        );
      }
      eventos.sort(
        (a, b) =>
          new Date(a.inicio ?? 0).getTime() - new Date(b.inicio ?? 0).getTime(),
      );
      const totalEventos = eventos.length;
      return json({
        ok: true,
        periodo: {
          inicio: formatarDataCalendarioParaBibble(inicio, false),
          fim_exclusivo: formatarDataCalendarioParaBibble(fim, false),
          timezone: TIMEZONE_PADRAO,
        },
        total: totalEventos,
        truncado: totalEventos > MAX_EVENTOS_RESPOSTA,
        eventos: eventos.slice(0, MAX_EVENTOS_RESPOSTA),
        falhas,
      });
    }

    case "criar_evento_calendario": {
      const validacao = criarEventoSchema.safeParse(input);
      if (!validacao.success) return erroValidacao(validacao.error);
      const dados = validacao.data;
      const calendario = await resolverCalendario(
        ctx.userId,
        dados.calendario_nome,
        true,
      );
      if (!calendario.ok) return calendario.resposta;

      const datas = construirDatasEvento(dados);
      if (!intervaloEhValido(datas.inicio, datas.fim)) {
        return "O fim do evento deve ser posterior ao início.";
      }
      const { criarEventoNoCalendario } = await import("@/actions/google-calendar-eventos");
      const resultado = await criarEventoNoCalendario({
        calendarId: calendario.calendario.googleCalendarId,
        titulo: dados.titulo,
        descricaoGoogle: dados.descricao,
        localizacao: dados.local,
        timezone: calendario.calendario.timezone || TIMEZONE_PADRAO,
        diaInteiro: datas.diaInteiro,
        inicio: datas.inicio,
        fim: datas.fim,
        participantes: participantesDeTexto(dados.participantes),
        criarMeet: dados.criar_meet ?? false,
      });
      if (!resultado.success) return resultado.error;

      const cache = await db.googleCalendarEventoCache.findUnique({
        where: {
          calendarioId_googleEventId: {
            calendarioId: calendario.calendario.id,
            googleEventId: resultado.data.googleEventId,
          },
        },
      });
      return json({
        ok: true,
        evento: cache
          ? mapearEventoProprio(cache, calendario.calendario.nome)
          : {
              id: resultado.data.googleEventId,
              etag: null,
              calendario: calendario.calendario.nome,
            },
      });
    }

    case "editar_evento_calendario": {
      const validacao = editarEventoSchema.safeParse(input);
      if (!validacao.success) return erroValidacao(validacao.error);
      const dados = validacao.data;
      const resolucao = await resolverEventoProprio(
        ctx.userId,
        dados.google_event_id,
        dados.calendario_nome,
      );
      if (!resolucao.ok) return resolucao.resposta;
      if (!resolucao.evento.calendario.gravavel) {
        return "Este calendário está disponível somente para leitura.";
      }

      const payload = {
        calendarId: resolucao.evento.calendario.googleCalendarId,
        googleEventId: dados.google_event_id,
        etagConhecido: dados.etag,
        titulo: dados.titulo,
        descricaoGoogle: dados.descricao,
        localizacao: dados.local,
        timezone:
          dados.data_inicio && dados.data_fim && dados.dia_inteiro !== undefined
            ? resolucao.evento.calendario.timezone || TIMEZONE_PADRAO
            : undefined,
        diaInteiro: dados.dia_inteiro,
        inicio: dados.data_inicio ? paraDate(dados.data_inicio) : undefined,
        fim: dados.data_fim ? paraDate(dados.data_fim) : undefined,
        participantes:
          dados.participantes === undefined
            ? undefined
            : participantesDeTexto(dados.participantes),
        criarMeet: dados.criar_meet,
      };
      const { atualizarEventoParcialNoCalendario } = await import(
        "@/actions/google-calendar-eventos"
      );
      const resultado = await atualizarEventoParcialNoCalendario(payload);
      if (!resultado.success) return resultado.error;
      if (resultado.data.conflito) {
        return json({
          ok: false,
          conflito: true,
          erro: "O evento mudou desde a última leitura. Liste a agenda novamente antes de editar.",
        });
      }
      if (!resultado.data.evento) {
        return "O evento foi atualizado, mas os dados atualizados não puderam ser lidos.";
      }
      return json({
        ok: true,
        evento: {
          ...mapearEventoGoogle(resultado.data.evento),
          etag: resultado.data.etag ?? resultado.data.evento.etag,
          calendario: resolucao.evento.calendario.nome,
        },
      });
    }

    case "cancelar_evento_calendario": {
      if (!ctx.confirmouCancelamentoCalendario) {
        return json({
          ok: false,
          erro:
            "Cancelamento pendente. Peça confirmação explícita ao usuário e aguarde a próxima mensagem antes de executar.",
        });
      }
      const validacao = cancelarEventoSchema.safeParse(input);
      if (!validacao.success) return erroValidacao(validacao.error);
      const resolucao = await resolverEventoProprio(
        ctx.userId,
        validacao.data.google_event_id,
        validacao.data.calendario_nome,
      );
      if (!resolucao.ok) return resolucao.resposta;
      if (!resolucao.evento.calendario.gravavel) {
        return "Este calendário está disponível somente para leitura.";
      }
      if (resolucao.evento.etag !== validacao.data.etag) {
        return json({
          ok: false,
          conflito: true,
          erro: "O evento mudou desde a última leitura. Liste a agenda novamente antes de cancelar.",
        });
      }
      const { cancelarEventoNoCalendario } = await import("@/actions/google-calendar-eventos");
      const resultado = await cancelarEventoNoCalendario({
        calendarId: resolucao.evento.calendario.googleCalendarId,
        googleEventId: validacao.data.google_event_id,
        etagConhecido: validacao.data.etag,
      });
      if (!resultado.success) return resultado.error;
      return json({
        ok: true,
        cancelado: true,
        id: validacao.data.google_event_id,
        etag: resolucao.evento.etag,
        calendario: resolucao.evento.calendario.nome,
      });
    }

    case "consultar_disponibilidade_calendario": {
      const validacao = disponibilidadeSchema.safeParse(input);
      if (!validacao.success) return erroValidacao(validacao.error);
      const inicio = new Date(validacao.data.data_inicio);
      const fim = new Date(validacao.data.data_fim);
      if (!intervaloEhValido(inicio, fim)) return "O intervalo informado é inválido.";
      if (fim.getTime() - inicio.getTime() > JANELA_MAXIMA_DIAS * MS_DIA) {
        return `O intervalo máximo para consulta é de ${JANELA_MAXIMA_DIAS} dias.`;
      }

      let calendarios = (await buscarCalendariosDoUsuario(ctx.userId)).filter(
        (item) => item.visivel,
      );
      if (validacao.data.calendario_nome) {
        const resolucao = await resolverCalendario(
          ctx.userId,
          validacao.data.calendario_nome,
          false,
        );
        if (!resolucao.ok) return resolucao.resposta;
        calendarios = [resolucao.calendario];
      }
      if (calendarios.length === 0) {
        return "Nenhum calendário visível está configurado no Calendário Alpha.";
      }
      const { consultarDisponibilidade } = await import("@/actions/google-calendar-eventos");
      const resultado = await consultarDisponibilidade({
        googleCalendarIds: calendarios.map((item) => item.googleCalendarId),
        inicio,
        fim,
      });
      if (!resultado.success) return resultado.error;
      return json({
        ok: true,
        intervalo: {
          inicio: formatarDataCalendarioParaBibble(inicio, false),
          fim: formatarDataCalendarioParaBibble(fim, false),
          timezone: TIMEZONE_PADRAO,
        },
        calendarios: calendarios.map((item) => item.nome),
        disponibilidade: resultado.data,
      });
    }

    case "consultar_agenda_colega": {
      const validacao = colegaPeriodoSchema.safeParse(input);
      if (!validacao.success) return erroValidacao(validacao.error);
      const resolucao = await resolverColega(ctx, validacao.data.nome_ou_email);
      if (!resolucao.ok) return resolucao.resposta;
      const { inicio, fim } = resolverPeriodo(validacao.data);
      if (!intervaloEhValido(inicio, fim)) return "O intervalo informado é inválido.";

      const { listarEventosDeColega } = await import("@/actions/google-calendar-colegas");
      const resultado = await listarEventosDeColega(
        resolucao.colega.id,
        inicio.toISOString(),
        fim.toISOString(),
      );
      if (!resultado.success) return resultado.error;
      const eventos = resultado.data.map(mapearEventoColega);
      return json({
        ok: true,
        colega: { nome: resolucao.colega.nome, email: resolucao.colega.email },
        periodo: {
          inicio: formatarDataCalendarioParaBibble(inicio, false),
          fim_exclusivo: formatarDataCalendarioParaBibble(fim, false),
          timezone: TIMEZONE_PADRAO,
        },
        total: eventos.length,
        truncado: eventos.length > MAX_EVENTOS_RESPOSTA,
        eventos: eventos.slice(0, MAX_EVENTOS_RESPOSTA),
      });
    }

    case "criar_evento_calendario_colega": {
      const somenteAdmin = exigirAdmin(ctx);
      if (somenteAdmin) return somenteAdmin;
      const validacao = colegaCriarSchema.safeParse(input);
      if (!validacao.success) return erroValidacao(validacao.error);
      const dados = validacao.data;
      const resolucao = await resolverColega(ctx, dados.colega_nome_ou_email);
      if (!resolucao.ok) return resolucao.resposta;
      const datas = construirDatasEvento(dados);
      if (!intervaloEhValido(datas.inicio, datas.fim)) {
        return "O fim do evento deve ser posterior ao início.";
      }

      const { criarEventoParaColega } = await import("@/actions/google-calendar-admin");
      const resultado = await criarEventoParaColega(resolucao.colega.id, {
        calendarId: resolucao.colega.email,
        titulo: dados.titulo,
        descricaoGoogle: dados.descricao,
        localizacao: dados.local,
        timezone: TIMEZONE_PADRAO,
        diaInteiro: datas.diaInteiro,
        inicio: datas.inicio,
        fim: datas.fim,
        participantes: participantesDeTexto(dados.participantes),
        criarMeet: dados.criar_meet ?? false,
      });
      if (!resultado.success) return resultado.error;

      const { listarEventosDeColega } = await import("@/actions/google-calendar-colegas");
      const leitura = await listarEventosDeColega(
        resolucao.colega.id,
        new Date(datas.inicio.getTime() - MS_DIA).toISOString(),
        new Date(datas.fim.getTime() + MS_DIA).toISOString(),
      );
      const criado = leitura.success
        ? leitura.data.find((evento) => evento.googleEventId === resultado.data.googleEventId)
        : undefined;
      return json({
        ok: true,
        colega: { nome: resolucao.colega.nome, email: resolucao.colega.email },
        evento: criado
          ? mapearEventoColega(criado)
          : { id: resultado.data.googleEventId, etag: null },
      });
    }

    case "editar_evento_calendario_colega": {
      const somenteAdmin = exigirAdmin(ctx);
      if (somenteAdmin) return somenteAdmin;
      const validacao = colegaEditarSchema.safeParse(input);
      if (!validacao.success) return erroValidacao(validacao.error);
      const dados = validacao.data;
      const resolucao = await resolverColega(ctx, dados.colega_nome_ou_email);
      if (!resolucao.ok) return resolucao.resposta;

      const { atualizarEventoParcialParaColega } = await import(
        "@/actions/google-calendar-admin"
      );
      const resultado = await atualizarEventoParcialParaColega(resolucao.colega.id, {
        calendarId: resolucao.colega.email,
        googleEventId: dados.google_event_id,
        etagConhecido: dados.etag,
        titulo: dados.titulo,
        descricaoGoogle: dados.descricao,
        localizacao: dados.local,
        timezone:
          dados.data_inicio && dados.data_fim && dados.dia_inteiro !== undefined
            ? TIMEZONE_PADRAO
            : undefined,
        diaInteiro: dados.dia_inteiro,
        inicio: dados.data_inicio ? paraDate(dados.data_inicio) : undefined,
        fim: dados.data_fim ? paraDate(dados.data_fim) : undefined,
        participantes:
          dados.participantes === undefined
            ? undefined
            : participantesDeTexto(dados.participantes),
        criarMeet: dados.criar_meet,
      });
      if (!resultado.success) return resultado.error;
      if (resultado.data.conflito) {
        return json({
          ok: false,
          conflito: true,
          erro: "O evento mudou desde a última leitura. Consulte a agenda do colega novamente.",
        });
      }
      if (!resultado.data.evento) {
        return "O evento foi atualizado, mas os dados atualizados não puderam ser lidos.";
      }
      return json({
        ok: true,
        colega: { nome: resolucao.colega.nome, email: resolucao.colega.email },
        evento: {
          ...mapearEventoGoogle(resultado.data.evento),
          etag: resultado.data.etag ?? resultado.data.evento.etag,
        },
      });
    }

    case "cancelar_evento_calendario_colega": {
      const somenteAdmin = exigirAdmin(ctx);
      if (somenteAdmin) return somenteAdmin;
      if (!ctx.confirmouCancelamentoCalendario) {
        return json({
          ok: false,
          erro:
            "Cancelamento pendente. Peça confirmação explícita ao usuário e aguarde a próxima mensagem antes de executar.",
        });
      }
      const validacao = colegaCancelarSchema.safeParse(input);
      if (!validacao.success) return erroValidacao(validacao.error);
      const dados = validacao.data;
      const resolucao = await resolverColega(ctx, dados.colega_nome_ou_email);
      if (!resolucao.ok) return resolucao.resposta;
      const { cancelarEventoParaColega } = await import("@/actions/google-calendar-admin");
      const resultado = await cancelarEventoParaColega(resolucao.colega.id, {
        calendarId: resolucao.colega.email,
        googleEventId: dados.google_event_id,
        etagConhecido: dados.etag,
      });
      if (!resultado.success) return resultado.error;
      return json({
        ok: true,
        cancelado: true,
        id: dados.google_event_id,
        colega: { nome: resolucao.colega.nome, email: resolucao.colega.email },
      });
    }

    default:
      return `Tool de calendário desconhecida: ${nome}`;
  }
}
