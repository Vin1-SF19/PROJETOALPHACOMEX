import { describe, expect, it } from "vitest";
import { campoEhMesProtocolar, MESES_PROTOCOLAR, normalizarMesProtocolar } from "@/lib/bpm/mes-protocolar";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";

describe("mês de protocolo do CRM", () => {
  it.each(MESES_PROTOCOLAR)("aceita o mês %s sem inventar dia ou ano", (mes) => {
    expect(normalizarMesProtocolar(mes)).toBe(mes);
  });

  it.each([
    ["2026-10-31", "Outubro"], ["31/10/2026", "Outubro"], ["10/2026", "Outubro"],
    ["2026-03", "Março"], ["03", "Março"], ["  MARCO  ", "Março"],
    ["2026-03-01T00:00:00.000Z", "Março"], ["2026-12-31T23:00:00-03:00", "Dezembro"],
  ])("projeta legado %s como %s sem depender de fuso", (valor, esperado) => {
    expect(normalizarMesProtocolar(valor)).toBe(esperado);
  });

  it.each(["", "13", "0", "2026-13", "31/02/2026", "2026-02-30", "próximo mês", "2026-03-01garbage"])(
    "não adivinha um mês para %s", (valor) => expect(normalizarMesProtocolar(valor)).toBeNull(),
  );

  it("reconhece chaves renomeadas e aliases exatos, sem alterar outros campos", () => {
    expect(campoEhMesProtocolar({ chave: "alpha.radar.viabilidade.mes_protocolar", nome: "Previsão" })).toBe(true);
    expect(campoEhMesProtocolar({ chave: "alpha.mes.de.protocolo", nome: "Previsão" })).toBe(true);
    expect(campoEhMesProtocolar({ nome: "  MÊS   PARA PROTOCOLAR " })).toBe(true);
    expect(campoEhMesProtocolar({ nome: "Mes de protocolo" })).toBe(true);
    for (const nome of ["Data de protocolo", "Mês de pagamento", "Mês para protocolar anterior"]) {
      expect(campoEhMesProtocolar({ nome })).toBe(false);
    }
  });

  it.each(["data", "texto", "selecao"])("valida e canonicaliza apenas o campo de mês configurado como %s", (tipo) => {
    const campo = { id: "mes", nome: "Mês para protocolar", tipo, opcoesJson: null };
    expect(validarValoresCamposBpm([campo], { mes: "Março" })).toEqual({ success: true, valores: { mes: "Março" } });
    expect(validarValoresCamposBpm([campo], { mes: "2026-10-31" })).toEqual({ success: true, valores: { mes: "Outubro" } });
    expect(validarValoresCamposBpm([campo], { mes: "13" })).toEqual({ success: false, error: expect.stringContaining("Selecione um mês válido") });
    expect(validarValoresCamposBpm([campo], { mes: "" })).toEqual({ success: true, valores: { mes: "" } });
    expect(validarValoresCamposBpm([{ ...campo, somenteLeitura: true }], { mes: "Março" }).success).toBe(false);
  });

  it("não relaxa validação de datas comuns nem converte um campo não submetido", () => {
    const campos = [
      { id: "mes", nome: "Mês para protocolar", tipo: "data", opcoesJson: null },
      { id: "data", nome: "Data de protocolo", tipo: "data", opcoesJson: null },
    ];
    expect(validarValoresCamposBpm(campos, { data: "2026-10-31" })).toEqual({ success: true, valores: { data: "2026-10-31" } });
    expect(validarValoresCamposBpm(campos, { data: "Outubro" }).success).toBe(false);
    expect(validarValoresCamposBpm(campos, { data: "2026-02-30" }).success).toBe(false);
  });
});
