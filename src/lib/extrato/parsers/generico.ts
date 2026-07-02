import type { TransacaoNormalizada } from "@/types/extrato";
import type { ParserExtrato } from "./types";
import {
  REGEX_DATA_INICIO,
  extrairValoresBR,
  paraNumeroBR,
  limparDescricao,
  deveIgnorarLinha,
} from "./utils";

/**
 * PARSER NÃO VALIDADO CONTRA EXTRATO REAL — heurística genérica de melhor
 * esforço para bancos sem parser dedicado ainda. Ajustar (ou promover a um
 * parser dedicado) quando houver amostra real do banco em questão.
 *
 * Heurística: cada linha que começa com data DD/MM/YYYY é uma transação; o
 * último valor monetário BR encontrado na linha é o valor da movimentação
 * (assume-se que não há coluna de saldo à direita, diferente do Bradesco —
 * isso é uma suposição não validada). A descrição é o texto entre a data e
 * o primeiro valor monetário.
 */
function parse(texto: string): TransacaoNormalizada[] {
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const transacoes: TransacaoNormalizada[] = [];

  for (const linha of linhas) {
    if (deveIgnorarLinha(linha)) continue;

    const matchData = linha.match(REGEX_DATA_INICIO);
    if (!matchData) continue;

    const data = matchData[1];
    const resto = linha.slice(matchData[0].length).trim();
    const valores = extrairValoresBR(resto);
    if (valores.length === 0) continue;

    const valorTexto = valores[valores.length - 1];
    const valor = paraNumeroBR(valorTexto);

    const descricaoBruta = resto
      .replace(/-?\d{1,3}(?:\.\d{3})*,\d{2}/g, "")
      .replace(/\b\d{5,}\b/g, "");
    const descricao = limparDescricao(descricaoBruta);

    if (descricao && valor !== 0) {
      transacoes.push({ data, descricao: descricao.toUpperCase(), valor });
    }
  }

  return transacoes;
}

export function criarParserGenerico(): ParserExtrato {
  return { parse };
}

export const parserGenerico: ParserExtrato = { parse };
