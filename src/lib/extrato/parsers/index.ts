import type { ParserExtrato } from "./types";
import { parserBradesco } from "./bradesco";
import { parserItau } from "./itau";
import { parserItauC } from "./itauC";
import { parserNubank } from "./nubank";
import { parserSicredi } from "./sicredi";
import { parserSantander } from "./santander";
import { parserBancoBrasil } from "./bancoBrasil";
import { parserSicoob } from "./sicoob";
import { parserBancoPan } from "./bancoPan";
import { parserMercadoPago } from "./mercadoPago";
import { parserPagBank } from "./pagBank";
import { parserC6 } from "./c6";
import { parserInter } from "./inter";
import { parserCredcrea } from "./credcrea";
import { parserCaixa } from "./caixa";
import { parserGenerico } from "./generico";

export type { ParserExtrato } from "./types";

export interface ParserDetectado {
  bancoId: "itau" | "santander" | "mercadoPago";
  parser: ParserExtrato;
}

/** Um parser por bancoId do catálogo (ver ModalBanco.tsx). */
export const PARSERS: Record<string, ParserExtrato> = {
  bradesco: parserBradesco,
  itau: parserItau,
  itauC: parserItauC,
  nubank: parserNubank,
  sicredi: parserSicredi,
  santander: parserSantander,
  bancoBrasil: parserBancoBrasil,
  sicoob: parserSicoob,
  bancoPan: parserBancoPan,
  mercadoPago: parserMercadoPago,
  pagBank: parserPagBank,
  c6: parserC6,
  inter: parserInter,
  credcrea: parserCredcrea,
  caixa: parserCaixa,
};

/** Retorna o parser do banco, ou o genérico se o bancoId não estiver mapeado. */
export function obterParser(bancoId: string | null | undefined): ParserExtrato {
  if (bancoId && PARSERS[bancoId]) return PARSERS[bancoId];
  return parserGenerico;
}

/** Detecta somente layouts validados contra amostras reais e com assinatura inequívoca. */
export function detectarParserExtrato(texto: string): ParserDetectado | null {
  const normalizado = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    normalizado.includes("lancamentos do periodo") &&
    normalizado.includes("saldo total disponivel dia")
  ) {
    return { bancoId: "itau", parser: parserItau };
  }

  if (
    normalizado.includes("extrato consolidado inteligente") &&
    normalizado.includes("conta corrente") &&
    normalizado.includes("movimentacao")
  ) {
    return { bancoId: "santander", parser: parserSantander };
  }

  if (
    normalizado.includes("extrato de conta") &&
    normalizado.includes("detalhe dos movimentos") &&
    normalizado.includes("mercado pago")
  ) {
    return { bancoId: "mercadoPago", parser: parserMercadoPago };
  }

  return null;
}
