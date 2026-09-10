import type { TransacaoNormalizada } from "@/types/extrato";
import type { ParserExtrato } from "./types";
import { limparDescricao, paraNumeroBR } from "./utils";

const REGISTRO_INICIO = /^(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+\S+\s+(.+)$/;
const VALOR_E_SALDO_NO_FIM = /(?:^|\s)(-\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})\s+R\s*\$\s*-?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*$/;

/**
 * Parser do Internet Banking CAIXA no layout "Extrato — Lançamentos".
 *
 * Cada registro contém data de lançamento, data de movimento, documento,
 * histórico, valor da movimentação e saldo acumulado. A extração do PDF pode
 * quebrar o histórico ou até o valor em uma linha física seguinte; por isso o
 * parser recompõe o registro até encontrar o par final "valor + R$ saldo".
 * Apenas o primeiro valor desse par é importado.
 */
function parse(texto: string): TransacaoNormalizada[] {
  const transacoes: TransacaoNormalizada[] = [];
  const linhas = texto.split("\n").map((linha) => linha.trim()).filter(Boolean);
  let dataAtual = "";
  let partesRegistro: string[] = [];

  const concluirRegistro = () => {
    if (!dataAtual || partesRegistro.length === 0) {
      dataAtual = "";
      partesRegistro = [];
      return;
    }

    const conteudo = limparDescricao(partesRegistro.join(" "));
    const matchValor = conteudo.match(VALOR_E_SALDO_NO_FIM);
    const data = dataAtual;

    dataAtual = "";
    partesRegistro = [];

    if (!matchValor || matchValor.index === undefined) return;

    const descricao = limparDescricao(conteudo.slice(0, matchValor.index)).toUpperCase();
    if (!descricao || /\bSALDO\s+DIA\b/i.test(descricao)) return;

    let valor = paraNumeroBR(matchValor[2]);
    if (matchValor[1]) valor = -Math.abs(valor);

    if (valor !== 0) transacoes.push({ data, descricao, valor });
  };

  for (const linha of linhas) {
    const matchInicio = linha.match(REGISTRO_INICIO);

    if (matchInicio) {
      concluirRegistro();
      dataAtual = matchInicio[1];
      partesRegistro = [matchInicio[2]];
    } else if (partesRegistro.length > 0) {
      partesRegistro.push(linha);
    } else {
      continue;
    }

    if (VALOR_E_SALDO_NO_FIM.test(limparDescricao(partesRegistro.join(" ")))) {
      concluirRegistro();
    }
  }

  concluirRegistro();
  return transacoes;
}

export const parserCaixa: ParserExtrato = { parse };
