import { describe, expect, it } from "vitest";
import { migrarAnimacaoAntiga } from "@/lib/apresentacoes/animacao/migracao";
import { dadosSlideSchema } from "@/lib/validations/slide-componentes";
import type { ConfigAnimacaoCompleta } from "@/lib/validations/animacao";

describe("Alpha Motion — Fase 01 — compatibilidade com apresentações antigas", () => {
  it("dadosSlideSchema aceita slide sem animacaoConfig (formato anterior a esta fila)", () => {
    const dadosAntigos = {
      componentes: [
        { id: "c1", x: 0, y: 0, w: 100, h: 50, zIndex: 0, rotacao: 0, tipo: "texto", texto: "Olá", tag: "h1" },
      ],
    };

    const parsed = dadosSlideSchema.safeParse(dadosAntigos);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.animacaoConfig).toBeUndefined();
    }
  });

  it("dadosSlideSchema aceita slide sem nenhuma configuração de animação em nenhum componente", () => {
    const dadosSemAnimacao = {
      componentes: [
        { id: "c1", x: 0, y: 0, w: 100, h: 50, zIndex: 0, rotacao: 0, tipo: "texto", texto: "Estático", tag: "p" },
      ],
    };
    expect(dadosSlideSchema.safeParse(dadosSemAnimacao).success).toBe(true);
  });

  it("migrarAnimacaoAntiga retorna array vazio quando não há animação configurada", () => {
    expect(migrarAnimacaoAntiga("c1", undefined)).toEqual([]);
  });

  it("migra entrada/saída/loop do formato antigo (Onda 3) para ElementAnimation[]", () => {
    const antiga: ConfigAnimacaoCompleta = {
      entrada: { tipo: "fade", duracao: 0.5, delay: 0, easing: "easeOut" },
      saida: { tipo: "slide-left", duracao: 0.3, delay: 0.1, easing: "easeIn" },
      loop: { tipo: "bounce", duracao: 1, delay: 0, easing: "linear", repetir: true },
    };

    const migradas = migrarAnimacaoAntiga("c1", antiga);
    expect(migradas).toHaveLength(3);

    const entrada = migradas.find((a) => a.category === "entrance");
    expect(entrada).toMatchObject({ type: "fade", duration: 0.5, elementId: "c1" });

    const saida = migradas.find((a) => a.category === "exit");
    expect(saida).toMatchObject({ type: "slide-left", duration: 0.3, delay: 0.1 });

    const emphasis = migradas.find((a) => a.category === "emphasis");
    expect(emphasis).toMatchObject({ type: "bounce", repeat: Infinity });
  });

  it("preserva valorFinal/velocidadeDigitacao em customProperties (typing/counter não têm equivalente direto)", () => {
    const antiga: ConfigAnimacaoCompleta = {
      entrada: { tipo: "counter", duracao: 2, delay: 0, easing: "easeOut", valorFinal: 900 },
    };
    const [migrada] = migrarAnimacaoAntiga("c1", antiga);
    expect(migrada.customProperties).toMatchObject({ valorFinal: 900 });
  });

  it("migra container-alpha sem perder a configuração aninhada", () => {
    const antiga: ConfigAnimacaoCompleta = {
      entrada: {
        tipo: "container-alpha",
        duracao: 1.2,
        delay: 0,
        easing: "easeInOut",
        containerAlpha: {
          corPrincipal: "#071a3d",
          corMetal: "#96a3b2",
          corInterior: "#171b22",
          anguloAbertura: 105,
          duracaoAbertura: 1.5,
          atrasoAbertura: 0,
          duracaoZoom: 1.15,
          somHabilitado: true,
          somAbertura: "industrial",
          volumeSom: 0.75,
          mostrarLogo: true,
        },
      },
    };
    const [migrada] = migrarAnimacaoAntiga("c1", antiga);
    expect(migrada.type).toBe("container-alpha");
    expect(migrada.customProperties?.containerAlpha).toBeDefined();
  });
});
