import { describe, expect, it } from "vitest";

import { autorizarCron } from "@/lib/bpm/cron-auth";
import {
  calcularDiaCicloNovosLeads,
  cicloNovosLeadsVencido,
  contarDiasUteisDecorridos,
  intervaloDiaCivilSaoPaulo,
} from "@/lib/bpm/novos-leads";
import {
  deduplicarCamposObrigatorios,
  listarCamposObrigatoriosFaltantes,
} from "@/lib/bpm/requisitos-etapa";

describe("requisitos de Novos leads", () => {
  const campos = [
    { id: "campo_nome", nome: "Nome do responsável" },
    { id: "campo_cnpj", nome: "CNPJ" },
    { id: "campo_cnpj", nome: "CNPJ duplicado pela junção" },
  ];

  it("deduplica requisitos diretos e ligados pela etapa", () => {
    expect(deduplicarCamposObrigatorios(campos)).toEqual([
      { id: "campo_nome", nome: "Nome do responsável" },
      { id: "campo_cnpj", nome: "CNPJ duplicado pela junção" },
    ]);
  });

  it("considera ausente valor vazio ou composto por espaços", () => {
    const faltantes = listarCamposObrigatoriosFaltantes(campos, {
      campo_nome: "  ",
      campo_cnpj: "12.345.678/0001-90",
    });
    expect(faltantes.map((campo) => campo.id)).toEqual(["campo_nome"]);
  });
});

describe("cadência de oito dias úteis", () => {
  const criadoNaSegunda = new Date("2026-08-03T13:00:00.000Z");

  it("ignora sábado e domingo e vence no oitavo dia útil decorrido", () => {
    const setimoDia = new Date("2026-08-12T12:00:00.000Z");
    const oitavoDia = new Date("2026-08-13T12:00:00.000Z");

    expect(contarDiasUteisDecorridos(criadoNaSegunda, setimoDia)).toBe(7);
    expect(cicloNovosLeadsVencido(criadoNaSegunda, setimoDia)).toBe(false);
    expect(contarDiasUteisDecorridos(criadoNaSegunda, oitavoDia)).toBe(8);
    expect(cicloNovosLeadsVencido(criadoNaSegunda, oitavoDia)).toBe(true);
  });

  it("expõe o dia visual limitado ao ciclo de oito dias", () => {
    expect(calcularDiaCicloNovosLeads(criadoNaSegunda, criadoNaSegunda)).toBe(1);
    expect(calcularDiaCicloNovosLeads(criadoNaSegunda, new Date("2026-08-20T12:00:00.000Z"))).toBe(8);
  });

  it("calcula a janela diária pelo dia civil de São Paulo", () => {
    const intervalo = intervaloDiaCivilSaoPaulo(new Date("2026-08-12T15:00:00.000Z"));
    expect(intervalo.inicio.toISOString()).toBe("2026-08-12T03:00:00.000Z");
    expect(intervalo.fim.toISOString()).toBe("2026-08-13T03:00:00.000Z");
  });
});

describe("autorização do cron", () => {
  it("aceita somente bearer com o segredo exato", () => {
    expect(autorizarCron("Bearer segredo-forte", "segredo-forte")).toBe(true);
    expect(autorizarCron("Bearer segredo-errado", "segredo-forte")).toBe(false);
    expect(autorizarCron(null, "segredo-forte")).toBe(false);
    expect(autorizarCron("Bearer segredo-forte", undefined)).toBe(false);
  });
});

