// PARSER NÃO VALIDADO CONTRA EXTRATO REAL — ajustar com amostra real de C6 Bank quando disponível.
import type { ParserExtrato } from "./types";
import { criarParserGenerico } from "./generico";

export const parserC6: ParserExtrato = criarParserGenerico();
