export const BPM_TAREFA_TIPOS = [
  "CHECKLIST",
  "LIGACAO",
  "WHATSAPP",
  "EMAIL",
  "TAREFA",
  "LEMBRETE_RAPIDO",
] as const;

export type BpmTarefaTipo = (typeof BPM_TAREFA_TIPOS)[number];

export const BPM_TAREFA_TIPO_CONFIG: Record<BpmTarefaTipo, { label: string; descricao: string }> = {
  CHECKLIST: { label: "Checklist", descricao: "Itens a conferir antes do prazo." },
  LIGACAO: { label: "Ligação", descricao: "Contato telefônico programado." },
  WHATSAPP: { label: "WhatsApp", descricao: "Mensagem a enviar para o contato." },
  EMAIL: { label: "E-mail", descricao: "E-mail a redigir e enviar." },
  TAREFA: { label: "Tarefa", descricao: "Atividade operacional geral." },
  LEMBRETE_RAPIDO: { label: "Lembrete rápido", descricao: "Lembrete curto e objetivo." },
};

export function tipoTarefaEhValido(tipo: string): tipo is BpmTarefaTipo {
  return (BPM_TAREFA_TIPOS as readonly string[]).includes(tipo);
}

export function obterConfigTipoTarefa(tipo: string | null | undefined) {
  return tipo && tipoTarefaEhValido(tipo) ? BPM_TAREFA_TIPO_CONFIG[tipo] : BPM_TAREFA_TIPO_CONFIG.TAREFA;
}
