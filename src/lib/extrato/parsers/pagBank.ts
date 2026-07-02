// PARSER NÃO VALIDADO CONTRA EXTRATO REAL — ajustar com amostra real de Pag Bank quando disponível.
import type { ParserExtrato } from "./types";
import { criarParserGenerico } from "./generico";

export const parserPagBank: ParserExtrato = criarParserGenerico();
