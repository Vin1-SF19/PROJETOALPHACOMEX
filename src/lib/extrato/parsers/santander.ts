// PARSER NÃO VALIDADO CONTRA EXTRATO REAL — ajustar com amostra real de Santander quando disponível.
import type { ParserExtrato } from "./types";
import { criarParserGenerico } from "./generico";

export const parserSantander: ParserExtrato = criarParserGenerico();
