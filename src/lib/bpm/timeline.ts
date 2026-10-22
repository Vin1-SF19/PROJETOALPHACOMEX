import { ehAnotacaoTecnicaInstagram } from "@/lib/bpm/instagram-anotacao-tecnica";

export type OrigemEventoTimeline = "usuario" | "automacao" | "sistema";

export interface EventoHistoricoBruto {
  id: string;
  acao: string;
  createdAt: string | Date;
  valorAnteriorJson?: string | null;
  valorNovoJson?: string | null;
  usuario?: { nome: string } | null;
  automacaoOrigem?: string | null;
}

export interface AnotacaoBruta {
  tipo?: string;
  resumo?: string | null;
  id: string;
  createdAt: string | Date;
  observacoes?: string | null;
  registradoPor: { nome: string };
}

export interface ItemTimelineCard {
  id: string;
  tipo: "evento" | "anotacao";
  data: Date;
  autor: string;
  origem: OrigemEventoTimeline;
  acao?: string;
  label: string;
  texto?: string;
  valorAnterior?: string | null;
  valorNovo?: string | null;
}

const LABELS_EVENTO_TIMELINE: Record<string, string> = {
  ALERTA_AUTOMACAO: "Alerta da automação",
  CARD_CRIADO: "Card criado",
  CARD_CRIADO_POR_AUTOMACAO: "Card criado por automação",
  CARD_CRIADO_POR_OPORTUNIDADE: "Card criado a partir de oportunidade",
  CARD_MOVIDO: "Card movido de etapa",
  CARD_MOVIDO_POR_AUTOMACAO: "Card movido por automação",
  RD_COMPLEMENTO_IMPORTADO: "Dados do RD Station recuperados",
  RD_COMPLEMENTO_REVERTIDO: "Recuperação do RD Station desfeita",
  CARD_ATUALIZADO: "Campo atualizado",
  DADOS_EMPRESA_ATUALIZADOS: "Dados da empresa alterados",
  CONTRATO_DISPONIBILIZADO: "Contrato disponível para envio",
  CONTRATO_ENVIO_REGISTRADO: "Envio do contrato registrado",
  PAGAMENTO_ENCAMINHADO_CONFERENCIA: "Pagamento encaminhado para conferência",
  MEMBROS_ATUALIZADOS: "Membros atualizados",
  TAREFA_CRIADA: "Tarefa criada",
  TAREFA_CONCLUIDA: "Tarefa concluída",
  TAREFA_CHECKLIST_CRIADA: "Tarefa de procedimento criada",
  TAREFA_CHECKLIST_ATUALIZADA: "Tarefa de procedimento atualizada",
  TAREFA_CHECKLIST_REABERTA: "Tarefa de procedimento reaberta",
  TAREFA_CHECKLIST_CONCLUIDA: "Tarefa de procedimento concluída",
  TAREFA_ALERTA_DISPARADO: "Alerta de tarefa disparado",
  PRESET_APLICADO: "Preset de tarefas aplicado",
  ANEXO_ADICIONADO: "Anexo adicionado",
  ANEXO_EXCLUIDO: "Anexo excluído",
  ANOTACAO_AUTOMACAO: "Anotação da automação",
  ANOTACAO_REGISTRADA: "Anotação registrada",
  REUNIAO_AGENDADA: "Reunião agendada",
  REUNIAO_REAGENDADA: "Reunião reagendada",
  RESUMO_REUNIAO_EDITADO: "Resumo da reunião editado",
  CHECKLIST_MATERIALIZADO: "Procedimento aplicado ao card",
  CHECKLIST_ATUALIZADO_DISPONIBILIZADO: "Checklist atualizado disponível",
  CHECKLIST_ATUALIZADO_REMOVIDO: "Checklist atualizado removido",
  CHECKLIST_STATUS_ALTERADO: "Item de procedimento atualizado",
  CHECKLIST_ITEM_ATUALIZADO: "Item de procedimento atualizado",
  CHECKLIST_ITEM_EXCLUSIVO_ADICIONADO: "Item de procedimento adicionado",
  AUTOMACAO_EXECUTADA: "Automação executada",
  AUTOMACAO_CENTRAL_EXECUTADA: "Automação central executada",
  AUTOMACAO_DISPAROU_CARD: "Automação criou um card",
  AUTOMACAO_REPROCESSADA: "Automação enviada para reprocessamento",
  AUTOMACAO_TAREFA_NF: "Tarefa de nota fiscal criada automaticamente",
  NOTA_FISCAL_EMITIDA: "Nota fiscal emitida",
  NOTA_FISCAL_ATUALIZADA: "Nota fiscal atualizada",
  NOTA_FISCAL_PENDENTE: "Nota fiscal pendente",
  TAREFA_NF_REABERTA: "Tarefa de nota fiscal reaberta",
  DISTRIBUICAO_AUTOMATICA: "Distribuição automática de responsável",
  VINCULO_CRIADO: "Vínculo entre cards criado",
  OPORTUNIDADE_IDENTIFICADA: "Oportunidade identificada",
  COMUNICACAO_PENDENTE: "Comunicação aguardando envio",
  CADENCIA_INICIADA: "Cadência iniciada",
  CADENCIA_PAUSADA: "Cadência pausada",
  CADENCIA_REATIVADA: "Cadência reativada",
  CADENCIA_CONCLUIDA: "Cadência concluída",
  CADENCIA_CANCELADA: "Cadência cancelada",
  CADENCIA_PASSO_EXECUTADO: "Passo de cadência executado",
  STANDBY_FOLLOW_UP_EXECUTADO: "Follow-up de standby executado",
  STANDBY_FOLLOW_UP_INTERROMPIDO: "Follow-up de standby interrompido",
  FOLLOW_UP_INICIADO: "Follow-up iniciado",
  FOLLOW_UP_ATUALIZADO: "Follow-up atualizado",
  FOLLOW_UP_CONCLUIDO: "Follow-up concluído",
  FOLLOW_UP_CRIADO_E_CONCLUIDO: "Follow-up registrado e concluído",
  INTERACAO_REGISTRADA: "Interação registrada",
  MONITORAMENTO_AUTOMATICO_EXECUTADO: "Monitoramento automático executado",
  MOVIDO_AUTOMACAO: "Card movido por automação",
  NOVOS_LEADS_LIGACOES_PLANEJADAS: "Ligações planejadas",
  SUBSTATUS_ALTERADO: "Substatus alterado",
  TRANSCRICAO_REUNIAO_ATUALIZADA: "Transcrição da reunião atualizada",
  TRANSCRICAO_REUNIAO_RECEBIDA: "Transcrição da reunião recebida",
  ENVIAR_EMAIL: "E-mail enviado por automação",
};

