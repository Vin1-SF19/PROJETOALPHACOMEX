import { z } from "zod";

const DURACAO_MAXIMA_EVENTO_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias
const MAX_PARTICIPANTES = 50;

function isTimezoneValida(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(isTimezoneValida, { message: "Timezone IANA inválido." });

export const emailParticipanteSchema = z.string().trim().toLowerCase().email().max(320);

const camposEventoBase = {
  calendarId: z.string().trim().min(1).max(300),
  titulo: z.string().trim().min(1, "Título é obrigatório").max(300),
  descricaoGoogle: z.string().trim().max(8000).optional(),
  observacaoInterna: z.string().trim().max(2000).optional(),
  localizacao: z.string().trim().max(300).optional(),
  timezone: timezoneSchema,
  diaInteiro: z.boolean().default(false),
  inicio: z.coerce.date(),
  fim: z.coerce.date(),
  participantes: z.array(emailParticipanteSchema).max(MAX_PARTICIPANTES).default([]),
  criarMeet: z.boolean().default(false),
};

function refinarIntervalo<T extends { inicio: Date; fim: Date }>(schema: z.ZodType<T>) {
  return schema
    .refine((dados) => dados.fim.getTime() > dados.inicio.getTime(), {
      message: "O fim deve ser posterior ao início.",
      path: ["fim"],
    })
    .refine((dados) => dados.fim.getTime() - dados.inicio.getTime() <= DURACAO_MAXIMA_EVENTO_MS, {
      message: "Duração máxima do evento é 30 dias.",
      path: ["fim"],
    });
}

export const criarEventoSchema = refinarIntervalo(z.object(camposEventoBase));
export type CriarEventoInput = z.infer<typeof criarEventoSchema>;

export const atualizarEventoSchema = refinarIntervalo(
  z.object({
    ...camposEventoBase,
    googleEventId: z.string().trim().min(1),
    /** ETag lido pelo cliente antes de abrir o formulário — usado para detectar conflito com mudança externa. */
    etagConhecido: z.string().trim().min(1).optional(),
  }),
);
export type AtualizarEventoInput = z.infer<typeof atualizarEventoSchema>;

const atualizarEventoParcialBaseSchema = z
  .object({
    calendarId: z.string().trim().min(1).max(300),
    googleEventId: z.string().trim().min(1).max(1024),
    /** ETag conhecido pelo chamador. Quando presente, impede sobrescrita de uma versão mais nova. */
    etagConhecido: z.string().trim().min(1).max(500).optional(),
    titulo: z.string().trim().min(1, "Título não pode ficar vazio").max(300).optional(),
    descricaoGoogle: z.string().trim().max(8000).optional(),
    localizacao: z.string().trim().max(300).optional(),
    timezone: timezoneSchema.optional(),
    diaInteiro: z.boolean().optional(),
    inicio: z.coerce.date().optional(),
    fim: z.coerce.date().optional(),
    participantes: z.array(emailParticipanteSchema).max(MAX_PARTICIPANTES).optional(),
    /**
     * A atualização parcial nunca remove uma conferência existente. O campo só pode ser enviado
     * como `true`; para preservar o Meet atual, basta omiti-lo.
     */
    criarMeet: z
      .boolean()
      .optional()
      .refine((valor): boolean => valor !== false, {
        message: "Para preservar a conferência existente, omita criarMeet; envie apenas true para criar um Meet.",
      }),
  })
  .strict();

export const atualizarEventoParcialSchema = atualizarEventoParcialBaseSchema.superRefine((dados, contexto) => {
  const camposTemporais = [dados.inicio, dados.fim, dados.diaInteiro];
  const quantidadeCamposTemporais = camposTemporais.filter((campo) => campo !== undefined).length;
  const possuiMudancaTemporal = quantidadeCamposTemporais > 0;

  if (possuiMudancaTemporal && quantidadeCamposTemporais !== camposTemporais.length) {
    for (const campo of ["inicio", "fim", "diaInteiro"] as const) {
      if (dados[campo] === undefined) {
        contexto.addIssue({
          code: "custom",
          message: "Início, fim e dia inteiro devem ser informados juntos.",
          path: [campo],
        });
      }
    }
  }

  if (dados.timezone !== undefined && !possuiMudancaTemporal) {
    contexto.addIssue({
      code: "custom",
      message: "Timezone só pode ser alterado junto com início, fim e dia inteiro.",
      path: ["timezone"],
    });
  }

  if (dados.inicio && dados.fim) {
    if (dados.fim.getTime() <= dados.inicio.getTime()) {
      contexto.addIssue({
        code: "custom",
        message: "O fim deve ser posterior ao início.",
        path: ["fim"],
      });
    } else if (dados.fim.getTime() - dados.inicio.getTime() > DURACAO_MAXIMA_EVENTO_MS) {
      contexto.addIssue({
        code: "custom",
        message: "Duração máxima do evento é 30 dias.",
        path: ["fim"],
      });
    }
  }

  const possuiCampoMutavel =
    dados.titulo !== undefined ||
    dados.descricaoGoogle !== undefined ||
    dados.localizacao !== undefined ||
    dados.participantes !== undefined ||
    dados.criarMeet === true ||
    possuiMudancaTemporal;

  if (!possuiCampoMutavel) {
    contexto.addIssue({
      code: "custom",
      message: "Informe ao menos um campo do evento para atualizar.",
      path: [],
    });
  }
});
export type AtualizarEventoParcialInput = z.infer<typeof atualizarEventoParcialSchema>;

export const cancelarEventoSchema = z.object({
  calendarId: z.string().trim().min(1).max(300),
  googleEventId: z.string().trim().min(1),
  etagConhecido: z.string().trim().min(1).max(1024),
}).strict();
export type CancelarEventoInput = z.infer<typeof cancelarEventoSchema>;

export const corHexSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida. Use o formato #RRGGBB.");

export const selecionarCalendarioSchema = z.object({
  conexaoId: z.string().trim().min(1),
  googleCalendarId: z.string().trim().min(1).max(300),
  visivel: z.boolean().default(true),
  gravavel: z.boolean().default(false),
});
export type SelecionarCalendarioInput = z.infer<typeof selecionarCalendarioSchema>;

export const consultarFreeBusySchema = z
  .object({
    googleCalendarIds: z.array(z.string().trim().min(1)).min(1).max(20),
    inicio: z.coerce.date(),
    fim: z.coerce.date(),
  })
  .refine((dados) => dados.fim.getTime() > dados.inicio.getTime(), {
    message: "O fim deve ser posterior ao início.",
    path: ["fim"],
  });
export type ConsultarFreeBusyInput = z.infer<typeof consultarFreeBusySchema>;
