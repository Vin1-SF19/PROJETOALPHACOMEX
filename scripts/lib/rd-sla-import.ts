export const SLA_TARGETS: Record<string, readonly [string, string]> = {
  'Contratados stand-by': ['Operacional', 'Boas vindas'],
  'Contratos Stand-by': ['Operacional', 'Boas vindas'],
  'Envio do checklist e boas vindas': ['Operacional', 'Boas vindas'],
  'Documentação em análise': ['Operacional', 'Documentação em análise'],
  'CLIENTES CANCELADOS': ['Operacional', 'Cliente cancelado'],
  'Elaborar contrato': ['Financeiro', 'Elaboração de Contrato'],
  'Pagamento confirmado': ['Financeiro', 'Confirmação de Pagamento'],
  'Enviar NF - Contratação': ['Financeiro', 'Emissão de Nota Fiscal'],
  'Enviar NF - êxito': ['Financeiro', 'Emissão de Nota Fiscal'],
  'Processos para revisão': ['Operacional', 'Revisão'],
  'Processos revisado para protocolo': ['Operacional', 'Revisado'],
  'Revisão do protocolo feito': ['Operacional', 'Revisão do protocolo'],
  'Aguardando despacho': ['Operacional', 'Aguardando despacho'],
};
export function isoDate(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(typeof value === 'string' ? value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/, '$1T$2Z') : value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function originalEntry(input: {
  etapaId: string; createdAt: unknown; now: string;
  moves: { etapaDestinoId: string; at: unknown }[];
  origin?: { sourceStageId: string; rawJson: string; targetStageId: string };
}): { date: string; source: string } | null {
  const now = isoDate(input.now);
  if (!now) return null;
  const moves = input.moves.map(m => ({ ...m, date: isoDate(m.at) }));
  // Um movimento com data desconhecida impede provar qual foi a última entrada.
  if (moves.some(m => !m.date)) return null;
  moves.sort((a, b) => b.date!.localeCompare(a.date!));
  if (moves.length) {
    const latest = moves[0];
    if (moves.some(m => m.date === latest.date && m.etapaDestinoId !== latest.etapaDestinoId)) return null;
    return latest.etapaDestinoId === input.etapaId && latest.date! <= now ? { date: latest.date!, source: 'MOVIMENTO_ALPHA' } : null;
  }
  if (input.origin) {
    if (input.origin.targetStageId !== input.etapaId) return null;
    const raw = JSON.parse(input.origin.rawJson);
    const dates = (raw.deal_stage_histories ?? []).filter((h: { deal_stage_id: string; end_date?: string }) => h.deal_stage_id === input.origin!.sourceStageId && !h.end_date)
      .map((h: { start_date: unknown }) => isoDate(h.start_date));
    // Não ocultar uma entrada inválida/futura escolhendo outra mais antiga.
    if (dates.some((date: string | null) => date === null || date > now)) return null;
    dates.sort();
    return dates.length ? { date: dates[dates.length - 1], source: 'HISTORICO_RD' } : null;
  }
  const date = isoDate(input.createdAt);
  return date && date <= now ? { date, source: 'CRIACAO_ALPHA_SEM_MOVIMENTOS' } : null;
}
export function initialSla(date: string, days: number, now: string) {
  if (!Number.isInteger(days) || days < 1 || !isoDate(date) || !isoDate(now)) throw Error('Prazo inválido');
  const deadline = new Date(Date.parse(date) + days * 86_400_000).toISOString();
  const late = Date.parse(now) > Date.parse(deadline);
  return { inicioContagem: date, prazoFinal: deadline, deadline, status: late ? 'ATRASADO' : 'DENTRO_PRAZO', vencidoEm: late ? deadline : null };
}
