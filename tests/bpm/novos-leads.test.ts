import { describe, expect, it } from "vitest";

import { autorizarCron } from "@/lib/bpm/cron-auth";
import {
  calcularDiaCicloNovosLeads,
  calcularLigacoesPendentesNoDia,
  cicloNovosLeadsVencido,
  cicloDeTentativasNovosLeadsConcluido,
  contarDiasUteisDecorridos,
  datasUteisCicloNovosLeads,
  oitoTentativasDiariasRegistradas,
  ehDiaUtilNovosLeads,
  etapaEhNovosLeads,
  etapaEhStandbyFollowUp,
  intervaloDiaCivilSaoPaulo,
} from "@/lib/bpm/novos-leads";
import {
  deduplicarCamposObrigatorios,
  listarCamposObrigatoriosFaltantes,
} from "@/lib/bpm/requisitos-etapa";

describe("requisitos de Novos leads", () => {
  it("reconhece a etapa inicial recriada como Novo Lead sem aceitar outras etapas", () => {
    expect(etapaEhNovosLeads("Novo Lead")).toBe(true);
    expect(etapaEhNovosLeads("Novos leads")).toBe(true);
    expect(etapaEhNovosLeads("Sem viabilidade")).toBe(false);
    expect(etapaEhStandbyFollowUp("Stand By")).toBe(true);
  });

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

  it("libera os requisitos dinâmicos com Nome, CNPJ e Radar preenchidos", () => {
    const requisitos = [
      { id: "nome", nome: "Nome do responsável" },
      { id: "cnpj", nome: "CNPJ" },
      { id: "radar", nome: "Radar pretendido" },
    ];

    expect(listarCamposObrigatoriosFaltantes(requisitos, {
      nome: "Maria",
      cnpj: "12.345.678/0001-90",
      radar: "Radar 150k",
    })).toEqual([]);
  });

  it("lista somente Radar pretendido quando apenas ele está ausente", () => {
    const requisitos = [
      { id: "nome", nome: "Nome do responsável" },
      { id: "cnpj", nome: "CNPJ" },
      { id: "radar", nome: "Radar pretendido" },
    ];

    expect(listarCamposObrigatoriosFaltantes(requisitos, {
      nome: "Maria",
      cnpj: "12.345.678/0001-90",
      radar: null,
    }).map((campo) => campo.nome)).toEqual(["Radar pretendido"]);
  });

  it("não exige Confirmar serviço quando ele está vazio ou ausente", () => {
    const requisitos = [
      { id: "radar", nome: "Radar pretendido" },
    ];

    expect(listarCamposObrigatoriosFaltantes(requisitos, {
      radar: "Radar Ilimitado",
    })).toEqual([]);
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

describe("meta operacional de ligações", () => {
  it("planeja no máximo uma ligação por dia", () => {
    expect(calcularLigacoesPendentesNoDia(0)).toBe(1);
    expect(calcularLigacoesPendentesNoDia(1)).toBe(0);
    expect(calcularLigacoesPendentesNoDia(3)).toBe(0);
  });

  it("exige registro em oito datas úteis distintas e ciclo concluído", () => {
    const inicio = new Date("2026-08-03T13:00:00.000Z");
    const datas = datasUteisCicloNovosLeads(inicio);
    expect(datas).toEqual([
      "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06",
      "2026-08-07", "2026-08-10", "2026-08-11", "2026-08-12",
    ]);
    const ligacoes = datas.map((data) => new Date(`${data}T15:00:00.000Z`));
    expect(oitoTentativasDiariasRegistradas(inicio, ligacoes)).toBe(true);
    expect(oitoTentativasDiariasRegistradas(inicio, [...ligacoes.slice(0, 7), ligacoes[0]])).toBe(false);
    expect(cicloDeTentativasNovosLeadsConcluido(inicio, new Date("2026-08-12T20:00:00.000Z"))).toBe(false);
    expect(cicloDeTentativasNovosLeadsConcluido(inicio, new Date("2026-08-13T03:00:00.000Z"))).toBe(true);
  });

  it("exclui feriado nacional e fim de semana da cadência", () => {
    const inicio = new Date("2026-09-04T15:00:00.000Z");
    expect(ehDiaUtilNovosLeads(new Date("2026-09-07T15:00:00.000Z"))).toBe(false);
    expect(datasUteisCicloNovosLeads(inicio).slice(0, 3)).toEqual([
      "2026-09-04", "2026-09-08", "2026-09-09",
    ]);
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
