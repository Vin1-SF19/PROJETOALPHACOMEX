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
  criadoPor: { id: number; nome: string };
  createdAt: string;
  updatedAt: string;
  ultimaExecucao: {
    id: string;
    status: string;
    mensagemErro: string | null;
    executadoEm: string | null;
    createdAt: string;
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
  etapas: EtapaAutomacaoView[];
};
