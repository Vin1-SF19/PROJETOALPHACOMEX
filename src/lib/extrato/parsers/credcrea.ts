// PARSER NÃO VALIDADO CONTRA EXTRATO REAL — ajustar com amostra real de CredCrea quando disponível.
import type { ParserExtrato } from "./types";
import { criarParserGenerico } from "./generico";

export const parserCredcrea: ParserExtrato = criarParserGenerico();
