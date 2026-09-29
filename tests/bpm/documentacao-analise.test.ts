import { describe, expect, it } from "vitest";
import { cicloSemanal } from "@/lib/bpm/documentacao-analise";

describe("cadência de atualização documental", () => {
  const entrada = new Date("2026-09-01T12:00:00.000Z");

  it("só cobra após uma semana completa na etapa", () => {
    expect(cicloSemanal(entrada, null, new Date("2026-09-08T11:59:59.999Z"))).toBe(0);
    expect(cicloSemanal(entrada, null, new Date("2026-09-08T12:00:00.000Z"))).toBe(1);
    expect(cicloSemanal(entrada, null, new Date("2026-09-15T12:00:00.000Z"))).toBe(2);
  });

  it("reinicia a contagem após anotação de andamento", () => {
    const anotacao = new Date("2026-09-07T12:00:00.000Z");
    expect(cicloSemanal(entrada, anotacao, new Date("2026-09-08T12:00:00.000Z"))).toBe(0);
    expect(cicloSemanal(entrada, anotacao, new Date("2026-09-14T12:00:00.000Z"))).toBe(1);
  });
});
