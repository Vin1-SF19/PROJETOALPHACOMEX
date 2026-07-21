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

export const cancelarEventoSchema = z.object({
  calendarId: z.string().trim().min(1).max(300),
  googleEventId: z.string().trim().min(1),
});
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
