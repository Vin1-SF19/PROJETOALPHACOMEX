import { z } from "zod";

export const usuariosAutorizadosPipelineSchema = z.array(z.number().int().positive()).max(200)
  .transform((ids) => [...new Set(ids)]);

const configSchema = z.object({ version: z.literal(1), usuariosAutorizados: usuariosAutorizadosPipelineSchema.optional() });

/** JSON ausente, legado ou inválido nunca cria uma exceção ao setor. */
export function lerUsuariosAutorizadosPipeline(json?: string | null): number[] {
  try {
    const result = configSchema.safeParse(JSON.parse(json ?? "null"));
    return result.success ? result.data.usuariosAutorizados ?? [] : [];
  } catch { return []; }
}

/** Preserva propriedades legadas; configuração corrompida exige revisão. */
export function atualizarUsuariosAutorizadosPipeline(json: string | null | undefined, ids: number[]): string {
  const config = json == null ? { version: 1, supervisores: [] } : JSON.parse(json);
  if (!configSchema.safeParse(config).success) throw new Error("Configuração de acesso inválida");
  return JSON.stringify({ ...config, usuariosAutorizados: usuariosAutorizadosPipelineSchema.parse(ids) });
}
