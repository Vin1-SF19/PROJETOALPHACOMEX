export type TipoArquivoMesclagem = "principal" | "complementar";

export interface LinhaPlanilha {
  numero: number;
  valores: Record<number, string>;
}

export interface ColunaPlanilha {
  numero: number;
  nome: string;
  nomeNormalizado: string;
}

export interface AbaPlanilha {
  nome: string;
  colunas: ColunaPlanilha[];
  totalLinhas: number;
}

export interface InspecaoPlanilha {
  nomeArquivo: string;
  extensao: string;
  abas: AbaPlanilha[];
  colunasCnpjSugeridas: number[];
}

export type StatusCnpj = "valido" | "invalido" | "vazio";

export interface DiagnosticoCnpj {
  status: StatusCnpj;
  total: number;
  validos: number;
  invalidos: number;
  vazios: number;
  duplicados: number;
  exemplosInvalidos: string[];
}

export interface CampoMapeamento {
  destino: string;
  origem: number | null;
  origemNome: string | null;
  automatico: boolean;
  /** Indica que o usuário revisou este destino, inclusive escolhendo Vazio. */
  manual?: boolean;
  origemPrincipal?: number | null;
  origemPrincipalNome?: string | null;
}

export interface LinhaMesclada {
  id: string;
  cnpj: string | null;
  origemPrincipal: number;
  origemComplementar: number | null;
  valores: Record<string, string>;
}

export interface ResumoMesclagem {
  totalLinhas: number;
  comMatch: number;
  semMatch: number;
  linhasComplementares: number;
  cnpj: DiagnosticoCnpj;
}

export interface ResultadoMesclagem {
  resumo: ResumoMesclagem;
  linhas: LinhaMesclada[];
}

export interface PreviaMesclagem {
  principal: InspecaoPlanilha;
  complementar: InspecaoPlanilha;
  abaPrincipal: string;
  abaComplementar: string;
  colunaCnpjPrincipal: number;
  colunaCnpjComplementar: number;
  mapeamento: CampoMapeamento[];
  resultado: ResultadoMesclagem;
}

export interface ObservabilidadeMapeamentoIa {
  status: "nao_necessario" | "sucesso" | "timeout" | "falha" | "resposta_invalida" | "truncado";
  finishReason: string | null;
  duracaoMs: number;
  pendentes: number;
  aplicados: number;
}

export interface SugestaoMapeamento {
  mapeamento: CampoMapeamento[];
  ia: ObservabilidadeMapeamentoIa;
}
