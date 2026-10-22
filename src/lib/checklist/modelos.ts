import type { TipoEmbasamento } from "@prisma/client";
import { SECOES, TIPO_LABELS } from "@/lib/checklist/items";

export { tiposChecklist as TIPOS_EMBASAMENTO } from "./schemas";

export const SECOES_MODELO = Object.values(SECOES);

export const SECOES_MODELO_LABELS = {
  [SECOES.CAPITAL_SOCIAL]: "Origem do Capital Social",
  [SECOES.CAP_FINANCEIRA]: "Capacidade Financeira",
  [SECOES.CAP_OPERACIONAL]: "Capacidade Operacional",
  [SECOES.CONSTITUICAO]: "Constituição Regular",
  [SECOES.VALIDACAO]: "Validação",
} as const;

export const EMBASAMENTO_LABELS: Record<TipoEmbasamento, string> = TIPO_LABELS;
