import {
  civilDate,
  mesSeguinte,
  quintoDiaUtil,
  sextaFeiraDaSemanaSeguinte,
  toCivilParts,
  ultimaSextaFeira,
  ultimoDiaCivil,
} from "./calendar-engine";
import type { HolidayRecord } from "./calendar-engine";
import type { Vinculo } from "./vinculo-resolver";

/**
 * Calendário de pagamento (seções 13-14 do prompt original).
 *
 * CLT — comissão/DSR: 5º dia útil do mês seguinte, junto com o salário.
 * CLT — prêmio: vencimento formal até o último dia do mês seguinte; data operacional
 *   sugerida na sexta-feira da semana seguinte (à data do evento, NÃO ao vencimento).
 * PJ — sempre: vencimento contratual último dia do mês seguinte; data operacional sugerida
 *   sexta-feira da semana seguinte. Nunca confundir antecipação operacional com vencimento
 *   contratual (o prompt é explícito sobre isso).
 */

export type TipoBeneficio = "COMISSAO" | "DSR" | "PREMIO";

export interface PaymentScheduleResult {
  contractualDueDate: Date;
  operationalSuggestedDate: Date;
  scheduleRuleName: string;
}

export function calcularPaymentSchedule(params: {
  tipoBeneficio: TipoBeneficio;
  vinculo: Vinculo;
  dataEvento: Date;
  holidays?: HolidayRecord[];
}): PaymentScheduleResult {
  const { tipoBeneficio, vinculo, dataEvento, holidays = [] } = params;
  const { year, month } = toCivilParts(dataEvento);
  const proximoMes = mesSeguinte(year, month);

  // PJ: sempre vencimento contratual = último dia do mês seguinte; operacional = sexta da semana seguinte.
  if (vinculo === "PJ") {
    return {
      contractualDueDate: ultimoDiaCivil(proximoMes.year, proximoMes.month),
      operationalSuggestedDate: sextaFeiraDaSemanaSeguinte(dataEvento),
      scheduleRuleName: "ULTIMO_DIA_MES_SEGUINTE_PJ",
    };
  }

  // CLT — comissão ou DSR: 5º dia útil do mês seguinte, junto com o salário.
  if (tipoBeneficio === "COMISSAO" || tipoBeneficio === "DSR") {
    const quinto = quintoDiaUtil(proximoMes.year, proximoMes.month, holidays);
    return {
      contractualDueDate: quinto,
      operationalSuggestedDate: quinto,
      scheduleRuleName: "QUINTO_DIA_UTIL_CLT",
    };
  }

  // CLT — prêmio: vencimento formal até o último dia do mês seguinte; operacional = sexta seguinte.
  return {
    contractualDueDate: ultimoDiaCivil(proximoMes.year, proximoMes.month),
    operationalSuggestedDate: sextaFeiraDaSemanaSeguinte(dataEvento),
    scheduleRuleName: "ULTIMO_DIA_MES_SEGUINTE_PREMIO_CLT",
  };
}

export { ultimaSextaFeira, civilDate };
