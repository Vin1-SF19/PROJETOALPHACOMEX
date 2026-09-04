export type VariavelTemplateAutomacao = {
  nome: string;
  label: string;
  tipo: string;
  obrigatorio: boolean;
  placeholder?: string;
};
export type TemplateAutomacao = {
  id: string;
  titulo: string;
  categoria: string | null;
  variaveis: VariavelTemplateAutomacao[];
};

export type AutomacaoBpmView = {
  id: string;
  nome: string;
  descricao: string | null;
  gatilhoTipo: string;
  tempoMinutos: number | null;
  acaoTipo: string;
  parametrosJson: string;
  ativa: boolean;
  escopo?: "ETAPAS" | "GLOBAL_PIPELINE";
  etapasIds?: string[];
  recorrencia?: unknown | null;
  proximaExecucao?: string | null;
  versaoAtiva?: {
    id: string;
    versao: number;
    status: string;
    gatilhoTipo: string;
    gatilhoConfigJson: string;
    condicaoJson: string | null;
    grafoJson: string;
    timezone: string;
  } | null;
  criadoPor: { id: number; nome: string };
  createdAt: string;
  updatedAt: string;
  ultimaExecucao: {
    id: string;
    status: string;
    mensagemErro: string | null;
    resultadoJson?: string | null;
    gatilhoTipo?: string;
    executadoEm: string | null;
    createdAt: string;
    evento?: { tipo: string; atorTipo: string; ocorridoEm: string } | null;
  } | null;
  _count: { execucoes: number };
};

export type EtapaAutomacaoView = {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  automacoes: AutomacaoBpmView[];
};

export type PipelineAutomacaoView = {
  id: string;
  nome: string;
  ativo: boolean;
  automacoesGlobais?: AutomacaoBpmView[];
  etapas: EtapaAutomacaoView[];
};

export type CatalogosAutomacao = {
  usuarios: { id: number; nome: string; imagemUrl: string | null }[];
  servicos: { id: number; nome: string }[];
  parceiros: { id: number; nome: string; nomeFantasia: string | null }[];
  pipelines: {
    id: string;
    nome: string;
    campos: { id: string; nome: string; tipo: string; opcoesJson: string | null }[];
  }[];
};

export type HistoricoAutomacaoItem = {
  id: string;
  cardId: string;
  eventoChave: string;
  gatilhoTipo: string;
  status: string;
  tentativas: number;
  mensagemErro: string | null;
  resultadoJson: string | null;
  iniciadoEm: string | null;
  executadoEm: string | null;
  createdAt: string;
};
