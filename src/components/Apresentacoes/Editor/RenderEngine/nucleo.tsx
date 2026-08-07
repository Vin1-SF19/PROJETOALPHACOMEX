import { motion, type Variants, type TargetAndTransition, type Transition } from "framer-motion";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { stylePosicaoAbsoluta } from "./posicionamento";
import type { ConfigAnimacao } from "@/lib/validations/animacao";

interface VariantsResultado {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  transition: Transition;
}

/**
 * Traduz uma ConfigAnimacao (tipo/duração/delay/easing) em variants do Framer
 * Motion. Cobre os tipos "genéricos" (fade/slide/zoom/flip/bounce/blur) via
 * initial/animate declarativo — stagger/typing/counter têm tratamento próprio
 * nos componentes que os usam.
 */
export function variantsPara(anim: ConfigAnimacao | undefined): VariantsResultado | null {
  if (!anim) return null;
  const transition = { duration: anim.duracao, delay: anim.delay, ease: anim.easing };

  switch (anim.tipo) {
    case "fade":
      return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition };
    case "slide-up":
      return { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition };
    case "slide-down":
      return { initial: { opacity: 0, y: -24 }, animate: { opacity: 1, y: 0 }, transition };
    case "slide-left":
      return { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, transition };
    case "slide-right":
      return { initial: { opacity: 0, x: -24 }, animate: { opacity: 1, x: 0 }, transition };
    case "zoom-in":
      return { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, transition };
    case "zoom-out":
      return { initial: { opacity: 0, scale: 1.2 }, animate: { opacity: 1, scale: 1 }, transition };
    case "flip":
      return { initial: { opacity: 0, rotateY: 90 }, animate: { opacity: 1, rotateY: 0 }, transition };
    case "bounce":
      return {
        initial: { opacity: 0, scale: 0.6 },
        animate: { opacity: 1, scale: 1 },
        transition: { ...transition, type: "spring", bounce: 0.5 },
      };
    case "blur":
      return { initial: { opacity: 0, filter: "blur(8px)" }, animate: { opacity: 1, filter: "blur(0px)" }, transition };
    // stagger/typing/counter não usam este caminho genérico — tratados nos wrappers dedicados.
    default:
      return null;
  }
}

/** Wrapper que aplica a animação de entrada genérica (fade/slide/zoom/flip/bounce/blur) a qualquer nó. */
export function AnimacaoWrapper({ animacao, children }: { animacao: ConfigAnimacao | undefined; children: React.ReactNode }) {
  const v = variantsPara(animacao);
  if (!v) return <>{children}</>;
  return (
    <motion.div
      style={{ width: "100%", height: "100%", transformStyle: animacao?.tipo === "flip" ? "preserve-3d" : undefined }}
      initial={v.initial}
      animate={v.animate}
      transition={v.transition}
    >
      {children}
    </motion.div>
  );
}

/** Exportadas (Fase 03) para reaproveitamento em `ComponenteNoCanvas.tsx` — fecha a dívida
 * técnica de stagger não visível dentro do Editor, sem duplicar a lógica de animação. */
export const staggerContainerVariants = (staggerDelay: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: staggerDelay } },
});
export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

/** Container de filhos de containers (card/grid/container) — quando a animação do pai é "stagger", cada filho anima em cascata. */
export function FilhosContainer({
  style,
  filhos,
  usaStagger,
  staggerDelay,
  renderFilho,
}: {
  style: React.CSSProperties;
  filhos: ComponenteSlide[];
  usaStagger: boolean;
  staggerDelay: number;
  renderFilho: (filho: ComponenteSlide) => React.ReactNode;
}) {
  const posicaoFilho = (filho: ComponenteSlide): React.CSSProperties =>
    style.display === "grid" || style.display === "flex"
      ? { ...stylePosicaoAbsoluta(filho), position: "relative", left: undefined, top: undefined }
      : stylePosicaoAbsoluta(filho);

  if (usaStagger) {
    return (
      <motion.div style={{ width: "100%", height: "100%", ...style }} initial="hidden" animate="show" variants={staggerContainerVariants(staggerDelay)}>
        {filhos.map((filho) => (
          <motion.div key={filho.id} variants={staggerItemVariants} style={posicaoFilho(filho)}>
            {renderFilho(filho)}
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", ...style }}>
      {filhos.map((filho) => (
        <div key={filho.id} style={posicaoFilho(filho)}>
          {renderFilho(filho)}
        </div>
      ))}
    </div>
  );
}
