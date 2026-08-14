import { describe, expect, it } from "vitest";
import {
  calcularProximaRevisaoMonitoramento,
  etapaEhMonitoramento,
  monitoramentoEstaVencido,
  obterErroTransicaoMonitoramento,
} from "@/lib/bpm/monitoramento";

describe("BPM - regra de Monitoramento", () => {
  it("reconhece a etapa independentemente de caixa e acentuação", () => {
    expect(etapaEhMonitoramento("Monitoramento")).toBe(true);
    expect(etapaEhMonitoramento(" monitoramento ")).toBe(true);
    expect(etapaEhMonitoramento("Standby - Follow Up")).toBe(false);
  });

  it("agenda a revisão mensal pela entrada atual ou pela última execução atual", () => {
    const entrada = new Date("2026-08-01T12:00:00.000Z");
    expect(calcularProximaRevisaoMonitoramento(entrada, null)).toEqual(new Date("2026-08-31T12:00:00.000Z"));
    expect(calcularProximaRevisaoMonitoramento(entrada, new Date("2026-08-31T12:00:00.000Z"))).toEqual(
      new Date("2026-09-30T12:00:00.000Z"),
    );
  });

  it("reinicia o ciclo ao reentrar em Monitoramento", () => {
    const entradaAtual = new Date("2026-08-20T12:00:00.000Z");
    const execucaoAnterior = new Date("2026-08-01T12:00:00.000Z");
    expect(calcularProximaRevisaoMonitoramento(entradaAtual, execucaoAnterior)).toEqual(
      new Date("2026-09-19T12:00:00.000Z"),
    );
    expect(monitoramentoEstaVencido({
      entradaEmMonitoramento: entradaAtual,
      ultimaExecucaoEm: execucaoAnterior,
      agora: new Date("2026-09-18T23:59:59.999Z"),
    })).toBe(false);
  });

  it("restringe a entrada e a saída da etapa em todos os caminhos de movimento", () => {
    expect(obterErroTransicaoMonitoramento({
      etapaOrigemNome: "Reunião Agendada",
      etapaDestinoNome: "Monitoramento",
    })).toBe("Monitoramento só pode receber cards vindos de Em Tratativa.");
    expect(obterErroTransicaoMonitoramento({
      etapaOrigemNome: "Monitoramento",
      etapaDestinoNome: "Standby - Follow Up",
    })).toBe("De Monitoramento, mova o card apenas para Em Tratativa ou Lost.");
    expect(obterErroTransicaoMonitoramento({
      etapaOrigemNome: "Em Tratativa",
      etapaDestinoNome: "Monitoramento",
    })).toBeNull();
    expect(obterErroTransicaoMonitoramento({
      etapaOrigemNome: "Monitoramento",
      etapaDestinoNome: "Lost",
    })).toBeNull();
  });
});
