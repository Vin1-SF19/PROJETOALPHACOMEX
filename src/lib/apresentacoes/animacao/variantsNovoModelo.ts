import type { TargetAndTransition, Transition } from "framer-motion";
import type { ElementAnimation } from "./tipos";
import { montarTransition } from "./curvas";

export interface VariantsResultado {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  transition: Transition;
}

const DISTANCIA_PADRAO = 24;

/**
 * Espelha `variantsPara()` de `nucleo.tsx` (Onda 3), mas para o novo modelo
 * (`ElementAnimation`, Fase 01/02). Cobre os grupos de Opacidade/Movimento/Escala/Rotação
 * desta fase (Seções 5/6/7 do prompt original) — Revelação usa uma aproximação por
 * opacidade+leve deslocamento aqui; a técnica real com `clip-path` fica para quando as
 * Fases 05/07 tratarem revelação/wipe com mais profundidade (documentado como TODO).
 *
 * Sempre `transform`/`opacity` — nunca anima `top`/`left`/`width`/`height` diretamente
 * (regra de performance, `00-contexto-geral.md`).
 */
export function variantsParaNovoModelo(anim: ElementAnimation): VariantsResultado | null {
  const transition = montarTransition(anim.duration, anim.delay, anim.easing);
  const distancia = anim.distance ?? DISTANCIA_PADRAO;
  const saida = anim.category === "exit";

  // Para saída, initial/animate são o inverso do padrão de entrada equivalente.
  const inverterSeSaida = (entrada: TargetAndTransition, alvo: TargetAndTransition): VariantsResultado => ({
    initial: saida ? alvo : entrada,
    animate: saida ? entrada : alvo,
    transition,
  });

  switch (anim.type) {
    // --- Opacidade ---
    case "fade":
    case "fade-in":
    case "fade-out":
    case "dissolve-in":
    case "dissolve-out":
      return inverterSeSaida({ opacity: 0 }, { opacity: 1 });
    case "fade-up":
    case "fade-up-out":
      return inverterSeSaida({ opacity: 0, y: distancia }, { opacity: 1, y: 0 });
    case "fade-down":
    case "fade-down-out":
      return inverterSeSaida({ opacity: 0, y: -distancia }, { opacity: 1, y: 0 });
    case "fade-left":
    case "fade-left-out":
      return inverterSeSaida({ opacity: 0, x: distancia }, { opacity: 1, x: 0 });
    case "fade-right":
    case "fade-right-out":
      return inverterSeSaida({ opacity: 0, x: -distancia }, { opacity: 1, x: 0 });
    case "blur-in":
    case "blur-out":
      return inverterSeSaida({ opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)" });

    // --- Movimento ---
    case "slide-in-left":
    case "slide-out-left":
      return inverterSeSaida({ opacity: 0, x: -distancia * 2 }, { opacity: 1, x: 0 });
    case "slide-in-right":
    case "slide-out-right":
      return inverterSeSaida({ opacity: 0, x: distancia * 2 }, { opacity: 1, x: 0 });
    case "slide-in-up":
    case "slide-out-up":
      return inverterSeSaida({ opacity: 0, y: distancia * 2 }, { opacity: 1, y: 0 });
    case "slide-in-down":
    case "slide-out-down":
      return inverterSeSaida({ opacity: 0, y: -distancia * 2 }, { opacity: 1, y: 0 });
    case "fly-in-left":
      return inverterSeSaida({ opacity: 0, x: -distancia * 4 }, { opacity: 1, x: 0 });
    case "fly-in-right":
      return inverterSeSaida({ opacity: 0, x: distancia * 4 }, { opacity: 1, x: 0 });
    case "fly-in-up":
      return inverterSeSaida({ opacity: 0, y: distancia * 4 }, { opacity: 1, y: 0 });
    case "fly-in-down":
      return inverterSeSaida({ opacity: 0, y: -distancia * 4 }, { opacity: 1, y: 0 });

    // --- Escala ---
    case "scale-in":
    case "scale-out":
      return inverterSeSaida({ opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1 });
    case "zoom-in":
    case "zoom-out":
      return inverterSeSaida({ opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1 });
    case "pop-in":
      return inverterSeSaida({ opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1 });
    case "bounce-in":
      return {
        initial: { opacity: 0, scale: 0.6 },
        animate: { opacity: 1, scale: 1 },
        transition: { ...transition, type: "spring", bounce: 0.5 },
      };
    case "elastic-in":
      return {
        initial: { opacity: 0, scale: 0.4 },
        animate: { opacity: 1, scale: 1 },
        transition: { ...transition, type: "spring", stiffness: 300, damping: 12 },
      };
    case "shrink-to-point":
      return { initial: { opacity: 1, scale: 1 }, animate: { opacity: 0, scale: 0 }, transition };
    case "collapse":
      return { initial: { opacity: 1, scaleY: 1 }, animate: { opacity: 0, scaleY: 0 }, transition };
    case "mask-close":
      return { initial: { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" }, animate: { opacity: 0, clipPath: "inset(50% 50% 50% 50%)" }, transition };

    // --- Rotação ---
    case "rotate-in":
    case "rotate-out":
      return inverterSeSaida({ opacity: 0, rotate: -(anim.intensity ?? 90) }, { opacity: 1, rotate: 0 });
    case "rotate-in-left":
      return inverterSeSaida({ opacity: 0, rotate: -(anim.intensity ?? 45), x: -distancia }, { opacity: 1, rotate: 0, x: 0 });
    case "rotate-in-right":
      return inverterSeSaida({ opacity: 0, rotate: anim.intensity ?? 45, x: distancia }, { opacity: 1, rotate: 0, x: 0 });
    case "flip-in-horizontal":
    case "flip-out":
      return inverterSeSaida({ opacity: 0, rotateX: 90 }, { opacity: 1, rotateX: 0 });
    case "flip-in-vertical":
      return inverterSeSaida({ opacity: 0, rotateY: 90 }, { opacity: 1, rotateY: 0 });

    // --- Revelação (aproximação por opacidade+deslocamento; clip-path real nas Fases 05/07) ---
    case "mask-reveal-left":
      return inverterSeSaida({ opacity: 0, x: -distancia / 2 }, { opacity: 1, x: 0 });
    case "mask-reveal-right":
      return inverterSeSaida({ opacity: 0, x: distancia / 2 }, { opacity: 1, x: 0 });
    case "mask-reveal-up":
      return inverterSeSaida({ opacity: 0, y: distancia / 2 }, { opacity: 1, y: 0 });
    case "mask-reveal-down":
      return inverterSeSaida({ opacity: 0, y: -distancia / 2 }, { opacity: 1, y: 0 });
    case "center-reveal":
    case "split-reveal":
    case "curtain-reveal":
      return inverterSeSaida({ opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1 });
    case "outline-reveal":
    case "line-draw":
    case "border-draw":
      return inverterSeSaida({ opacity: 0 }, { opacity: 1 });

    // --- Ênfase (loop simples — repeat controlado por `anim.repeat`) ---
    case "pulse":
    case "scale-pulse":
      return { initial: { scale: 1 }, animate: { scale: [1, 1.05, 1] }, transition: { ...transition, repeat: anim.repeat ?? Infinity } };
    case "heartbeat":
      return { initial: { scale: 1 }, animate: { scale: [1, 1.15, 1, 1.15, 1] }, transition: { ...transition, repeat: anim.repeat ?? Infinity } };
    case "bounce":
      return { initial: { y: 0 }, animate: { y: [0, -10, 0] }, transition: { ...transition, repeat: anim.repeat ?? Infinity } };
    case "shake":
      return { initial: { x: 0 }, animate: { x: [0, -6, 6, -6, 6, 0] }, transition: { ...transition, repeat: anim.repeat ?? Infinity } };
    case "wiggle":
      return { initial: { rotate: 0 }, animate: { rotate: [0, -4, 4, -4, 0] }, transition: { ...transition, repeat: anim.repeat ?? Infinity } };
    case "swing":
      return { initial: { rotate: 0 }, animate: { rotate: [0, 12, -12, 6, 0] }, transition: { ...transition, repeat: anim.repeat ?? Infinity } };
    case "float":
      return { initial: { y: 0 }, animate: { y: [0, -8, 0] }, transition: { ...transition, repeat: anim.repeat ?? Infinity, ease: "easeInOut" } };
    case "glow":
      return { initial: { filter: "brightness(1)" }, animate: { filter: ["brightness(1)", "brightness(1.3)", "brightness(1)"] }, transition: { ...transition, repeat: anim.repeat ?? Infinity } };
    case "flash":
      return { initial: { opacity: 1 }, animate: { opacity: [1, 0.2, 1] }, transition: { ...transition, repeat: anim.repeat ?? Infinity } };
    case "blink":
      return { initial: { opacity: 1 }, animate: { opacity: [1, 0, 1] }, transition: { ...transition, repeat: anim.repeat ?? Infinity } };
    case "highlight":
    case "color-shift":
      return { initial: { opacity: 1 }, animate: { opacity: [1, 0.7, 1] }, transition: { ...transition, repeat: anim.repeat ?? Infinity } };
    case "border-pulse":
      return { initial: { opacity: 1 }, animate: { opacity: [1, 0.6, 1] }, transition: { ...transition, repeat: anim.repeat ?? Infinity } };
    case "rotate-pulse":
      return { initial: { rotate: 0 }, animate: { rotate: [0, 3, -3, 0] }, transition: { ...transition, repeat: anim.repeat ?? Infinity } };
    case "blur-focus":
      return { initial: { filter: "blur(0px)" }, animate: { filter: ["blur(0px)", "blur(2px)", "blur(0px)"] }, transition: { ...transition, repeat: anim.repeat ?? Infinity } };
    case "card-expand":
    case "expand-to-focus":
    case "focus-element":
      return { initial: { scale: 1 }, animate: { scale: anim.intensity ?? 1.08 }, transition };
    case "color-fill":
      return { initial: { filter: "saturate(1) brightness(1)" }, animate: { filter: "saturate(1.2) brightness(1.12)" }, transition };
    case "bar-grow-horizontal-ltr":
    case "bar-grow-horizontal-rtl":
    case "bar-grow-center":
      return { initial: { scaleX: 0 }, animate: { scaleX: 1 }, transition };
    case "bar-grow-vertical-btt":
    case "bar-grow-vertical-ttb":
      return { initial: { scaleY: 0 }, animate: { scaleY: 1 }, transition };
    case "dim-others":
      return { initial: { opacity: 1 }, animate: { opacity: 1 }, transition };

    default:
      return null;
  }
}
