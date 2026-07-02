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
 * Parser do extrato Bradesco (Net Empresa).
 * Baseado em amostra real de texto extraído via Tika/OCR:
 *
 *   Data Lançamento Dcto. Crédito (R$) Débito (R$) Saldo (R$)
 *   29/05/2026 SALDO ANTERIOR 33.831,66
 *   01/06/2026 MED ETEIDO DIST RESTO RI 3172752 897.951,29 931.782,95
 *   REMEL NAS SERVICOS É COME 3295045 2.508,00 934.290,95
 *   REM: LUIZ AMORIM REPRESENT 01/06 751382 8.650,80 942.941,15
 *
 * Padrão real: a coluna Data só é impressa na PRIMEIRA linha de cada dia — as
 * linhas seguintes do mesmo dia (mesmo tendo cada uma sua própria movimentação,
 * com número de documento e valores próprios) aparecem SEM data. Cada linha que
 * contém pelo menos 1 valor monetário é uma transação própria; a data usada é
 * a última data explícita vista. Quando 2 valores aparecem na linha, o último
 * é o SALDO resultante (descartado) e o penúltimo é o VALOR da movimentação.
 * Linhas sem NENHUM valor monetário (raro) são tratadas como continuação de
 * descrição da transação anterior.
 *
 * LIMITAÇÃO CONHECIDA: o texto corrido não preserva a separação de coluna
 * entre Crédito e Débito (ambos colam na mesma posição no texto linear do
 * OCR/Tika). Sem uma amostra real contendo uma transação de DÉBITO visível
 * não é seguro inferir o sinal — por ora todo valor sai como está no texto
 * (positivo). Ajustar quando houver amostra real com débito confirmado.
 */
function limparNumerosDaDescricao(texto: string): string {
  return texto
    .replace(/-?\d{1,3}(?:\.\d{3})*,\d{2}/g, "") // valores monetários
    .replace(/\b\d{5,}\b/g, "") // número de documento
    .replace(/\b\d{2}\/\d{2}\b/g, ""); // data curta DD/MM solta na descrição
}

function parse(texto: string): TransacaoNormalizada[] {
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const transacoes: TransacaoNormalizada[] = [];

  let dataAtual: string | null = null;
  let ultimaTransacao: TransacaoNormalizada | null = null;

  for (const linhaBruta of linhas) {
    if (deveIgnorarLinha(linhaBruta)) continue;
    if (/saldo\s+anterior/i.test(linhaBruta)) continue;

    const matchData = linhaBruta.match(REGEX_DATA_INICIO);
    const resto = matchData ? linhaBruta.slice(matchData[0].length).trim() : linhaBruta;
    if (matchData) dataAtual = matchData[1];

    const valores = extrairValoresBR(resto);

    if (valores.length === 0) {
      // Sem valor monetário na linha — continuação de descrição da transação anterior
      if (ultimaTransacao) {
        const complemento = limparNumerosDaDescricao(resto).trim();
        if (complemento) {
          ultimaTransacao.descricao = limparDescricao(`${ultimaTransacao.descricao} ${complemento}`).toUpperCase();
        }
      }
      continue;
    }

    if (!dataAtual) continue; // linha com valor mas nenhuma data vista ainda — descarta

    // Último valor = saldo (descarta quando há 2+); penúltimo (ou único) = valor da movimentação
    const valorTexto = valores.length >= 2 ? valores[valores.length - 2] : valores[0];
    const descricao = limparDescricao(limparNumerosDaDescricao(resto));
    const valor = paraNumeroBR(valorTexto);

    if (descricao && valor !== 0) {
      const transacao: TransacaoNormalizada = { data: dataAtual, descricao: descricao.toUpperCase(), valor };
      transacoes.push(transacao);
      ultimaTransacao = transacao;
    }
  }

  return transacoes;
}

export const parserBradesco: ParserExtrato = { parse };
