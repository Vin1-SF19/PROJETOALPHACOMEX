import type { TransacaoNormalizada } from "@/types/extrato";
import type { ParserExtrato } from "./types";
import { limparDescricao, paraNumeroBR } from "./utils";

const DATA_COMPLETA_INICIO = /^(\d{2}\/\d{2}\/\d{4})\s+/;
const VALOR_NO_FIM = /(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
const DATA_CURTA_INICIO = /^(\d{2})\/(\d{2})\s+/;
const PRIMEIRO_VALOR_MENSAL = /(-?\d{1,3}(?:\.\d{3})*,\d{2})(-)?/;
const MESES_ABREVIADOS = "jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez";

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

function obterAnoExtratoMensal(texto: string): string | null {
  return texto.match(new RegExp(`\\b(?:${MESES_ABREVIADOS})\\s+(\\d{4})\\b`, "i"))?.[1] ?? null;
}

function extrairMovimentacaoExtratoMensal(texto: string): string | null {
  const inicio = texto.search(/Conta\s+Corrente\s*\|\s*Movimenta[cç][aã]o/i);
  if (inicio === -1) return null;

  const trecho = texto.slice(inicio);
  const fim = trecho.search(/\n\s*Saldo\s+em\s+C\/C\b/i);
  return fim === -1 ? trecho : trecho.slice(0, fim);
}

function deveIgnorarLinhaMensal(linha: string): boolean {
  return (
    /^saldo\b/i.test(linha) ||
    /^data\s+descri[cç][aã]o\b/i.test(linha) ||
    /^\(cr[eé]ditos\)\s+\(d[eé]bitos\)$/i.test(linha) ||
    /^conta\s+corrente\s*\|\s*movimenta[cç][aã]o$/i.test(linha) ||
    /^[A-Z]\s*=/.test(linha) ||
    /^para\s+demais\s+siglas/i.test(linha) ||
    /^explicativas\s+no\s+final/i.test(linha) ||
    /^este\s+material\s+est[aá]\s+dispon[ií]vel/i.test(linha)
  );
}

/**
 * Parser do extrato mensal do Itaú Empresas, cuja tabela usa data curta e
 * valores em colunas de entrada, saída e saldo. O primeiro valor da linha é
 * sempre a movimentação; o saldo posterior é apenas informativo. Linhas sem
 * data herdam o último dia, inclusive na quebra entre páginas.
 */
function parseExtratoMensal(texto: string): TransacaoNormalizada[] | null {
  const ano = obterAnoExtratoMensal(texto);
  const movimentacao = extrairMovimentacaoExtratoMensal(texto);
  if (!ano || !movimentacao) return null;

  const transacoes: TransacaoNormalizada[] = [];
  let dataAtual: string | null = null;
  // Neste PDF o pdf-parse pode linearizar a tabela inteira da primeira página
  // em uma só linha. Recria os limites das linhas de data e da aplicação
  // automática, que não repete a data e vem depois da legenda "G = ...".
  const movimentacaoNormalizada = movimentacao
    .replace(/(^|\s)(\d{2}\/\d{2}\s+)/g, "$1\n$2")
    .replace(
      /\bG\s*=\s*aplica[cç][aã]o\s+programada\s+(Apl\s+Aplic\s+Aut\s+Mais)/gi,
      "\n$1",
    );

  for (const linha of movimentacaoNormalizada.split("\n").map((item) => item.trim()).filter(Boolean)) {
    if (deveIgnorarLinhaMensal(linha)) continue;

    const matchData = linha.match(DATA_CURTA_INICIO);
    const resto = matchData ? linha.slice(matchData[0].length).trim() : linha;
    if (matchData) dataAtual = `${matchData[1]}/${matchData[2]}/${ano}`;
    if (!dataAtual || !resto) continue;

    const matchValor = resto.match(PRIMEIRO_VALOR_MENSAL);
    if (!matchValor || matchValor.index === undefined) continue;

    const descricao = limparDescricao(resto.slice(0, matchValor.index));
    if (!descricao || /^saldo\b/i.test(descricao)) continue;

    let valor = paraNumeroBR(matchValor[1]);
    if (matchValor[2] === "-") valor = -Math.abs(valor);
    if (valor !== 0) transacoes.push({ data: dataAtual, descricao: descricao.toUpperCase(), valor });
  }

  return transacoes;
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
  const transacoesExtratoMensal = parseExtratoMensal(texto);
  if (transacoesExtratoMensal) return transacoesExtratoMensal;

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
