import { describe, expect, it } from "vitest";
import { resolverEligibilityOverride } from "@/lib/commissions/eligibility-filter";
import type { EligibilityOverrideRecord } from "@/lib/commissions/eligibility-filter";

function override(overrides: Partial<EligibilityOverrideRecord> = {}): EligibilityOverrideRecord {
  return {
    id: "override-1",
    collaboratorId: null,
    cargoId: null,
    clienteId: null,
    contratoComercialId: null,
    servico: null,
    eventType: null,
    dataInicial: null,
    dataFinal: null,
    tipo: "BLOQUEIO",
    percentualEspecifico: null,
    valorEspecificoCents: null,
    justificativa: "Teste",
    prioridade: 0,
    approvalRequired: false,
    aprovadoEm: null,
    ...overrides,
  };
}

const queryBase = {
  collaboratorId: 42,
  cargoId: 5,
  clienteId: 1,
  contratoComercialId: "contrato-1",
  servico: "Revisão de RADAR Ilimitado",
  eventType: "CONTRACTING",
  dataEvento: new Date("2026-07-28T00:00:00.000Z"),
};

describe("resolverEligibilityOverride", () => {
  it("bloqueio para o colaborador específico impede o lançamento", () => {
    const o = override({ collaboratorId: 42, tipo: "BLOQUEIO" });
    const decisao = resolverEligibilityOverride([o], queryBase);
    expect(decisao?.action).toBe("BLOQUEAR");
  });

  it("bloqueio vence mesmo com override de valor específico mais específico presente", () => {
    const bloqueio = override({ id: "b", collaboratorId: 42, tipo: "BLOQUEIO" });
    const valor = override({ id: "v", contratoComercialId: "contrato-1", tipo: "VALOR_ESPECIFICO", valorEspecificoCents: 5000 });
    const decisao = resolverEligibilityOverride([bloqueio, valor], queryBase);
    expect(decisao?.action).toBe("BLOQUEAR");
  });

  it("override de valor específico substitui o cálculo normal", () => {
    const o = override({ collaboratorId: 42, tipo: "VALOR_ESPECIFICO", valorEspecificoCents: 12_345 });
    const decisao = resolverEligibilityOverride([o], queryBase);
    expect(decisao).toEqual({ action: "SUBSTITUIR_VALOR", override: o, valorCents: 12_345 });
  });

  it("override que exige aprovação e ainda não foi aprovado retorna AGUARDANDO_APROVACAO", () => {
    const o = override({ collaboratorId: 42, tipo: "VALOR_ESPECIFICO", valorEspecificoCents: 12_345, approvalRequired: true, aprovadoEm: null });
    const decisao = resolverEligibilityOverride([o], queryBase);
    expect(decisao?.action).toBe("AGUARDANDO_APROVACAO");
  });

  it("override que exige aprovação e JÁ foi aprovado aplica normalmente", () => {
    const o = override({
      collaboratorId: 42,
      tipo: "VALOR_ESPECIFICO",
      valorEspecificoCents: 12_345,
      approvalRequired: true,
      aprovadoEm: new Date("2026-07-01T00:00:00.000Z"),
    });
    const decisao = resolverEligibilityOverride([o], queryBase);
    expect(decisao?.action).toBe("SUBSTITUIR_VALOR");
  });

  it("override fora de vigência (dataFinal no passado) não é aplicado", () => {
    const o = override({
      collaboratorId: 42,
      tipo: "BLOQUEIO",
      dataInicial: new Date("2026-01-01T00:00:00.000Z"),
      dataFinal: new Date("2026-03-01T00:00:00.000Z"),
    });
    const decisao = resolverEligibilityOverride([o], queryBase);
    expect(decisao).toBeNull();
  });

  it("nenhum override casa com a query → null (segue para o motor de regras normal)", () => {
    const o = override({ collaboratorId: 999, tipo: "BLOQUEIO" });
    const decisao = resolverEligibilityOverride([o], queryBase);
    expect(decisao).toBeNull();
  });

  it("override de contrato vence sobre override de cargo (especificidade)", () => {
    const doContrato = override({ id: "c", contratoComercialId: "contrato-1", tipo: "VALOR_ESPECIFICO", valorEspecificoCents: 1000 });
    const doCargo = override({ id: "cg", cargoId: 5, tipo: "VALOR_ESPECIFICO", valorEspecificoCents: 2000 });
    const decisao = resolverEligibilityOverride([doCargo, doContrato], queryBase);
    expect(decisao?.action).toBe("SUBSTITUIR_VALOR");
    if (decisao?.action === "SUBSTITUIR_VALOR") {
      expect(decisao.valorCents).toBe(1000);
    }
  });
});
