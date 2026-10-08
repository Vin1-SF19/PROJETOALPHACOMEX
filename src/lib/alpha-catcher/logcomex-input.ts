import { z } from 'zod';

const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
});
export function dataMaximaColeta(agora = new Date()) {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
  const data = new Date(`${hoje}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() - 7);
  return data.toISOString().slice(0, 10);
}
export function janelaMeses(data: string, meses: 3 | 6) {
  const fim = dataSchema.parse(data);
  const d = new Date(`${fim}T00:00:00Z`), dia = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - meses);
  const ultimo = new Date(d); ultimo.setUTCMonth(ultimo.getUTCMonth() + 1); ultimo.setUTCDate(0);
  d.setUTCDate(Math.min(dia, ultimo.getUTCDate()));
  return { dataInicio: d.toISOString().slice(0, 10), dataFinal: fim };
}
export const coletaSchema = z.object({
  data: dataSchema,
  dataInicio: dataSchema.optional(),
  dataFinal: dataSchema.optional(),
  embarquesMin: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(1),
  embarquesMax: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(2),
  limite: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
}).superRefine((v, ctx) => {
  const maxima = dataMaximaColeta();
  if ([v.data, v.dataInicio, v.dataFinal].some(data => data && data > maxima))
    ctx.addIssue({ code: 'custom', message: 'Selecione datas até sete dias antes de hoje.' });
  if (v.embarquesMin > v.embarquesMax) ctx.addIssue({ code: 'custom', message: 'Mínimo maior que máximo.' });
  if (!!v.dataInicio !== !!v.dataFinal || (v.dataInicio && v.dataFinal && v.dataInicio > v.dataFinal))
    ctx.addIssue({ code: 'custom', message: 'Intervalo de datas inválido.' });
});
export type ColetaInput = z.input<typeof coletaSchema>;
