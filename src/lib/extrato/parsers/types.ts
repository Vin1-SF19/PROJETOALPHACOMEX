import type { TransacaoNormalizada } from "@/types/extrato";

/** Parser determinístico de texto de extrato bancário (sem IA) para um banco específico. */
export interface ParserExtrato {
  parse(texto: string): TransacaoNormalizada[];
}
