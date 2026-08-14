import { describe, expect, it } from "vitest";
import { chaveDeCasamento, mergeCompanyEvent } from "@/lib/commissions/adapters/company-event-merger";
import type { ContratoComercialSource } from "@/lib/commissions/adapters/metas-adapter";
import type { CompanyEventSource } from "@/lib/commissions/adapters/types";

function contratoBase(overrides: Partial<ContratoComercialSource> = {}): ContratoComercialSource {
  return {
    id: "contrato-1",
    clienteId: 501,
    cnpj: "12345678000190",
    razaoSocial: "Alpha Importação e Distribuição Ltda.",
    nomeFantasia: "Alpha Import",
    valorContratoCents: 2_200_000,
    formaPagamento: "A_VISTA_DESCONTO",
    servico: "Revisão de RADAR Ilimitado",
    closerNome: "Sheila",
    usuarioId: 10,
    pagamentoConfirmado: true,
    pagamentoConfirmadoEm: new Date("2026-07-15T00:00:00.000Z"),
    updatedAt: new Date("2026-07-15T00:00:00.000Z"),
    ...overrides,
  };
}

function clienteBase(overrides: Partial<CompanyEventSource> = {}): CompanyEventSource {
  return {
    cnpj: "12345678000190",
    razaoSocial: "Alpha Importação e Distribuição Ltda.",
    nomeFantasia: "Alpha Import",
    servico: "Revisão de RADAR Ilimitado",
    formaPagamento: "A_VISTA_DESCONTO",
    valorContratoCents: 2_200_000,
    closerNome: "Sheila",
    analistaResponsavel: "Maria",
    dataContratacao: new Date("2026-07-15T00:00:00.000Z"),
    dataExito: null,
    embasamento: "150k",
    origemLead: "Indicação",
    dataContratacaoInvalida: false,
    dataExitoInvalida: false,
    ...overrides,
  };
}

describe("chaveDeCasamento", () => {
  it("normaliza CNPJ (remove pontuação) e serviço (case-insensitive)", () => {
    const chave1 = chaveDeCasamento("12.345.678/0001-90", "revisão de radar ilimitado");
    const chave2 = chaveDeCasamento("12345678000190", "REVISÃO DE RADAR ILIMITADO");
    expect(chave1).toBe(chave2);
  });
});

describe("mergeCompanyEvent — decisão confirmada: merge de ContratoComercial + clientes", () => {
  it("campos ausentes em ContratoComercial mas presentes em clientes são herdados (analistaResponsavel, dataExito)", () => {
    const merged = mergeCompanyEvent({
      clienteId: 1,
      contratoComercialId: "contrato-1",
      contrato: contratoBase(),
      cliente: clienteBase({ analistaResponsavel: "Maria", dataExito: new Date("2026-07-20T00:00:00.000Z") }),
    });

    expect(merged.analistaResponsavel).toBe("Maria");
    expect(merged.dataExito).toEqual(new Date("2026-07-20T00:00:00.000Z"));
    expect(merged.conflicts).toHaveLength(0);
  });

  it("ContratoComercial prevalece quando ambas as fontes têm o mesmo campo com valores DIFERENTES — mas gera conflito registrado", () => {
    const merged = mergeCompanyEvent({
      clienteId: 1,
      contratoComercialId: "contrato-1",
      contrato: contratoBase({ closerNome: "Sheila" }),
      cliente: clienteBase({ closerNome: "OutroNome" }),
    });

    expect(merged.closerNome).toBe("Sheila"); // ContratoComercial prevalece
    expect(merged.conflicts).toHaveLength(1);
    expect(merged.conflicts[0].field).toBe("closerNome");
  });

  it("valores IGUAIS entre as fontes não geram conflito", () => {
    const merged = mergeCompanyEvent({
      clienteId: 1,
      contratoComercialId: "contrato-1",
      contrato: contratoBase({ razaoSocial: "Mesma Razão Social" }),
      cliente: clienteBase({ razaoSocial: "Mesma Razão Social" }),
    });

    expect(merged.conflicts).toHaveLength(0);
  });

  it("funciona apenas com ContratoComercial (sem cliente correspondente ainda)", () => {
    const merged = mergeCompanyEvent({
      clienteId: null,
      contratoComercialId: "contrato-1",
      contrato: contratoBase(),
      cliente: null,
    });

    expect(merged.cnpj).toBe("12345678000190");
    expect(merged.analistaResponsavel).toBeNull(); // não existe em ContratoComercial nem há cliente
  });

  it("lança erro se nenhuma das duas fontes existir", () => {
    expect(() =>
      mergeCompanyEvent({ clienteId: null, contratoComercialId: null, contrato: null, cliente: null }),
    ).toThrow();
  });
});
