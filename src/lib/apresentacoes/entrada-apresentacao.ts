import { z } from "zod";
import { containerCargaComponenteSchema } from "@/lib/validations/slide-componentes-3d";
import type { ContainerCargaComponente } from "@/lib/validations/slide-componentes";
import type { CanvasConfig } from "./canvas";

const configuracaoVisualContainerSchema = containerCargaComponenteSchema.pick({
  corPrincipal: true,
  corMetal: true,
  corInterior: true,
  anguloAbertura: true,
  duracaoAbertura: true,
  atrasoAbertura: true,
  duracaoZoom: true,
  somHabilitado: true,
  somAbertura: true,
  volumeSom: true,
  mostrarLogo: true,
});

export const entradaContainerAlphaSchema = configuracaoVisualContainerSchema.extend({
  tipo: z.literal("container-alpha"),
});

export const entradaApresentacaoSchema = entradaContainerAlphaSchema.optional();

export type EntradaApresentacaoConfig = z.infer<typeof entradaContainerAlphaSchema>;

export const ENTRADA_CONTAINER_ALPHA_PADRAO: EntradaApresentacaoConfig = {
  tipo: "container-alpha",
  corPrincipal: "#071a3d",
  corMetal: "#96a3b2",
  corInterior: "#f5f6f8",
  anguloAbertura: 105,
  duracaoAbertura: 1.8,
  atrasoAbertura: 0.2,
  duracaoZoom: 1.4,
  somHabilitado: false,
  somAbertura: "industrial",
  volumeSom: 0.65,
  mostrarLogo: true,
};

export function obterEntradaApresentacaoSegura(valor: unknown): EntradaApresentacaoConfig | null {
  const resultado = entradaContainerAlphaSchema.safeParse(valor);
  return resultado.success ? resultado.data : null;
}

export function criarComponenteEntradaContainerAlpha(
  configuracao: EntradaApresentacaoConfig,
  canvas: CanvasConfig,
): ContainerCargaComponente {
  return {
    id: "entrada-container-alpha",
    tipo: "containerCarga",
    x: 0,
    y: 0,
    w: canvas.width,
    h: canvas.height,
    zIndex: 0,
    rotacao: 0,
    corPrincipal: configuracao.corPrincipal,
    corMetal: configuracao.corMetal,
    corInterior: configuracao.corInterior,
    anguloAbertura: configuracao.anguloAbertura,
    duracaoAbertura: configuracao.duracaoAbertura,
    atrasoAbertura: configuracao.atrasoAbertura,
    transicaoProximoSlide: true,
    duracaoZoom: configuracao.duracaoZoom,
    somHabilitado: configuracao.somHabilitado,
    somAbertura: configuracao.somAbertura,
    volumeSom: configuracao.volumeSom,
    mostrarLogo: configuracao.mostrarLogo,
    estadoEditor: "aberto",
  };
}
