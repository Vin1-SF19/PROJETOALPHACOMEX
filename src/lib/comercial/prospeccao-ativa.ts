import { z } from "zod";

export const CANAL_PROSPECCAO_ATIVA = "Prospecção ativa";

export const ProspeccaoAtivaSchema = z
  .string()
  .transform((valor) => valor.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Descreva a prospecção ativa").max(200, "A prospecção deve ter no máximo 200 caracteres"));

export function normalizarCatalogoProspeccoes(
  valores: ReadonlyArray<string | null | undefined>,
): string[] {
  const unicos = new Map<string, string>();

  for (const valor of valores) {
    const resultado = ProspeccaoAtivaSchema.safeParse(valor);
    if (!resultado.success) continue;

    const chave = resultado.data.normalize("NFKC").toLocaleLowerCase("pt-BR");
    if (!unicos.has(chave)) unicos.set(chave, resultado.data);
  }

  return [...unicos.values()].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}
