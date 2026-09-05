import type { GrupoCondicao, ResultadoRegra } from "@/lib/bpm/regras/types";

export type PipelineRegraView = {
  id: string;
  nome: string;
  etapas: { id: string; nome: string }[];
};

export type RegraBpmView = {
  id: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
  prioridade: number;
  pipelineId: string | null;
  pipelineNome: string | null;
  etapasIds: string[];
  versaoAtual: number;
  criadoPor: { id: number; nome: string } | null;
  createdAt: string;
  updatedAt: string;
  condicao: GrupoCondicao | null;
  resultado: ResultadoRegra | null;
};
