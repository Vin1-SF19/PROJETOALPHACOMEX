import { z } from 'zod';
const quantidade = z.number().int().nonnegative();
export const progressoColetaSchema = z.object({
  fase: z.enum(['ranking', 'perfis']), totalLista: quantidade.nullable(), total: quantidade.nullable(),
  coletadas: quantidade, cnpjs: quantidade, paginas: quantidade, paginasTotal: quantidade.nullable(),
});
export type ProgressoColeta = z.infer<typeof progressoColetaSchema>;
