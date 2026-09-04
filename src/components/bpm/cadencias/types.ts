export type PassoCadenciaView = {
  id: string;
  ordem: number;
  intervaloDias: number;
  tipoTarefa: string;
  titulo: string;
  descricao: string | null;
  prazoRelativoDias: number | null;
  alertaAntecedenciaHoras: number | null;
  prioridade: string;
  ativo: boolean;
};

export type CadenciaView = {
  id: string;
  nome: string;
  descricao: string | null;
  pipelineId: string | null;
  etapaId: string | null;
  ativa: boolean;
  passos: PassoCadenciaView[];
  _count?: { vinculos: number };
};

export type PipelineCadenciaView = {
  id: string;
  nome: string;
  etapas: { id: string; nome: string }[];
};
