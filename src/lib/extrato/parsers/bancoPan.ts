// PARSER NÃO VALIDADO CONTRA EXTRATO REAL — ajustar com amostra real de Banco Pan quando disponível.
import type { ParserExtrato } from "./types";
import { criarParserGenerico } from "./generico";

export const parserBancoPan: ParserExtrato = criarParserGenerico();
