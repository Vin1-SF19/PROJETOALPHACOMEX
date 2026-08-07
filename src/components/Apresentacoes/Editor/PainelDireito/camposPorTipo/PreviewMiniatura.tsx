import { motion } from "framer-motion";
import { montarTransition } from "@/lib/apresentacoes/animacao/curvas";
import { useReducedMotionEditor } from "../../ReducedMotionSimuladoContext";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";

/** Mapa tipo→(initial,animate) — mesmo espírito de `variantsPara` (`nucleo.tsx`), mas sobre o novo catálogo (`ElementAnimation.type`, ~69 entradas), não sobre `ConfigAnimacao` (formato antigo). Cobre só os tipos que têm variante visual simples o bastante para uma miniatura 60x60 — os demais caem no fallback de fade. */
const VARIANTS_PREVIEW: Record<string, { initial: Record<string, number | string>; animate: Record<string, number | string> }> = {
  "fade-in": { initial: { opacity: 0 }, animate: { opacity: 1 } },
  "fade-up": { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } },
  "fade-down": { initial: { opacity: 0, y: -14 }, animate: { opacity: 1, y: 0 } },
  "fade-left": { initial: { opacity: 0, x: 14 }, animate: { opacity: 1, x: 0 } },
  "fade-right": { initial: { opacity: 0, x: -14 }, animate: { opacity: 1, x: 0 } },
  "blur-in": { initial: { opacity: 0, filter: "blur(6px)" }, animate: { opacity: 1, filter: "blur(0px)" } },
  "dissolve-in": { initial: { opacity: 0 }, animate: { opacity: 1 } },
  "slide-in-left": { initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 } },
  "slide-in-right": { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 } },
  "slide-in-up": { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } },
  "slide-in-down": { initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 } },
  "scale-in": { initial: { opacity: 0, scale: 0.85 }, animate: { opacity: 1, scale: 1 } },
  "zoom-in": { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 } },
  "zoom-out": { initial: { opacity: 0, scale: 1.3 }, animate: { opacity: 1, scale: 1 } },
  "pop-in": { initial: { opacity: 0, scale: 0.5 }, animate: { opacity: 1, scale: 1 } },
  "bounce-in": { initial: { opacity: 0, scale: 0.5 }, animate: { opacity: 1, scale: 1 } },
  "rotate-in": { initial: { opacity: 0, rotate: -25 }, animate: { opacity: 1, rotate: 0 } },
  pulse: { initial: { scale: 1 }, animate: { scale: 1.12 } },
  shake: { initial: { x: 0 }, animate: { x: 6 } },
  float: { initial: { y: 0 }, animate: { y: -8 } },
};

const VARIANT_PADRAO = VARIANTS_PREVIEW["fade-in"];

interface PreviewMiniaturaProps {
  /** Animação sendo editada (ou uma versão mínima com só `type`/`duration`/`delay`/`easing` antes de aplicar). */
  animacao: Pick<ElementAnimation, "type" | "duration" | "delay" | "easing">;
}

/**
 * Fase 09 — Preview de miniatura (Seção 14 do prompt original): "não renderizar vídeos... usar
 * previews leves feitos com elementos HTML". Reaproveita `montarTransition` (mesma função que
 * o motor real usa para montar a `Transition` do Framer Motion, `curvas.ts`) — nunca duplica um
 * mini-motor de animação à parte. Toca em loop simples (`repeat: Infinity, repeatType: "reverse"`)
 * dentro de um card pequeno fixo — não é hover-per-option de um `<select>` nativo (não dá pra
 * customizar visualmente as `<option>` de um select HTML), é um painel que atualiza ao trocar a
 * seleção no formulário, o que já satisfaz "ver a miniatura animada" do pedido original.
 */
export function PreviewMiniatura({ animacao }: PreviewMiniaturaProps) {
  const reducedMotion = useReducedMotionEditor();
  const variante = VARIANTS_PREVIEW[animacao.type] ?? VARIANT_PADRAO;
  const transition = { ...montarTransition(animacao.duration, 0, animacao.easing), repeat: Infinity, repeatType: "reverse" as const, repeatDelay: 0.4 };

  if (reducedMotion) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-white/10 bg-slate-950 p-3 text-[10px] text-slate-500" aria-hidden="true">
        Preview desativado (reduzir animações)
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center rounded-lg border border-white/10 bg-slate-950 p-3" aria-hidden="true">
      <motion.div
        key={animacao.type}
        className="h-14 w-14 rounded-md bg-indigo-500"
        initial={variante.initial}
        animate={variante.animate}
        transition={transition}
      />
    </div>
  );
}
