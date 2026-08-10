import { describe, expect, it } from "vitest";
import {
  listarPresetsAnimacaoDisponiveis,
  normalizarPresetsAnimacaoPersonalizados,
  presetAnimacaoPersonalizadoSchema,
  removerPresetsDoPacoteDoSlide,
} from "@/lib/apresentacoes/animacao/presets-personalizados";
import { dadosSlideSchema } from "@/lib/validations/slide-componentes";

const PRESET_VALIDO = {
  id: "custom-teste",
  nome: "Entrada comercial",
  descricao: "Sequência criada na Central Criativa.",
  atualizadoEm: "2026-08-10T12:00:00.000Z",
  animacoes: [{
    type: "fade-up",
    category: "entrance" as const,
    trigger: "on-slide-enter" as const,
    duration: 0.6,
    delay: 0,
    order: 0,
    easing: { curva: "easeOut" as const },
  }],
};

describe("presets personalizados do Alpha Motion", () => {
  it("valida e persiste o preset dentro do JSON existente do slide", () => {
    expect(presetAnimacaoPersonalizadoSchema.safeParse(PRESET_VALIDO).success).toBe(true);
    const slide = dadosSlideSchema.parse({ componentes: [], presetsAnimacao: [PRESET_VALIDO] });
    expect(slide.presetsAnimacao?.[0].nome).toBe("Entrada comercial");
  });

  it("descarta pacotes inválidos de forma defensiva", () => {
    expect(normalizarPresetsAnimacaoPersonalizados([{ id: "quebrado" }])).toEqual([]);
  });

  it("combina presets nativos e personalizados para os selects", () => {
    const personalizados = [presetAnimacaoPersonalizadoSchema.parse(PRESET_VALIDO)];
    const disponiveis = listarPresetsAnimacaoDisponiveis(personalizados);
    expect(disponiveis.some((preset) => preset.id === "minimalista" && preset.origem === "nativo")).toBe(true);
    expect(disponiveis.some((preset) => preset.id === "custom-teste" && preset.origem === "personalizado")).toBe(true);
  });

  it("remove a biblioteca ao duplicar um slide", () => {
    const semPresets = removerPresetsDoPacoteDoSlide({ componentes: [], presetsAnimacao: [PRESET_VALIDO] });
    expect(semPresets).not.toHaveProperty("presetsAnimacao");
    expect(semPresets.componentes).toEqual([]);
  });
});
