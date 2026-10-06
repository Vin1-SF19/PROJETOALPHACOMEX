import { z } from 'zod';

export const coletaSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }),
  limite: z.number().int().min(1).max(10000),
});
export type ColetaInput = z.infer<typeof coletaSchema>;
