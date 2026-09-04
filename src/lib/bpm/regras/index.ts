/**
 * Motor de Regras e Validações — Re-exports
 * RM-2026-19631A, Fase 1
 */

export {
  OPERADORES_REGRAS,
  CAMPOS_FIXOS_POR_FONTE,
  TIPOS_VALOR,
  LIMITES_REGRAS,
  ErroRegra,
} from "./types";

export type {
  OperadorRegra,
  FonteCampo,
  CampoReferencia,
  TipoValor,
  FonteFixa,
  ValorRegra,
  OperacaoCalculo,
  ContextoAvaliacao,
  ResultadoAvaliacao,
  RegraBpm,
  GrupoCondicao,
  CondicaoFolha,
  ResultadoRegra,
  TabelaDecisao,
} from "./types";

export {
  campoReferenciaSchema,
  operadorSchema,
  tipoValorSchema,
  condicaoFolhaSchema,
  grupoCondicaoSchema,
  tabelaDecisaoSchema,
  resultadoRegraSchema,
  regraBpmSchema,
  contextoAvaliacaoSchema,
  fixtureCliSchema,
} from "./schemas";

export type { RegraBpmInput } from "./schemas";

export {
  resolverCampo,
  coercarValor,
  avaliarCondicao,
  avaliarGrupo,
  validarLimites,
  avaliarFormula,
  avaliarTabelaDecisao,
  avaliarRegra,
  avaliarRegras,
} from "./avaliador";

export type { ValorCoercido } from "./avaliador";
