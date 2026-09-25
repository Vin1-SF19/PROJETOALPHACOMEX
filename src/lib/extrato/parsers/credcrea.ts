import type { TransacaoNormalizada } from "@/types/extrato";
import type { ParserExtrato } from "./types";
import { limparDescricao, paraNumeroBR } from "./utils";

function parse(texto: string): TransacaoNormalizada[] {
  const resultado: TransacaoNormalizada[] = [];
  for (const linha of texto.split("\n")) {
    const m = linha.match(/^(.+?)\s+(\d{2}\/\d{2}\/20\d{2})\s+(-?[\d.]+,\d{2})\s+-?[\d.]+,\d{2}(?:\s|$)/);
    if (!m) continue;
    const valor = paraNumeroBR(m[3]);
    if (valor) resultado.push({ data: m[2], descricao: limparDescricao(m[1]).toUpperCase(), valor });
  }
  return resultado;
}

export const parserCredcrea: ParserExtrato = { parse };
