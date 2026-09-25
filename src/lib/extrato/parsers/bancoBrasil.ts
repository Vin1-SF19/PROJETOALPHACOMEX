import type { TransacaoNormalizada } from "@/types/extrato";
import type { ParserExtrato } from "./types";
import { limparDescricao, paraNumeroBR } from "./utils";

function parse(texto: string): TransacaoNormalizada[] {
  const resultado: TransacaoNormalizada[] = [];
  for (const linha of texto.split("\n")) {
    const m = linha.match(/^(\d{2}\/\d{2}\/20\d{2})\s+\d{4}\s+\d{5}\s+\d{3}\s+(.+?)\s+([\d.]+,\d{2})\s+([CD])(?:\s+[\d.]+,\d{2}\s+[CD])?\s*$/);
    if (!m || /saldo/i.test(m[2])) continue;
    const historico = m[2].replace(/\s+[\d.]+(?:\.\d{3})+(?:\.\d{3})*$/, "");
    const valor = paraNumeroBR(m[3]) * (m[4] === "D" ? -1 : 1);
    if (valor) resultado.push({ data: m[1], descricao: limparDescricao(historico).toUpperCase(), valor });
  }
  return resultado;
}

export const parserBancoBrasil: ParserExtrato = { parse };
