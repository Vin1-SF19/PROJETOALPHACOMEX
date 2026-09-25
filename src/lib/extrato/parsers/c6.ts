import type { TransacaoNormalizada } from "@/types/extrato";
import type { ParserExtrato } from "./types";
import { limparDescricao, paraNumeroBR } from "./utils";

function parse(texto: string): TransacaoNormalizada[] {
  const ano = texto.match(/Extrato Período[^\n]*de (20\d{2})/i)?.[1];
  if (!ano) return [];
  const resultado: TransacaoNormalizada[] = [];
  for (const linha of texto.split("\n")) {
    const m = linha.match(/^(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(.+?)\s+(-?R\$\s*[\d.]+,\d{2})\s*$/);
    if (!m) continue;
    const valor = paraNumeroBR(m[4].replace(/R\$\s*/, ""));
    if (valor) resultado.push({ data: `${m[1]}/${ano}`, descricao: limparDescricao(m[3]).toUpperCase(), valor });
  }
  return resultado;
}

export const parserC6: ParserExtrato = { parse };
