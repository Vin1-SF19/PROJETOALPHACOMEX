// PARSER NÃO VALIDADO CONTRA EXTRATO REAL — ajustar com amostra real de Nubank quando disponível.
import type { ParserExtrato } from "./types";
import { criarParserGenerico } from "./generico";

export const parserNubank: ParserExtrato = criarParserGenerico();
