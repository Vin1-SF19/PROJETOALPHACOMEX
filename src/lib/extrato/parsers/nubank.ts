import type { TransacaoNormalizada } from "@/types/extrato";
import type { ParserExtrato } from "./types";
import { limparDescricao, paraNumeroBR } from "./utils";

const MESES: Record<string, string> = { JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06", JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12" };
const VALOR_FINAL = /(?:^|\s)([\d.]+,\d{2})\s*$/;

function parse(texto: string): TransacaoNormalizada[] {
  const resultado: TransacaoNormalizada[] = [];
  const cabecalhoEmpresa = texto.split("\n")[0].trim();
  let data = "";
  let sinal = 0;
  let descricao = "";
  let dentro = false;
  let cabecalhoPagina = false;
  for (const linhaBruta of texto.split("\n")) {
    const linha = linhaBruta.trim();
    if (/^Saldo final do período$/i.test(linha)) { dentro = false; descricao = ""; continue; }
    if (linha === "Movimentações") { dentro = true; descricao = ""; continue; }
    if (/^Extrato gerado dia/i.test(linha)) { cabecalhoPagina = true; continue; }
    if (cabecalhoPagina) {
      if (/VALORES EM R\$/i.test(linha)) cabecalhoPagina = false;
      continue;
    }
    if (linha === cabecalhoEmpresa || /^\d{7,}-\d$/.test(linha) || /^a\s+\d{2} DE [A-ZÇ]+ DE 20\d{2}.*VALORES EM R\$/i.test(linha)) continue;
    const dataDia = linha.match(/^(\d{2})\s+([A-Z]{3})\s+(20\d{2})\s+Total de (entradas|saídas)/i);
    if (dataDia) data = `${dataDia[1]}/${MESES[dataDia[2].toUpperCase()]}/${dataDia[3]}`;
    if (!dentro || !data) continue;
    const total = linha.match(/(?:^|\s)Total de (entradas|saídas)\s+[+-]\s*[\d.]+,\d{2}$/i);
    if (total) { sinal = total[1].toLowerCase() === "saídas" ? -1 : 1; descricao = ""; continue; }
    if (/^Saldo do dia\b/i.test(linha)) { descricao = ""; continue; }
    if (/^Tem alguma dúvida|^Caso a solução|^disponíveis em nubank|^metropolitanas\)|^Saldo (final|inicial)|^CNPJ Agência Conta|^Rendimento líquido/i.test(linha)) continue;
    if (!sinal || !linha) continue;
    const valor = linha.match(VALOR_FINAL);
    if (valor) {
      const parte = linha.slice(0, valor.index).trim();
      const historico = limparDescricao(`${descricao} ${parte}`);
      const numero = paraNumeroBR(valor[1]) * sinal;
      if (historico && numero) resultado.push({ data, descricao: historico.toUpperCase(), valor: numero });
      descricao = "";
    } else if (!/^\d+ de \d+$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(linha)) {
      descricao = limparDescricao(`${descricao} ${linha}`);
    }
  }
  return resultado;
}

export const parserNubank: ParserExtrato = { parse };
