/** Núcleo puro do Motor de Regras BPM (RM-2026-19631A, Fase 1). */

export const OPERADORES_REGRAS = [
  "igual", "diferente", "maior", "menor", "maiorOuIgual", "menorOuIgual",
  "preenchido", "vazio", "contem", "naoContem", "estaEm", "naoEstaEm",
  "dataAntes", "dataDepois",
] as const;
export type OperadorRegra = (typeof OPERADORES_REGRAS)[number];

export const TIPOS_VALOR = ["texto", "numero", "booleano", "lista", "nulo", "data"] as const;
export type TipoValor = (typeof TIPOS_VALOR)[number];

export const CAMPOS_FIXOS_POR_FONTE = {
  card: ["id", "pipelineId", "etapaId", "responsavelId", "servico", "status", "createdAt", "updatedAt", "concluidoEm", "primeiraVisualizacaoEm", "proximoContatoEm", "dataReuniao", "statusPosFechamento"],
  cliente: ["id", "cnpj", "razaoSocial", "nomeFantasia", "dataConstituicao", "uf", "municipio", "regimeTributario", "capitalSocial", "situacaoCadastral", "status"],
  processo: ["pipelineId", "pipelineNome", "etapaOrigemId", "etapaOrigemNome", "etapaDestinoId", "etapaDestinoNome", "origemMovimentacao"],
  contratacao: ["servico", "status", "analistaResponsavel", "dataContratacao", "dataExito", "formaPagamento", "valorContrato", "closerNome", "ultimoCs", "nps", "feedbackGoogle", "embasamento", "origemLead", "canalAquisicao", "canalOutro", "indicadoPorParceiroId"],
  relacionada: ["responsavel.id", "responsavel.nome", "membros.quantidade", "tarefas.quantidade", "anexos.quantidade", "vinculos.quantidade"],
  checklist: ["total", "concluidos", "percentual", "concluido", "pendentesObrigatorios", "possuiPendenciaObrigatoria"],
} as const;
export type FonteFixa = keyof typeof CAMPOS_FIXOS_POR_FONTE;
export type FonteCampo = FonteFixa | "campo_dinamico";
export type CampoFixoReferencia = { [F in FonteFixa]: { fonte: F; campo: (typeof CAMPOS_FIXOS_POR_FONTE)[F][number] } }[FonteFixa];
export type CampoDinamicoReferencia = { fonte: "campo_dinamico"; campo: string };
export type CampoReferencia = CampoFixoReferencia | CampoDinamicoReferencia;

export const LIMITES_REGRAS = {
  profundidadeMaxima: 5,
  condicoesMaximas: 50,
  listaMaxima: 100,
  formulaCaracteresMaximos: 500,
  formulaTokensMaximos: 200,
  formulaProfundidadeMaxima: 10,
  tabelaDecisaoLinhasMaximas: 50,
} as const;

export type ValorRegra = string | number | boolean | null | ValorRegra[];
export type ContextoAvaliacao = {
  card: Record<string, unknown>;
  cliente?: Record<string, unknown>;
  processo?: Record<string, unknown>;
  contratacao?: Record<string, unknown>;
  relacionada?: Record<string, unknown>;
  checklist?: Record<string, unknown>;
  camposDinamicos?: Record<string, unknown>;
};
export type CondicaoFolha = { tipo: "condicao"; campo: CampoReferencia; operador: OperadorRegra; valor?: unknown; tipoEsperado?: TipoValor };
export type GrupoCondicao = { operador: "AND" | "OR"; condicoes: (CondicaoFolha | GrupoCondicao)[] };
export type OperacaoCalculo = "soma" | "subtracao" | "multiplicacao" | "divisao";
export type TabelaDecisao = { linhas: { condicao: GrupoCondicao; resultado: ValorRegra }[]; padrao?: ValorRegra };
export type ResultadoRegra =
  | { tipo: "campo_obrigatorio"; campos: CampoReferencia[]; mensagem?: string }
  | { tipo: "bloqueio_movimentacao"; mensagem: string }
  | { tipo: "mensagem_validacao"; mensagem: string }
  | { tipo: "calculo"; operacao: OperacaoCalculo; operandos: CampoReferencia[]; campoDestino: CampoReferencia }
  | { tipo: "formula_segura"; expressao: string; campoDestino: CampoReferencia }
  | { tipo: "tabela_decisao"; tabela: TabelaDecisao; campoDestino: CampoReferencia }
  | { tipo: "resultado_condicional"; valor: ValorRegra; campoDestino?: CampoReferencia };
export type RegraBpm = { id: string; versao: number; nome: string; ativa: boolean; prioridade: number; pipelineId?: string; etapaOrigemId?: string; etapaDestinoId?: string; condicao: GrupoCondicao; resultado: ResultadoRegra };
export type ResultadoAvaliacao = {
  permitida: boolean;
  aplicada: boolean;
  motivo?: string;
  obrigatorios?: CampoReferencia[];
  mensagens?: string[];
  calculos?: Record<string, number>;
  resultados?: Record<string, ValorRegra>;
  erros?: { codigo: string; mensagem: string }[];
};
export class ErroRegra extends Error {
  constructor(message: string, public readonly codigo: string) { super(message); this.name = "ErroRegra"; }
}
