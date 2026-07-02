// PARSER NÃO VALIDADO CONTRA EXTRATO REAL — ajustar com amostra real de Sicoob quando disponível.
import type { ParserExtrato } from "./types";
import { criarParserGenerico } from "./generico";

export const parserSicoob: ParserExtrato = criarParserGenerico();
