// PARSER NÃO VALIDADO CONTRA EXTRATO REAL — ajustar com amostra real de Banco do Brasil quando disponível.
import type { ParserExtrato } from "./types";
import { criarParserGenerico } from "./generico";

export const parserBancoBrasil: ParserExtrato = criarParserGenerico();
