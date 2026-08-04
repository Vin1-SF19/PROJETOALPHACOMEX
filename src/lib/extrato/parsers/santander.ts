import type { TransacaoNormalizada } from "@/types/extrato";
import type { ParserExtrato } from "./types";
import { limparDescricao, paraNumeroBR } from "./utils";

const DATA_CURTA_INICIO = /^(\d{2}\/\d{2})(?:\/\d{2,4})?\s+/;
const PRIMEIRO_VALOR = /(-?\d{1,3}(?:\.\d{3})*,\d{2})(-)?/;
const MESES =
  "janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";

function pareceMesAnoIsolado(linha: string): boolean {
  return new RegExp(`^(?:${MESES})\\s*\\/\\s*\\d{4}$`, "i").test(linha);
}

function obterAnoDoExtrato(texto: string): string | null {
  return texto.match(new RegExp(`\\b(?:${MESES})\\s*\\/\\s*(\\d{4})`, "i"))?.[1] ?? null;
}

function recortarMovimentacaoContaCorrente(texto: string): string {
  const inicio = texto.search(/Conta\s+Corrente\s*\n\s*Movimenta[cç][aã]o/i);
  if (inicio === -1) return "";

  const trecho = texto.slice(inicio);
  const fim = trecho.search(/\n\s*Saldos\s+por\s+Per[ií]odo\b/i);
  return fim === -1 ? trecho : trecho.slice(0, fim);
}

function deveIgnorarLinhaSantander(linha: string): boolean {
  return (
    /^EXTRATO CONSOLIDADO INTELIGENTE$/i.test(linha) ||
    /^Extrato_PJ_/i.test(linha) ||
    /^BALP_/i.test(linha) ||
    /^Pagina:\s*\d+\/\d+$/i.test(linha) ||
    /^Data\s+Descri[cç][aã]o\b/i.test(linha) ||
    /^Cr[eé]ditos\s+D[eé]bitos$/i.test(linha) ||
    /^Conta\s+Corrente$/i.test(linha) ||
    /^Movimenta[cç][aã]o$/i.test(linha)
  );
}

function limparDescricaoSantander(texto: string): string {
  return limparDescricao(
    texto
      .replace(/\b\d{5,14}\b/g, "")
      .replace(/(?:^|\s)-\s*$/g, ""),
  );
}

/**
 * Parser do Extrato Consolidado Inteligente do Santander Empresas.
 *
 * Neste layout a data aparece somente na primeira movimentação do dia, os
 * débitos são marcados por um hífen depois do valor ("1.000,00-") e a página
 * contém outros quadros com valores que não pertencem à conta corrente. O
 * parser limita-se à seção "Conta Corrente / Movimentação", herda a última
 * data explícita e recompõe descrições quebradas antes de ler o primeiro valor
 * monetário da linha lógica como valor da movimentação.
 */
function parse(texto: string): TransacaoNormalizada[] {
  const ano = obterAnoDoExtrato(texto);
  const movimentacao = recortarMovimentacaoContaCorrente(texto);
  if (!ano || !movimentacao) return [];

  const transacoes: TransacaoNormalizada[] = [];
  const linhas = movimentacao.split("\n").map((linha) => linha.trim()).filter(Boolean);
  let dataAtual: string | null = null;
  let partesLinha: string[] = [];

  const concluirLinha = () => {
    if (!dataAtual || partesLinha.length === 0) {
      partesLinha = [];
      return;
    }

    const linha = limparDescricao(partesLinha.join(" "));
    partesLinha = [];

    if (/^SALDO\b/i.test(linha)) return;

    const matchValor = linha.match(PRIMEIRO_VALOR);
    if (!matchValor || matchValor.index === undefined) return;

    const descricao = limparDescricaoSantander(linha.slice(0, matchValor.index));
    let valor = paraNumeroBR(matchValor[1]);
    if (matchValor[2] === "-") valor = -Math.abs(valor);

    if (descricao && valor !== 0) {
      transacoes.push({
        data: dataAtual,
        descricao: descricao.toUpperCase(),
        valor,
      });
    }
  };

  for (const linha of linhas) {
    // O mesmo formato "mês/ano" aparece como cabeçalho de página e como
    // complemento legítimo de uma tarifa. Só é cabeçalho quando não há uma
    // movimentação incompleta sendo recomposta.
    if (pareceMesAnoIsolado(linha) && partesLinha.length === 0) continue;
    if (deveIgnorarLinhaSantander(linha)) continue;

    const matchData = linha.match(DATA_CURTA_INICIO);
    if (matchData) {
      concluirLinha();
      dataAtual = `${matchData[1]}/${ano}`;
      partesLinha = [linha.slice(matchData[0].length).trim()];
    } else {
      if (!dataAtual) continue;
      partesLinha.push(linha);
    }

    if (PRIMEIRO_VALOR.test(limparDescricao(partesLinha.join(" ")))) {
      concluirLinha();
    }
  }

  concluirLinha();
  return transacoes;
}

export const parserSantander: ParserExtrato = { parse };
