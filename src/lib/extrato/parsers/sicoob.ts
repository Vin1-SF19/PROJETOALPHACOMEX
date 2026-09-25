import type { TransacaoNormalizada } from "@/types/extrato";
import type { ParserExtrato } from "./types";
import { limparDescricao, paraNumeroBR } from "./utils";

function parse(texto: string): TransacaoNormalizada[] {
  const periodo = texto.match(/PER[ÍI]ODO:\s*\d{2}\/\d{2}\/(20\d{2})/i);
  if (!periodo) return [];
  const resultado: TransacaoNormalizada[] = [];
  for (const linha of texto.split("\n")) {
    const m = linha.match(/^(\d{2}\/\d{2})\s+(.+?)\s+([\d.]+,\d{2})([CD])\s*$/);
    if (!m || /SALDO/i.test(m[2])) continue;
    const valor = paraNumeroBR(m[3]) * (m[4] === "D" ? -1 : 1);
    if (valor) resultado.push({ data: `${m[1]}/${periodo[1]}`, descricao: limparDescricao(m[2]).toUpperCase(), valor });
  }
  return resultado;
}

export const parserSicoob: ParserExtrato = { parse };
