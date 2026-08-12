import {
  adicionarDias,
  formatarDataCivil,
  inicioDoDia,
  parsearDataCivil,
} from "@/components/CalendarioAlpha/lib/datas";

export const NOME_ETAPA_NOVOS_LEADS = "Novos leads";
export const NOME_ETAPA_STANDBY = "Standby - Follow Up";
export const META_LIGACOES_NOVOS_LEADS = 5;
export const TOTAL_DIAS_UTEIS_CICLO_NOVOS_LEADS = 8;
export const AUTOMACAO_ORIGEM_NOVOS_LEADS = "novos_leads_8_dias_uteis";

export function normalizarNomeEtapa(nome: string): string {
  return nome.trim().toLocaleLowerCase("pt-BR");
}

export function etapaEhNovosLeads(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_ETAPA_NOVOS_LEADS);
}

export function intervaloDiaCivilSaoPaulo(agora = new Date()): {
  inicio: Date;
  fim: Date;
} {
  const inicio = inicioDoDia(agora);
  return { inicio, fim: adicionarDias(inicio, 1) };
}

function ehDiaUtil(data: Date): boolean {
  const dataCivil = formatarDataCivil(data);
  const pseudoUtc = new Date(`${dataCivil}T00:00:00.000Z`);
  const diaDaSemana = pseudoUtc.getUTCDay();
  return diaDaSemana >= 1 && diaDaSemana <= 5;
}

/**
 * Conta dias úteis civis completos desde a criação, excluindo o dia inicial.
 * Assim, um lead criado na segunda completa o 8º dia útil na quinta da semana seguinte.
 */
export function contarDiasUteisDecorridos(inicio: Date, fim = new Date()): number {
  const inicioCivil = parsearDataCivil(formatarDataCivil(inicio));
  const fimCivil = parsearDataCivil(formatarDataCivil(fim));
  if (!inicioCivil || !fimCivil || fimCivil <= inicioCivil) return 0;

  let total = 0;
  for (
    let cursor = adicionarDias(inicioCivil, 1);
    cursor <= fimCivil;
    cursor = adicionarDias(cursor, 1)
  ) {
    if (ehDiaUtil(cursor)) total += 1;
  }
  return total;
}

export function calcularDiaCicloNovosLeads(inicio: Date, fim = new Date()): number {
  return Math.min(
    TOTAL_DIAS_UTEIS_CICLO_NOVOS_LEADS,
    contarDiasUteisDecorridos(inicio, fim) + 1,
  );
}

export function cicloNovosLeadsVencido(inicio: Date, fim = new Date()): boolean {
  return contarDiasUteisDecorridos(inicio, fim) >= TOTAL_DIAS_UTEIS_CICLO_NOVOS_LEADS;
}

