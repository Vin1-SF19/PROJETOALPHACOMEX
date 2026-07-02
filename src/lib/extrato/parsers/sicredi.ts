// PARSER NÃO VALIDADO CONTRA EXTRATO REAL — ajustar com amostra real de Sicredi quando disponível.
import type { ParserExtrato } from "./types";
import { criarParserGenerico } from "./generico";

export const parserSicredi: ParserExtrato = criarParserGenerico();
