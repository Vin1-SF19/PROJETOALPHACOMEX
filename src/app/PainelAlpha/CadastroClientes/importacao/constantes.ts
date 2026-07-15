import type { TipoImportacao } from "@/lib/cs-nps/importacao-tipos";

export const OPCOES_IMPORTACAO: ReadonlyArray<{
  tipo: TipoImportacao;
  titulo: string;
  descricao: string;
}> = [
  {
    tipo: "socios",
    titulo: "Sócios",
    descricao: "Uma linha por sócio. Repita a empresa para importar vários sócios.",
  },
  {
    tipo: "cs",
    titulo: "CS",
    descricao: "Histórico de atendimentos, sentimento, responsável e observação.",
  },
  {
    tipo: "feedbacks",
    titulo: "Feedbacks",
    descricao: "Feedbacks vinculados à empresa e ao serviço correto.",
  },
];

export const ROTULOS_TIPO: Record<TipoImportacao, string> = {
  socios: "Sócios",
  cs: "CS",
  feedbacks: "Feedbacks",
};

export const ROTULOS_SENTIMENTO = {
  pos: "Positivo",
  neg: "Negativo",
  na: "Neutro / não se aplica",
} as const;

