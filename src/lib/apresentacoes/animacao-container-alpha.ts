import { z } from "zod";
import type { ComponenteSlide, ContainerCargaComponente } from "@/lib/validations/slide-componentes";
import type { CanvasConfig } from "./canvas";

const corHexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hexadecimal no formato #RRGGBB.");

export const configAnimacaoContainerAlphaSchema = z.object({
  corPrincipal: corHexSchema.default("#071a3d"),
  corMetal: corHexSchema.default("#96a3b2"),
  corInterior: corHexSchema.default("#f5f6f8"),
  anguloAbertura: z.number().min(45).max(120).default(105),
  duracaoAbertura: z.number().min(0.2).max(10).default(1.5),
  atrasoAbertura: z.number().min(0).max(10).default(0),
  duracaoZoom: z.number().min(0.3).max(5).default(1.15),
  somHabilitado: z.boolean().default(true),
  somAbertura: z.enum(["industrial", "hidraulico"]).default("industrial"),
  volumeSom: z.number().min(0).max(1).default(0.75),
  mostrarLogo: z.boolean().default(true),
});

export type ConfigAnimacaoContainerAlpha = z.infer<typeof configAnimacaoContainerAlphaSchema>;

export const ANIMACAO_CONTAINER_ALPHA_PADRAO: ConfigAnimacaoContainerAlpha = {
  corPrincipal: "#071a3d",
  corMetal: "#96a3b2",
  corInterior: "#f5f6f8",
  anguloAbertura: 105,
  duracaoAbertura: 1.5,
  atrasoAbertura: 0,
  duracaoZoom: 1.15,
  somHabilitado: true,
  somAbertura: "industrial",
  volumeSom: 0.75,
  mostrarLogo: true,
};

export function normalizarConfigAnimacaoContainerAlpha(valor: unknown): ConfigAnimacaoContainerAlpha {
  const resultado = configAnimacaoContainerAlphaSchema.safeParse(valor ?? {});
  return resultado.success ? resultado.data : ANIMACAO_CONTAINER_ALPHA_PADRAO;
}

export function criarComponenteAnimacaoContainerAlpha(
  configuracao: ConfigAnimacaoContainerAlpha,
  canvas: CanvasConfig,
): ContainerCargaComponente {
  return {
    id: "animacao-container-alpha",
    tipo: "containerCarga",
    x: 0,
    y: 0,
    w: canvas.width,
    h: canvas.height,
    zIndex: 0,
    rotacao: 0,
    ...configuracao,
    transicaoProximoSlide: true,
    estadoEditor: "aberto",
  };
}

export function obterAnimacaoContainerAlpha(
  componentes: ComponenteSlide[],
): ConfigAnimacaoContainerAlpha | null {
  for (const componente of componentes) {
    const entrada = componente.animacao?.entrada;
    if (entrada?.tipo === "container-alpha") {
      return normalizarConfigAnimacaoContainerAlpha(entrada.containerAlpha);
    }
    if (componente.tipo === "card" || componente.tipo === "grid" || componente.tipo === "container") {
      const configuracaoFilho = obterAnimacaoContainerAlpha(componente.filhos);
      if (configuracaoFilho) return configuracaoFilho;
    }
  }
  return null;
}

interface SlideComComponentes {
  componentes: ComponenteSlide[];
}

/**
 * A abertura Container Alpha configurada no primeiro slide funciona como uma
 * capa anterior à apresentação. O próprio primeiro slide é o destino do zoom.
 */
export function obterAnimacaoContainerAlphaInicial(
  slides: readonly SlideComComponentes[],
): ConfigAnimacaoContainerAlpha | null {
  return obterAnimacaoContainerAlpha(slides[0]?.componentes ?? []);
}
