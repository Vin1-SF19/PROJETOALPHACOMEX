import { describe, expect, it } from "vitest";
import { calcularPaymentSchedule } from "@/lib/commissions/payment-schedule";
import { civilDate, toISODateString } from "@/lib/commissions/calendar-engine";
import { feriadosNacionais } from "@/lib/commissions/holidays-seed";

describe("calcularPaymentSchedule — CLT vs PJ (seções 13-14)", () => {
  const dataEvento = civilDate(2026, 7, 15); // evento em julho/2026

  it("CLT comissão: vencimento = 5º dia útil de agosto/2026 (mês seguinte), junto com o salário", () => {
    const result = calcularPaymentSchedule({
      tipoBeneficio: "COMISSAO",
      vinculo: "CLT",
      dataEvento,
      holidays: feriadosNacionais(2026),
    });
    expect(result.scheduleRuleName).toBe("QUINTO_DIA_UTIL_CLT");
    // Agosto/2026: dia 1 é sábado. 1º útil=03(seg),2º=04,3º=05,4º=06,5º=07 (sem feriado em ago).
    expect(toISODateString(result.contractualDueDate)).toBe("2026-08-07");
    expect(toISODateString(result.operationalSuggestedDate)).toBe("2026-08-07");
  });

  it("CLT DSR: mesma regra da comissão (5º dia útil do mês seguinte)", () => {
    const result = calcularPaymentSchedule({
      tipoBeneficio: "DSR",
      vinculo: "CLT",
      dataEvento,
      holidays: feriadosNacionais(2026),
    });
    expect(result.scheduleRuleName).toBe("QUINTO_DIA_UTIL_CLT");
  });

  it("CLT prêmio: vencimento formal = último dia de agosto/2026; operacional = sexta da semana seguinte ao evento", () => {
    const result = calcularPaymentSchedule({
      tipoBeneficio: "PREMIO",
      vinculo: "CLT",
      dataEvento,
    });
    expect(result.scheduleRuleName).toBe("ULTIMO_DIA_MES_SEGUINTE_PREMIO_CLT");
    expect(toISODateString(result.contractualDueDate)).toBe("2026-08-31");
    // 15/07/2026 é uma quarta-feira; sexta da semana seguinte = 24/07/2026.
    expect(toISODateString(result.operationalSuggestedDate)).toBe("2026-07-24");
  });

  it("PJ: vencimento contratual = último dia do mês seguinte (mesma regra para comissão/prêmio/DSR)", () => {
    const result = calcularPaymentSchedule({
      tipoBeneficio: "COMISSAO",
      vinculo: "PJ",
      dataEvento,
    });
    expect(result.scheduleRuleName).toBe("ULTIMO_DIA_MES_SEGUINTE_PJ");
    expect(toISODateString(result.contractualDueDate)).toBe("2026-08-31");
    expect(toISODateString(result.operationalSuggestedDate)).toBe("2026-07-24");
  });

  it("CLT e PJ geram datas de VENCIMENTO diferentes para o MESMO evento (comissão)", () => {
    const clt = calcularPaymentSchedule({ tipoBeneficio: "COMISSAO", vinculo: "CLT", dataEvento, holidays: feriadosNacionais(2026) });
    const pj = calcularPaymentSchedule({ tipoBeneficio: "COMISSAO", vinculo: "PJ", dataEvento });

    expect(toISODateString(clt.contractualDueDate)).not.toBe(toISODateString(pj.contractualDueDate));
    expect(clt.scheduleRuleName).not.toBe(pj.scheduleRuleName);
  });

  it("virada de ano: evento em dezembro gera vencimento em janeiro do ano seguinte", () => {
    const eventoDezembro = civilDate(2026, 12, 10);
    const result = calcularPaymentSchedule({
      tipoBeneficio: "COMISSAO",
      vinculo: "PJ",
      dataEvento: eventoDezembro,
    });
    expect(toISODateString(result.contractualDueDate).startsWith("2027-01")).toBe(true);
  });
});
