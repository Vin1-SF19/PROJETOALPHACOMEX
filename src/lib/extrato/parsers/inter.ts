import type { TransacaoNormalizada } from "@/types/extrato";
import type { ParserExtrato } from "./types";
import { limparDescricao, paraNumeroBR } from "./utils";

const MESES: Record<string, string> = { janeiro: "01", fevereiro: "02", "março": "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12" };

function parse(texto: string): TransacaoNormalizada[] {
  const resultado: TransacaoNormalizada[] = [];
  let data = "";
  for (const linha of texto.split("\n")) {
    const dia = linha.match(/(?:^|\t)(\d{1,2}) de ([a-zç]+) de (20\d{2}) Saldo do dia:/i);
    if (dia) data = `${dia[1].padStart(2, "0")}/${MESES[dia[2].toLowerCase()]}/${dia[3]}`;
    const m = linha.match(/^(.+?)\s+(-?R\$\s*[\d.]+,\d{2})\s+-?R\$\s*[\d.]+,\d{2}\s*$/);
    if (!m || !data || /saldo do dia/i.test(m[1])) continue;
    const valor = paraNumeroBR(m[2].replace(/R\$\s*/, ""));
    if (valor) resultado.push({ data, descricao: limparDescricao(m[1]).toUpperCase(), valor });
  }
  return resultado;
}

export const parserInter: ParserExtrato = { parse };
