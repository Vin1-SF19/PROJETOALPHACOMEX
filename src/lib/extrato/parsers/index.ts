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