export function rotuloEventoTimeline(acao: string): string {
  const conhecido = LABELS_EVENTO_TIMELINE[acao];
  if (conhecido) return conhecido;
  const legivel = acao.replaceAll("_", " ").toLowerCase();
  return legivel.charAt(0).toUpperCase() + legivel.slice(1);
}

function origemDoEvento(
  automacaoOrigem: string | null | undefined,
  usuario: { nome: string } | null | undefined,
): OrigemEventoTimeline {
  if (automacaoOrigem) return "automacao";
  if (usuario) return "usuario";
  return "sistema";
}

/** Nome registrado no momento da edição, mesmo se o usuário mudar de nome depois. */
export function autorEventoHistorico(evento: Pick<EventoHistoricoBruto, "acao" | "valorNovoJson" | "usuario">): string | null {
  if (evento.acao === "DADOS_EMPRESA_ATUALIZADOS") try {
    const autor = (JSON.parse(evento.valorNovoJson ?? "{}") as { autor?: unknown }).autor;
    if (typeof autor === "string" && autor.trim()) return autor;
  } catch { /* Eventos legados usam o relacionamento do usuário. */ }
  return evento.usuario?.nome ?? null;
}

/** Agrega histórico + anotações já carregados (sem nova leitura ao banco) em um feed cronológico único. */
export function montarFeedTimelineCard(
  historico: EventoHistoricoBruto[],
  anotacoes: AnotacaoBruta[],
): ItemTimelineCard[] {
  const eventos: ItemTimelineCard[] = historico
    // Anotações já entram no feed com o texto completo via `anotacoes`; duplicaria o mesmo evento.
    .filter((h) => h.acao !== "ANOTACAO_REGISTRADA")
    .map((h) => ({
      id: h.id,
      tipo: "evento",
      data: new Date(h.createdAt),
      autor: autorEventoHistorico(h) ?? (h.automacaoOrigem && !["RD_STATION_SERVICE_RECOVERY", "RD_STATION_SERVICE_ROLLBACK"].includes(h.automacaoOrigem) ? `Automação (${h.automacaoOrigem})` : "Sistema"),
      origem: origemDoEvento(h.automacaoOrigem, h.usuario),
      acao: h.acao,
      label: rotuloEventoTimeline(h.acao),
      valorAnterior: h.valorAnteriorJson ?? null,
      valorNovo: h.valorNovoJson ?? null,
    }));

  const notas: ItemTimelineCard[] = anotacoes.filter((a) => !ehAnotacaoTecnicaInstagram(a)).map((a) => ({
    id: a.id,
    tipo: "anotacao",
    data: new Date(a.createdAt),
    autor: a.registradoPor.nome,
    origem: "usuario",
    label: "Anotação registrada",
    texto: a.observacoes ?? "",
  }));

  return [...eventos, ...notas].sort((a, b) => b.data.getTime() - a.data.getTime());
}
