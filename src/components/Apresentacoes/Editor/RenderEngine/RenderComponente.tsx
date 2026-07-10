import { useEffect, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Sparkles, type LucideIcon } from "lucide-react";
import { motion, useMotionValue, useTransform, animate, type Variants, type TargetAndTransition, type Transition } from "framer-motion";
import type { ComponenteSlide, TextoComponente } from "@/lib/validations/slide-componentes";
import type { ConfigAnimacao } from "@/lib/validations/animacao";
import { GloboRender } from "./GloboRender";
import { ParticulasRender } from "./ParticulasRender";
import { ObjetoGlbRender } from "./ObjetoGlbRender";

interface VariantsResultado {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  transition: Transition;
}

/**
 * Traduz uma ConfigAnimacao (tipo/duração/delay/easing) em variants do Framer
 * Motion. Cobre os tipos "genéricos" (fade/slide/zoom/flip/bounce/blur) via
 * initial/animate declarativo — stagger/typing/counter têm tratamento próprio
 * nos componentes que os usam (ver StaggerWrapper, TextoAnimado abaixo).
 */
function variantsPara(anim: ConfigAnimacao | undefined): VariantsResultado | null {
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
function AnimacaoWrapper({ animacao, children }: { animacao: ConfigAnimacao | undefined; children: React.ReactNode }) {
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

/**
 * Efeito de digitação: revela o texto caractere a caractere ao longo do tempo.
 * Usa useEffect+setInterval (não é fetch de dados — é sincronização com o
 * "relógio" da animação, caso legítimo de useEffect pelas regras do projeto).
 * Alternativa via CSS `steps()` foi descartada: exigiria fonte monoespaçada
 * (largura de char constante) para não "pular" visualmente, restrição que não
 * faz sentido impor a um componente de texto genérico.
 */
function useTypingText(texto: string, ativo: boolean, velocidadeCps: number) {
  const [visivel, setVisivel] = useState(ativo ? "" : texto);

  useEffect(() => {
    if (!ativo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com o "relógio" da animação (prop externa `ativo`), não é fetch de dados
      setVisivel(texto);
      return;
    }
    setVisivel("");
    let i = 0;
    const intervaloMs = Math.max(1000 / velocidadeCps, 10);
    const id = setInterval(() => {
      i += 1;
      setVisivel(texto.slice(0, i));
      if (i >= texto.length) clearInterval(id);
    }, intervaloMs);
    return () => clearInterval(id);
  }, [texto, ativo, velocidadeCps]);

  return visivel;
}

/** Contador numérico animado de 0 até valorFinal (Framer Motion imperativo — useMotionValue/animate). */
function useCounterValue(valorFinal: number, ativo: boolean, duracao: number, delay: number) {
  const motionVal = useMotionValue(0);
  const texto = useTransform(motionVal, (v) => Math.round(v).toLocaleString("pt-BR"));
  const [display, setDisplay] = useState(ativo ? "0" : valorFinal.toLocaleString("pt-BR"));

  useEffect(() => {
    if (!ativo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com o "relógio" da animação (prop externa `ativo`), não é fetch de dados
      setDisplay(valorFinal.toLocaleString("pt-BR"));
      return;
    }
    const unsubscribe = texto.on("change", setDisplay);
    const controls = animate(motionVal, valorFinal, { duration: duracao, delay, ease: "easeOut" });
    return () => {
      unsubscribe();
      controls.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinicia só quando os parâmetros da animação mudam
  }, [valorFinal, ativo, duracao, delay]);

  return display;
}

/**
 * Componente próprio para o tipo "texto" — os hooks de typing/counter precisam
 * rodar incondicionalmente no topo de UM componente (regra dos hooks do React),
 * o que não é possível dentro de um `case` de switch dentro de RenderComponente.
 */
function TextoAnimado({ componente }: { componente: TextoComponente }) {
  const anim = componente.animacao?.entrada;
  const Tag = componente.tag;
  const ehTyping = anim?.tipo === "typing";
  const ehCounter = anim?.tipo === "counter";
  const textoTyping = useTypingText(componente.texto, ehTyping, anim?.velocidadeDigitacao ?? 20);
  const textoComoNumero = Number(componente.texto);
  const valorFinalCounter = anim?.valorFinal ?? (Number.isFinite(textoComoNumero) ? textoComoNumero : 0);
  const textoCounter = useCounterValue(valorFinalCounter, ehCounter, anim?.duracao ?? 1, anim?.delay ?? 0);
  const textoFinal = ehTyping ? textoTyping : ehCounter ? textoCounter : componente.texto;

  const conteudo = (
    <Tag
      style={{
        color: componente.corTexto,
        fontSize: componente.fontSize,
        fontWeight: componente.fontWeight === "bold" ? 700 : 400,
        textAlign: componente.alinhamento ?? "left",
        width: "100%",
        height: "100%",
        margin: 0,
      }}
    >
      {textoFinal}
    </Tag>
  );

  // typing/counter já controlam sua própria revelação — não envolver de novo com fade/slide genérico.
  return ehTyping || ehCounter ? conteudo : <AnimacaoWrapper animacao={anim}>{conteudo}</AnimacaoWrapper>;
}

/**
 * Única função que traduz 1 nó do JSON (ComponenteSlide) em JSX.
 * Recursiva para card/grid.filhos. Genérica de propósito: reutilizada pelo Editor
 * (via ComponenteNoCanvas, que a envolve com seleção/drag) e futuramente pelo
 * Modo Apresentação e Export (Onda 6) — nunca duplicar esta lógica em outro lugar.
 *
 * Animação (Onda 3): aplicada de forma puramente declarativa a partir de
 * `componente.animacao?.entrada` — se ausente (todo dado das Ondas 1/2), o
 * componente renderiza estático, sem regressão visual.
 */
export function RenderComponente({ componente }: { componente: ComponenteSlide }) {
  const anim = componente.animacao?.entrada;

  switch (componente.tipo) {
    case "texto":
      return <TextoAnimado componente={componente} />;

    case "imagem":
      return (
        <AnimacaoWrapper animacao={anim}>
          {componente.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- RenderEngine é genérico (também roda no Export estático da Onda 6), sem acesso garantido ao otimizador do next/image fora do App Router
            <img
              src={componente.url}
              alt={componente.alt ?? ""}
              style={{ width: "100%", height: "100%", objectFit: componente.objectFit ?? "cover", display: "block" }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-800/50 text-slate-600 text-xs">
              Sem imagem
            </div>
          )}
        </AnimacaoWrapper>
      );

    case "botao":
      return (
        <AnimacaoWrapper animacao={anim}>
          <button
            type="button"
            style={{
              width: "100%",
              height: "100%",
              background: componente.corFundo ?? "#4f46e5",
              color: componente.corTexto ?? "#ffffff",
              borderRadius: componente.borderRadius ?? 8,
              border: "none",
              cursor: "default",
              fontWeight: 600,
            }}
          >
            {componente.texto}
          </button>
        </AnimacaoWrapper>
      );

    case "card":
      return (
        <AnimacaoWrapper animacao={anim}>
          <FilhosContainer
            style={{
              background: componente.corFundo ?? "transparent",
              borderRadius: componente.borderRadius ?? 0,
              padding: componente.padding ?? 0,
              position: "relative",
              overflow: "hidden",
            }}
            filhos={componente.filhos}
            usaStagger={anim?.tipo === "stagger"}
            staggerDelay={anim?.staggerDelay ?? 0.1}
          />
        </AnimacaoWrapper>
      );

    case "grid":
      return (
        <AnimacaoWrapper animacao={anim}>
          <FilhosContainer
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${componente.colunas}, 1fr)`,
              gap: componente.gap ?? 0,
            }}
            filhos={componente.filhos}
            usaStagger={anim?.tipo === "stagger"}
            staggerDelay={anim?.staggerDelay ?? 0.1}
          />
        </AnimacaoWrapper>
      );

    case "icone": {
      const candidato = (LucideIcons as unknown as Record<string, unknown>)[componente.nomeIcone];
      const IconeComponente = typeof candidato === "function" ? (candidato as LucideIcon) : Sparkles;
      return (
        <AnimacaoWrapper animacao={anim}>
          <div className="flex h-full w-full items-center justify-center">
            <IconeComponente size={componente.tamanhoIcone ?? 32} color={componente.cor ?? "currentColor"} aria-hidden="true" />
          </div>
        </AnimacaoWrapper>
      );
    }

    case "divisor":
      return (
        <AnimacaoWrapper animacao={anim}>
          <div style={{ width: "100%", height: componente.espessura ?? 2, background: componente.cor ?? "#ffffff33" }} />
        </AnimacaoWrapper>
      );

    case "globo":
      return (
        <AnimacaoWrapper animacao={anim}>
          <GloboRender componente={componente} />
        </AnimacaoWrapper>
      );

    case "particulas":
      return (
        <AnimacaoWrapper animacao={anim}>
          <ParticulasRender componente={componente} />
        </AnimacaoWrapper>
      );

    case "objeto3d":
      return (
        <AnimacaoWrapper animacao={anim}>
          <ObjetoGlbRender componente={componente} />
        </AnimacaoWrapper>
      );

    default:
      return null;
  }
}

const staggerContainerVariants = (staggerDelay: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: staggerDelay } },
});
const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

/** Container de filhos de card/grid — quando a animação do pai é "stagger", cada filho anima em cascata. */
function FilhosContainer({
  style,
  filhos,
  usaStagger,
  staggerDelay,
}: {
  style: React.CSSProperties;
  filhos: ComponenteSlide[];
  usaStagger: boolean;
  staggerDelay: number;
}) {
  if (usaStagger) {
    return (
      <motion.div style={{ width: "100%", height: "100%", ...style }} initial="hidden" animate="show" variants={staggerContainerVariants(staggerDelay)}>
        {filhos.map((filho) => (
          <motion.div
            key={filho.id}
            variants={staggerItemVariants}
            style={{ position: style.display === "grid" ? "relative" : "absolute", left: filho.x, top: filho.y, width: filho.w, height: filho.h, zIndex: filho.zIndex }}
          >
            <RenderComponente componente={filho} />
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", ...style }}>
      {filhos.map((filho) => (
        <div
          key={filho.id}
          style={{ position: style.display === "grid" ? "relative" : "absolute", left: filho.x, top: filho.y, width: filho.w, height: filho.h, zIndex: filho.zIndex }}
        >
          <RenderComponente componente={filho} />
        </div>
      ))}
    </div>
  );
}
