import { obterCanvasSeguro, type CanvasConfig } from "@/lib/apresentacoes/canvas";
import { dadosSlideSchema, type ComponenteSlide } from "@/lib/validations/slide-componentes";

export interface MiniaturaSlideDados {
  canvas: CanvasConfig;
  componentes: ComponenteSlide[];
}

function prepararComponente(componente: ComponenteSlide): ComponenteSlide {
  if (componente.tipo === "card" || componente.tipo === "grid" || componente.tipo === "container") {
    return {
      ...componente,
      animacao: undefined,
      filhos: prepararComponentes(componente.filhos),
    };
  }

  return { ...componente, animacao: undefined };
}

function prepararComponentes(componentes: ComponenteSlide[]): ComponenteSlide[] {
  const preparados = componentes.map(prepararComponente);
  if (preparados.length === 0) return preparados;

  // O editor guarda o background abaixo do conteudo com z-index negativo. Dentro do
  // foreignObject da miniatura, deslocamos a pilha inteira sem mudar a ordem relativa.
  const menorZIndex = Math.min(...preparados.map((componente) => componente.zIndex));
  if (menorZIndex >= 0) return preparados;

  return preparados.map((componente) => ({
    ...componente,
    zIndex: componente.zIndex - menorZIndex,
  }));
}

/**
 * Valida o Slide 1 e preserva seus componentes reais para o mini visualizador.
 * As animacoes de entrada sao removidas para a fotografia nao nascer invisivel.
 */
export function criarMiniaturaSlide(dadosJson: unknown): MiniaturaSlideDados | null {
  const parsed = dadosSlideSchema.safeParse(dadosJson);
  if (!parsed.success || parsed.data.componentes.length === 0) return null;

  return {
    canvas: obterCanvasSeguro(parsed.data.canvas),
    componentes: prepararComponentes(parsed.data.componentes),
  };
}
