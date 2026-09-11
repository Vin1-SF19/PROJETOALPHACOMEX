import { parseDataLocalInput, TZ } from "@/lib/format-date";
import { z } from "zod";

const DATA_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function dataLocalExiste(valor: string): boolean {
  const match = DATA_LOCAL_RE.exec(valor);
  if (!match) return false;

  const [, ano, mes, dia] = match;
  const data = parseDataLocalInput(valor);
  if (Number.isNaN(data.getTime())) return false;

  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(data)
      .map((parte) => [parte.type, parte.value]),
  );

  return partes.year === ano && partes.month === mes && partes.day === dia;
}

const idPositivoSchema = z.coerce.number().int().positive();

const idOpcionalSchema = z.preprocess(
  (valor) => (valor === "" || valor === undefined || valor === null ? null : valor),
  idPositivoSchema.nullable(),
);

const dataDesejadaOpcionalSchema = z.preprocess(
  (valor) => (valor === "" || valor === undefined || valor === null ? null : valor),
  z
    .string()
    .regex(DATA_LOCAL_RE, "Data desejada inválida")
    .refine(dataLocalExiste, "Data desejada inválida")
    .transform(parseDataLocalInput)
    .nullable(),
);

export const criarChamadoSchema = z.object({
  titulo: z.string().trim().min(1, "Informe o título").max(120, "O título deve ter no máximo 120 caracteres"),
  categoria: z.enum(["Hardware", "Software", "Rede", "Acesso", "Financeiro", "Outro"]),
  prioridade: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]),
  descricao: z.string().trim().min(1, "Informe a descrição").max(800, "A descrição deve ter no máximo 800 caracteres"),
  tecnicoSolicitadoId: idOpcionalSchema,
  dataDesejadaConclusao: dataDesejadaOpcionalSchema,
});

export type CriarChamadoInput = z.input<typeof criarChamadoSchema>;
export type CriarChamadoData = z.output<typeof criarChamadoSchema>;

export const notaFeedbackSchema = z
  .number()
  .int("A nota deve ser um número inteiro")
  .min(0, "A nota mínima é 0")
  .max(5, "A nota máxima é 5");

const feedbackComumSchema = z.object({
  chamadoId: idPositivoSchema,
  notaRapidezResposta: notaFeedbackSchema,
  notaPrazoConclusao: notaFeedbackSchema,
});

export const responderFeedbackChamadoSchema = z.discriminatedUnion(
  "solucionadaComoEsperado",
  [
    feedbackComumSchema.extend({
      solucionadaComoEsperado: z.literal(false),
      comentario: z
        .string()
        .trim()
        .min(10, "O relato deve ter no mínimo 10 caracteres")
        .max(1000, "O relato deve ter no máximo 1000 caracteres"),
      notaQualidadeSolucao: z.never().optional(),
    }),
    feedbackComumSchema.extend({
      solucionadaComoEsperado: z.literal(true),
      comentario: z.never().optional(),
      notaQualidadeSolucao: notaFeedbackSchema,
    }),
  ],
);

export type ResponderFeedbackChamadoInput = z.input<typeof responderFeedbackChamadoSchema>;
export type ResponderFeedbackChamadoData = z.output<typeof responderFeedbackChamadoSchema>;

export const recusarFeedbackChamadoSchema = z.object({
  chamadoId: idPositivoSchema,
});

export const concluirChamadoSchema = z.object({
  chamadoId: idPositivoSchema,
  solucao: z.string().trim().optional(),
});

export const atualizarChamadoStatusSchema = z.object({
  chamadoId: idPositivoSchema,
  novoStatus: z.enum(["EM_ATENDIMENTO", "CONCLUIDO"]),
  solucao: z.string().trim().optional(),
});

export const finalizarComProtocoloSchema = z.object({
  chamadoId: idPositivoSchema,
  solucao: z.string().trim().min(1, "Informe a solução aplicada"),
  causa: z.string().trim(),
  mensagemFinal: z.string().trim(),
  templateId: z.number().int().positive().optional(),
});

export function primeiraMensagemZod(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Dados inválidos";
}
