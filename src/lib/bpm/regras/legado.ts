import type { Prisma } from "@prisma/client";

/**
 * Mantém configurações da função financeira descontinuada fora do motor BPM.
 * Os registros históricos são preservados no banco apenas para auditoria.
 */
export const MARCADOR_REGRA_FINANCEIRA_DESCONTINUADA =
  "[REGRA_FINANCEIRA_TRIBUTARIA:v1]";

export function ehDescricaoRegraFinanceiraDescontinuada(
  descricao: string | null | undefined,
): boolean {
  return descricao?.startsWith(MARCADOR_REGRA_FINANCEIRA_DESCONTINUADA) ?? false;
}

/** Preserva regras BPM comuns cuja descrição é nula. */
export const FILTRO_SEM_REGRAS_FINANCEIRAS_DESCONTINUADAS = {
  OR: [
    { descricao: null },
    {
      NOT: {
        descricao: {
          startsWith: MARCADOR_REGRA_FINANCEIRA_DESCONTINUADA,
        },
      },
    },
  ],
} satisfies Prisma.BpmRegraWhereInput;
