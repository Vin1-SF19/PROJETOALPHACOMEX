import { useState, type MouseEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";
import { variantsParaNovoModelo } from "@/lib/apresentacoes/animacao/variantsNovoModelo";

interface CamadaAnimacaoProps {
  animacao: ElementAnimation;
  children: ReactNode;
}

function CamadaAnimacao({ animacao, children }: CamadaAnimacaoProps) {
  const [acionada, setAcionada] = useState(false);
  const variants = variantsParaNovoModelo(animacao);
  if (!variants) return <>{children}</>;

  const style = {
    width: "100%",
    height: "100%",
    transformOrigin: animacao.type === "bar-grow-horizontal-ltr" ? "left center"
      : animacao.type === "bar-grow-horizontal-rtl" ? "right center"
        : animacao.type === "bar-grow-vertical-btt" ? "center bottom"
          : animacao.type === "bar-grow-vertical-ttb" ? "center top"
            : "center center",
  } as const;

  if (animacao.trigger === "on-click") {
    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      setAcionada(true);
    };
    return (
      <motion.div style={style} initial={variants.initial} animate={acionada ? variants.animate : variants.initial} transition={variants.transition} onClick={handleClick}>
        {children}
      </motion.div>
    );
  }

  if (animacao.trigger === "on-hover") {
    return (
      <motion.div style={style} initial={variants.initial} whileHover={variants.animate} transition={variants.transition}>
        {children}
      </motion.div>
    );
  }

  if (animacao.trigger === "on-visible") {
    return (
      <motion.div style={style} initial={variants.initial} whileInView={variants.animate} viewport={{ once: true, amount: 0.2 }} transition={variants.transition}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div style={style} initial={variants.initial} animate={variants.animate} transition={variants.transition}>
      {children}
    </motion.div>
  );
}

/** Executa as animações da timeline em ordem. Scroll Reveal continua em seu wrapper próprio. */
export function AnimacaoElementoWrapper({ animacoes, children }: { animacoes: ElementAnimation[]; children: ReactNode }) {
  const executaveis = animacoes
    .filter((animacao) => animacao.trigger !== "on-scroll" && animacao.trigger !== "on-element-click" && animacao.type !== "stagger")
    .sort((a, b) => a.order - b.order);

  return executaveis.reduceRight<ReactNode>(
    (conteudo, animacao) => <CamadaAnimacao key={animacao.id} animacao={animacao}>{conteudo}</CamadaAnimacao>,
    children,
  );
}

