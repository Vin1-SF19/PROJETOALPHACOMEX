export const TIPOS_IMPORTACAO = ["socios", "cs", "feedbacks"] as const;

export type TipoImportacao = (typeof TIPOS_IMPORTACAO)[number];

export type StatusLinhaImportacao = "valida" | "ambigua" | "invalida";

export interface IdentificadorEmpresaImportacao {
  cnpj: string | null;
  razaoSocial: string | null;
}

export interface CandidatoEmpresaImportacao {
  clienteId: number;
  cnpj: string;
  razaoSocial: string;
  servico: string | null;
  status: string;
}

export interface DadosSocioImportacao {
  nome: string;
  telefone: string | null;
  observacao: string | null;
  dataNascimento: string | null;
  vinculo: string | null;
}

export type SentimentoImportacao = "pos" | "neg" | "na";

export interface DadosLogImportacao {
  colaborador: string;
  sentimento: SentimentoImportacao;
  observacao: string | null;
  /** Data civil canônica no formato YYYY-MM-DD; null aplica a data da confirmação. */
  dataRegistro: string | null;
}

export type DadosLinhaImportacao = DadosSocioImportacao | DadosLogImportacao;

export interface LinhaImportacaoPreview {
  id: string;
  tipo: TipoImportacao;
  aba: "Socios" | "CS" | "Feedbacks";
  numeroLinha: number;
  identificador: IdentificadorEmpresaImportacao;
  dados: DadosLinhaImportacao;
  status: StatusLinhaImportacao;
  clienteIdSugerido: number | null;
  candidatos: CandidatoEmpresaImportacao[];
  mensagens: string[];
}

export interface TotaisImportacao {
  total: number;
  validas: number;
  ambiguas: number;
  invalidas: number;
  porTipo: Record<TipoImportacao, number>;
}

export interface PrevisualizacaoImportacao {
  arquivo: string;
  tipos: TipoImportacao[];
  totais: TotaisImportacao;
  linhas: LinhaImportacaoPreview[];
}

export interface LinhaSalvarImportacao {
  id: string;
  tipo: TipoImportacao;
  aba: "Socios" | "CS" | "Feedbacks";
  numeroLinha: number;
  identificador: IdentificadorEmpresaImportacao;
  dados: DadosLinhaImportacao;
  clienteId: number;
}

export interface ResumoEmpresaImportacao {
  clienteId: number;
  cnpj: string;
  razaoSocial: string;
  servico: string | null;
  status: string;
  total: number;
  socios: number;
  cs: number;
  feedbacks: number;
  linhasOrigem: Array<{
    id: string;
    tipo: TipoImportacao;
    aba: "Socios" | "CS" | "Feedbacks";
    numeroLinha: number;
  }>;
}

export interface ResumoImportacaoSalva {
  total: number;
  socios: number;
  cs: number;
  feedbacks: number;
  empresasAfetadas: number;
  empresas: ResumoEmpresaImportacao[];
}

export interface RespostaApiSucesso<T> {
  success: true;
  data: T;
  message?: string;
}

export interface RespostaApiErro {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}

export type RespostaApi<T> = RespostaApiSucesso<T> | RespostaApiErro;
