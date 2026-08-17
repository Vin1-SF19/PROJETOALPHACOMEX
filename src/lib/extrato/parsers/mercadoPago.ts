import type { TransacaoNormalizada } from "@/types/extrato";
import type { ParserExtrato } from "./types";
import { limparDescricao, paraNumeroBR } from "./utils";

const DATA_INICIO = /^(\d{2})-(\d{2})-(\d{4})\s*/;
/** Linha fechada: ID da operação + valor da movimentação + saldo acumulado, ambos "R$ X,XX". */
const FIM_TRANSACAO = /(\d{4,})\s+R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})\s+R\$\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
const LINHA_IGNORAR = /^(data descri[çc][ãa]o id da opera[çc][ãa]o valor saldo|saldo\s+(inicial|final)|entradas:|saidas:|extrato de conta|cpf\/cnpj|de\s+\d{2}-\d{2}-\d{4}\s+al|detalhe dos movimentos)/i;

/**
 * Parser do "Extrato de Conta" do Mercado Pago (relatório em PDF, texto nativo).
 *
 * Layout: cada movimentação é `DD-MM-YYYY Descrição (pode quebrar em várias
 * linhas físicas) ID_DA_OPERACAO R$ valor R$ saldo`. A data pode ficar sozinha
 * numa linha quando a descrição é longa; o parser recompõe a linha lógica até
 * encontrar o par "ID + R$ valor + R$ saldo" no fim (dois valores monetários —
 * o PRIMEIRO é o valor da movimentação, o SEGUNDO é o saldo acumulado e é
 * descartado). Cada página do PDF sempre fecha numa transação completa
 * (confirmado em amostra real de 282 páginas) — processar o texto concatenado
 * das páginas funciona sem tratamento especial de quebra de página.
 */
function parse(texto: string): TransacaoNormalizada[] {
  const transacoes: TransacaoNormalizada[] = [];
  const linhas = texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha && !LINHA_IGNORAR.test(linha) && !/^\d+\/\d+$/.test(linha));

  let linhaLogica = "";

  const concluirLinha = () => {
    const matchData = linhaLogica.match(DATA_INICIO);
    const matchFim = linhaLogica.match(FIM_TRANSACAO);
    if (!matchData || !matchFim || matchFim.index === undefined) {
      linhaLogica = "";
      return;
    }

    const data = `${matchData[1]}/${matchData[2]}/${matchData[3]}`;
    const descricao = limparDescricao(
      linhaLogica.slice(matchData[0].length, matchFim.index),
    );
    const valor = paraNumeroBR(matchFim[2]);

    if (descricao && valor !== 0) {
      transacoes.push({ data, descricao: descricao.toUpperCase(), valor });
    }

    linhaLogica = "";
  };

  for (const linha of linhas) {
    const matchData = linha.match(DATA_INICIO);

    if (matchData) {
      if (linhaLogica) concluirLinha();
      linhaLogica = linha;
    } else if (linhaLogica) {
      linhaLogica = limparDescricao(`${linhaLogica} ${linha}`);
    }

    if (linhaLogica && FIM_TRANSACAO.test(linhaLogica)) concluirLinha();
  }

  return transacoes;
}

export const parserMercadoPago: ParserExtrato = { parse };
