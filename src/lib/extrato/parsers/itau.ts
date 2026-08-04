import type { TransacaoNormalizada } from "@/types/extrato";
import type { ParserExtrato } from "./types";
import { limparDescricao, paraNumeroBR } from "./utils";

const DATA_COMPLETA_INICIO = /^(\d{2}\/\d{2}\/\d{4})\s+/;
const VALOR_NO_FIM = /(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

function limparDescricaoItau(texto: string): string {
  return limparDescricao(
    texto
      .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, "")
      .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "")
      .replace(/\b\d{11,14}\b/g, ""),
  );
}

function pareceSaldo(descricao: string): boolean {
  return /\bSALDO\s+(TOTAL\s+DISPON[IÍ]VEL\s+DIA|ANTERIOR|ATUAL)\b/i.test(descricao);
}

/**
 * Parser do relatório simplificado do Itaú Empresas.
 *
 * O texto extraído pelo pdf-parse pode quebrar descrição, razão social e valor
 * em linhas diferentes. Há ainda uma quebra de página observada em que o começo
 * do histórico fica na página anterior e a linha seguinte repete a data antes
 * do restante do histórico e do valor. Por isso o parser recompõe uma linha
 * lógica até encontrar um valor monetário no fim, em vez de assumir que cada
 * linha física do PDF é uma transação completa.
 */
function parse(texto: string): TransacaoNormalizada[] {
  const transacoes: TransacaoNormalizada[] = [];
  const linhas = texto.split("\n").map((linha) => linha.trim()).filter(Boolean);
  let linhaLogica = "";
  let prefixoDaProximaLinha = "";

  const concluirLinha = () => {
    const matchData = linhaLogica.match(DATA_COMPLETA_INICIO);
    const matchValor = linhaLogica.match(VALOR_NO_FIM);
    if (!matchData || !matchValor) {
      linhaLogica = "";
      return;
    }

    const descricao = limparDescricaoItau(
      linhaLogica.slice(matchData[0].length, matchValor.index).trim(),
    );
    const valor = paraNumeroBR(matchValor[1]);

    if (descricao && valor !== 0 && !pareceSaldo(descricao)) {
      transacoes.push({
        data: matchData[1],
        descricao: descricao.toUpperCase(),
        valor,
      });
    }

    linhaLogica = "";
  };

  for (const linha of linhas) {
    const matchData = linha.match(DATA_COMPLETA_INICIO);

    if (matchData) {
      if (linhaLogica) concluirLinha();

      const resto = linha.slice(matchData[0].length).trim();
      linhaLogica = limparDescricao(
        `${matchData[1]} ${prefixoDaProximaLinha} ${resto}`,
      );
      prefixoDaProximaLinha = "";
    } else if (linhaLogica) {
      linhaLogica = limparDescricao(`${linhaLogica} ${linha}`);
    } else {
      // Conserva apenas uma possível continuação entre páginas. Cabeçalhos
      // acumulados aqui serão descartados junto da próxima linha de saldo.
      prefixoDaProximaLinha = limparDescricao(`${prefixoDaProximaLinha} ${linha}`);
    }

    if (linhaLogica && VALOR_NO_FIM.test(linhaLogica)) concluirLinha();
  }

  if (linhaLogica) concluirLinha();
  return transacoes;
}

export const parserItau: ParserExtrato = { parse };
