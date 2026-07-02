// PARSER NÃO VALIDADO CONTRA EXTRATO REAL — ajustar com amostra real de Mercado Pago quando disponível.
import type { ParserExtrato } from "./types";
import { criarParserGenerico } from "./generico";

export const parserMercadoPago: ParserExtrato = criarParserGenerico();
