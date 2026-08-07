import { describe, expect, it } from "vitest";
import { calcularOrdemStagger } from "@/lib/apresentacoes/animacao/stagger";
import { PRESETS_STAGGER } from "@/lib/apresentacoes/animacao/presets-stagger";
import { staggerConfigSchema } from "@/lib/validations/slide-animacao-config";
import type { StaggerConfig } from "@/lib/apresentacoes/animacao/tipos";

const ITENS = ["a", "b", "c", "d", "e"];

describe("Alpha Motion — Fase 03 — ordens de stagger", () => {
  it("first-to-last preserva a ordem original com delays crescentes", () => {
    const config: StaggerConfig = { ordem: "first-to-last", intervalo: 0.1 };
    const resultado = calcularOrdemStagger(ITENS, config);
    expect(resultado.map((r) => r.id)).toEqual(ITENS);
    const delaysEsperados = [0, 0.1, 0.2, 0.3, 0.4];
    resultado.forEach((r, i) => expect(r.delay).toBeCloseTo(delaysEsperados[i]));
  });

  it("last-to-first inverte a ordem", () => {
    const config: StaggerConfig = { ordem: "last-to-first", intervalo: 0.1 };
    const resultado = calcularOrdemStagger(ITENS, config);
    expect(resultado.map((r) => r.id)).toEqual(["e", "d", "c", "b", "a"]);
  });

  it("center-out começa pelo elemento central", () => {
    const config: StaggerConfig = { ordem: "center-out", intervalo: 0.1 };
    const resultado = calcularOrdemStagger(ITENS, config);
    expect(resultado[0].id).toBe("c");
    expect(resultado).toHaveLength(5);
  });

  it("edges-in começa pelas duas extremidades", () => {
    const config: StaggerConfig = { ordem: "edges-in", intervalo: 0.1 };
    const resultado = calcularOrdemStagger(ITENS, config);
    expect(resultado[0].id).toBe("a");
    expect(resultado[1].id).toBe("e");
    expect(resultado).toHaveLength(5);
  });

  it("random retorna todos os itens (ordem não garantida, mas sem perda/duplicação)", () => {
    const config: StaggerConfig = { ordem: "random", intervalo: 0.1 };
    const resultado = calcularOrdemStagger(ITENS, config);
    expect(resultado.map((r) => r.id).sort()).toEqual([...ITENS].sort());
  });

  it("manual usa ordemManual quando presente, ignorando ids inexistentes", () => {
    const config: StaggerConfig = { ordem: "manual", intervalo: 0.1, ordemManual: ["c", "a", "fantasma", "b"] };
    const resultado = calcularOrdemStagger(ITENS, config);
    expect(resultado.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("manual sem ordemManual cai no fallback first-to-last (nunca quebra)", () => {
    const config: StaggerConfig = { ordem: "manual", intervalo: 0.1 };
    const resultado = calcularOrdemStagger(ITENS, config);
    expect(resultado.map((r) => r.id)).toEqual(ITENS);
  });

  it("itensSimultaneos agrupa múltiplos itens no mesmo delay", () => {
    const config: StaggerConfig = { ordem: "first-to-last", intervalo: 0.1, itensSimultaneos: 2 };
    const resultado = calcularOrdemStagger(ITENS, config);
    expect(resultado.map((r) => r.delay)).toEqual([0, 0, 0.1, 0.1, 0.2]);
  });

  it("array vazio não quebra", () => {
    expect(calcularOrdemStagger([], { ordem: "first-to-last", intervalo: 0.1 })).toEqual([]);
  });
});

describe("Alpha Motion — Fase 03 — 7 presets de stagger", () => {
  it("todos os presets produzem StaggerConfig válido contra o schema Zod", () => {
    for (const [id, preset] of Object.entries(PRESETS_STAGGER)) {
      const config = preset.criar();
      const parsed = staggerConfigSchema.safeParse(config);
      expect(parsed.success, `${id} deveria ser válido`).toBe(true);
    }
  });

  it("tem exatamente os 7 presets pedidos", () => {
    expect(Object.keys(PRESETS_STAGGER).sort()).toEqual(
      ["card-cascade", "center-out", "grid-reveal", "metrics-cascade", "sequential-reveal", "text-cascade", "wave-reveal"].sort(),
    );
  });
});
