// PARSER NÃO VALIDADO CONTRA EXTRATO REAL — ajustar com amostra real de Itaú Consolidado quando disponível.
import type { ParserExtrato } from "./types";
import { criarParserGenerico } from "./generico";

export const parserItauC: ParserExtrato = criarParserGenerico();
