// PARSER NÃO VALIDADO CONTRA EXTRATO REAL — ajustar com amostra real de Caixa quando disponível.
import type { ParserExtrato } from "./types";
import { criarParserGenerico } from "./generico";

export const parserCaixa: ParserExtrato = criarParserGenerico();
