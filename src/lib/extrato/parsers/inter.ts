// PARSER NÃO VALIDADO CONTRA EXTRATO REAL — ajustar com amostra real de Inter quando disponível.
import type { ParserExtrato } from "./types";
import { criarParserGenerico } from "./generico";

export const parserInter: ParserExtrato = criarParserGenerico();
