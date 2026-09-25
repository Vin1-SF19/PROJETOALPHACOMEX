import type { TransacaoNormalizada } from "@/types/extrato";
import type { ParserExtrato } from "./types";
import { limparDescricao, paraNumeroBR } from "./utils";

function parse(texto: string): TransacaoNormalizada[] {
  const resultado: TransacaoNormalizada[] = [];
  for (const linha of texto.split("\n")) {
    const m = linha.match(/^(\d{2}\/\d{2}\/20\d{2})\s+(.+?)\s+(-?R\$\s*[\d.]+,\d{2})\s*$/);
    if (!m || /saldo do dia/i.test(m[2])) continue;
    const valor = paraNumeroBR(m[3].replace(/R\$\s*/, ""));
    if (valor) resultado.push({ data: m[1], descricao: limparDescricao(m[2]).toUpperCase(), valor });
  }
  return resultado;
}

export const parserPagBank: ParserExtrato = { parse };
