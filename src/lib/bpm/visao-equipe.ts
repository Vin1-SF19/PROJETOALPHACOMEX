import { z } from "zod";

export const configuracaoVisaoEquipeSchema = z.object({
  version: z.literal(1),
  supervisores: z.array(z.object({ usuarioId: z.number().int().positive(), setorIds: z.array(z.number().int().positive()).max(100) })).max(200),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.supervisores.map((s) => s.usuarioId)).size !== value.supervisores.length) ctx.addIssue({ code: "custom", message: "Selecione cada supervisor apenas uma vez." });
});
export type ConfiguracaoVisaoEquipe = z.infer<typeof configuracaoVisaoEquipeSchema>;
export function lerConfiguracaoVisaoEquipe(value?: string | null): ConfiguracaoVisaoEquipe {
  try { const result = configuracaoVisaoEquipeSchema.safeParse(JSON.parse(value ?? "null")); if (result.success) return result.data; } catch { /* Configuração ausente ou inválida nunca concede acesso. */ }
  return { version: 1, supervisores: [] };
}
export type OpcaoSetorEquipe = { id: number; nome: string; usuarioIds: number[] };
export type VisaoQuadro = "MEUS" | "EQUIPE" | "SETOR" | "TODOS";
export type AcessoVisaoQuadro = { userId: number; admin: boolean; setores: OpcaoSetorEquipe[] };
export function usuariosDaVisao(acesso: AcessoVisaoQuadro, visao: VisaoQuadro, setorId?: number | null): number[] | null {
  if (visao === "MEUS") return [acesso.userId];
  if (visao === "TODOS") return acesso.admin ? null : [acesso.userId];
  if (visao === "SETOR") return acesso.setores.find((s) => s.id === setorId)?.usuarioIds ?? [];
  return [...new Set([acesso.userId, ...acesso.setores.flatMap((s) => s.usuarioIds)])];
}
