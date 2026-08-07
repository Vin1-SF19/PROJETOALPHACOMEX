import type { ConfigAnimacao, ConfigAnimacaoCompleta } from "@/lib/validations/animacao";
import type { ElementAnimation, EasingConfig } from "./tipos";

/**
 * Adaptador de compatibilidade (Fase 01 — Seção 32 do prompt original: "migração e
 * compatibilidade"). Lê `componente.animacao` no formato ANTIGO (Onda 3,
 * `configAnimacaoCompletaSchema`, 14 tipos) e produz `ElementAnimation` equivalente — em
 * runtime, na LEITURA. Nunca reescreve o dado salvo no banco; apresentações antigas
 * continuam com o JSON exatamente como estava.
 */

const EASING_ANTIGO_PARA_NOVO: Record<ConfigAnimacao["easing"], EasingConfig["curva"]> = {
  linear: "linear",
  easeIn: "easeIn",
  easeOut: "easeOut",
  easeInOut: "easeInOut",
};

/** Mapeia 1:1 os 14 tipos antigos para o `type` livre do novo modelo — sem perda de nome. */
const TIPO_ANTIGO_PARA_NOVO: Record<ConfigAnimacao["tipo"], string> = {
  fade: "fade",
  "slide-up": "slide-up",
  "slide-down": "slide-down",
  "slide-left": "slide-left",
  "slide-right": "slide-right",
  "zoom-in": "zoom-in",
  "zoom-out": "zoom-out",
  flip: "flip",
  bounce: "bounce",
  blur: "blur",
  stagger: "stagger",
  typing: "typing",
  counter: "counter",
  "container-alpha": "container-alpha",
};

function migrarConfigIndividual(
  config: ConfigAnimacao,
  elementId: string,
  category: ElementAnimation["category"],
  order: number,
): ElementAnimation {
  return {
    id: `migrado-${elementId}-${category}`,
    elementId,
    category,
    type: TIPO_ANTIGO_PARA_NOVO[config.tipo],
    trigger: "on-slide-enter",
    duration: config.duracao,
    delay: config.delay,
    order,
    easing: { curva: EASING_ANTIGO_PARA_NOVO[config.easing] },
    stagger:
      config.tipo === "stagger" && config.staggerDelay !== undefined
        ? { ordem: "first-to-last", intervalo: config.staggerDelay }
        : undefined,
    customProperties: {
      // Preserva campos que não têm equivalente direto no modelo novo — nunca descartados.
      ...(config.velocidadeDigitacao !== undefined && { velocidadeDigitacao: config.velocidadeDigitacao }),
      ...(config.valorFinal !== undefined && { valorFinal: config.valorFinal }),
      ...(config.containerAlpha !== undefined && { containerAlpha: config.containerAlpha }),
    },
  };
}

/**
 * Converte `componente.animacao` (formato Onda 3) em uma lista de `ElementAnimation`
 * equivalentes (entrada/saída/loop→ênfase). Retorna array vazio se não houver animação
 * configurada — nunca lança erro, nunca exige que o campo exista.
 */
export function migrarAnimacaoAntiga(
  elementId: string,
  animacaoAntiga: ConfigAnimacaoCompleta,
): ElementAnimation[] {
  if (!animacaoAntiga) return [];

  const resultado: ElementAnimation[] = [];
  if (animacaoAntiga.entrada) {
    resultado.push(migrarConfigIndividual(animacaoAntiga.entrada, elementId, "entrance", 0));
  }
  if (animacaoAntiga.saida) {
    resultado.push(migrarConfigIndividual(animacaoAntiga.saida, elementId, "exit", 1));
  }
  if (animacaoAntiga.loop) {
    resultado.push({
      ...migrarConfigIndividual(animacaoAntiga.loop, elementId, "emphasis", 2),
      repeat: animacaoAntiga.loop.repetir ? Infinity : 0,
    });
  }
  return resultado;
}
