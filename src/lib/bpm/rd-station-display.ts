export function periodoOriginalRd(raw: Record<string, unknown>) {
  const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
  return { entrada: date(raw.start_date), saida: date(raw.end_date) };
}

/** Auditoria operacional fica no banco; a timeline mostra apenas o serviço. */
export function apresentarAjusteServicoRd(origem: string | null, valorNovoJson: string | null) {
  if (origem === "RD_STATION_COMPLEMENT_RECOVERY" || origem === "RD_STATION_COMPLEMENT_ROLLBACK") {
    let descricao: unknown;
    try { descricao = JSON.parse(valorNovoJson ?? "null")?.descricao; } catch { /* descrição opcional */ }
    return { title: origem.endsWith("ROLLBACK") ? "Recuperação do RD Station desfeita" : "Dados do RD Station recuperados", description: typeof descricao === "string" ? textoLegivelRd(descricao) : "Dados importados do RD Station atualizados.", actor: "Sistema", metadata: { origem: "rd-station" } };
  }
  if (origem !== "RD_STATION_SERVICE_RECOVERY" && origem !== "RD_STATION_SERVICE_ROLLBACK") return null;
  let servico: unknown;
  try { servico = JSON.parse(valorNovoJson ?? "null")?.servico; } catch { /* Registro incompleto: usar descrição neutra. */ }
  const revertido = origem === "RD_STATION_SERVICE_ROLLBACK";
  return {
    title: revertido ? "Ajuste do serviço desfeito" : "Serviço identificado no RD Station",
    description: typeof servico === "string" && servico.trim() ? textoLegivelRd(servico) : revertido ? "Serviço voltou a ficar sem definição." : "Serviço atualizado a partir do histórico do negócio.",
    actor: "Sistema",
    metadata: { origem: "rd-station" },
  };
}

export function ajustesLegiveisRd(antes: Record<string, unknown>, depois: Record<string, unknown>) {
  const labels: Record<string, string> = { title: "Título", content: "Observação", date: "Data", sourceStageName: "Nome da etapa" };
  return Object.entries(labels).filter(([key]) => antes[key] !== depois[key]).map(([key, label]) => ({
    campo: label, data: key === "date", antes: typeof antes[key] === "string" ? textoLegivelRd(antes[key] as string) : "", depois: typeof depois[key] === "string" ? textoLegivelRd(depois[key] as string) : "",
  }));
}

export function apresentarEventoRd(evento: { tipo: string; data: string | null; projecao: Record<string, unknown> }) {
  const p = evento.projecao;
  const etapa = evento.tipo === "DEAL_STAGE_HISTORY";
  const anotacao = p.type === "ANOTACAO" || evento.tipo === "ACTIVITY_NOTE";
  const tarefa = evento.tipo === "TASK_RD";
  const titulo = typeof p.title === "string" && p.title.trim() ? p.title : etapa ? String(p.sourceStageName || "Movimentação de etapa RD") : anotacao ? "Anotação" : tarefa ? "Tarefa" : "Atividade RD Station";
  // Uma data removida por correção deve continuar ausente, sem voltar à data original.
  const data = typeof p.date === "string" ? p.date : p.date === null ? "" : evento.data ?? "";
  return { titulo: textoLegivelRd(titulo), conteudo: typeof p.content === "string" ? textoLegivelRd(p.content) : "", data, tipo: etapa ? "Movimentação de etapa" : anotacao ? "Anotação" : tarefa ? "Tarefa" : "Atividade", autor: typeof p.authorName === "string" && p.authorName ? textoLegivelRd(p.authorName) : null, situacao: tarefa ? p.status === "CONCLUIDA" ? "Concluída" : "Pendente" : null, prazo: tarefa && typeof p.dueDate === "string" ? p.dueDate : null, etapaIndisponivel: etapa && !p.sourceStageName };
}

export function ordenarHistoricoRd<T extends { id: string; tipo: string; data: string | null; projecao: Record<string, unknown> }>(eventos: T[]): T[] {
  return [...eventos].sort((a, b) => {
    const da = Date.parse(apresentarEventoRd(a).data);
    const db = Date.parse(apresentarEventoRd(b).data);
    return (Number.isFinite(da) ? da : Infinity) - (Number.isFinite(db) ? db : Infinity) || a.id.localeCompare(b.id);
  });
}

/** Une fontes para a aba Histórico; datas ausentes ficam ao final, sem inventar timestamps. */
export function combinarHistoricosRd<A extends { id: string; data: Date }, R extends { id: string; tipo: string; data: string | null; projecao: Record<string, unknown> }>(alpha: A[], rd: R[]) {
  const items = [
    ...alpha.map((item) => ({ origem: "alpha" as const, item, timestamp: item.data.getTime() })),
    ...rd.map((item) => ({ origem: "rd" as const, item, timestamp: Date.parse(apresentarEventoRd(item).data) })),
  ];
  return items.sort((a, b) => (Number.isFinite(b.timestamp) ? b.timestamp : -Infinity) - (Number.isFinite(a.timestamp) ? a.timestamp : -Infinity) || a.item.id.localeCompare(b.item.id));
}
import { textoLegivelRd } from "@/lib/bpm/rd-station-text";
