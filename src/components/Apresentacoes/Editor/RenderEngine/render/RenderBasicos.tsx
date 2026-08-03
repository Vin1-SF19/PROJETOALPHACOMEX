import { useEffect, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Sparkles, type LucideIcon } from "lucide-react";
import { useMotionValue, useTransform, animate } from "framer-motion";
import type {
  TextoComponente,
  ImagemComponente,
  VideoComponente,
  AudioComponente,
  BotaoComponente,
  IconeComponente,
  DivisorComponente,
} from "@/lib/validations/slide-componentes";
import { AnimacaoWrapper } from "../nucleo";

/**
 * Efeito de digitação: revela o texto caractere a caractere ao longo do tempo.
 * Usa useEffect+setInterval (não é fetch de dados — é sincronização com o
 * "relógio" da animação, caso legítimo de useEffect pelas regras do projeto).
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
 * rodar incondicionalmente no topo de UM componente (regra dos hooks do React).
 */
export function TextoAnimado({ componente }: { componente: TextoComponente }) {
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

export function RenderImagem({ componente }: { componente: ImagemComponente }) {
  return componente.url ? (
    // eslint-disable-next-line @next/next/no-img-element -- RenderEngine é genérico (também roda no Export estático), sem acesso garantido ao otimizador do next/image fora do App Router
    <img
      src={componente.url}
      alt={componente.alt ?? ""}
      style={{ width: "100%", height: "100%", objectFit: componente.objectFit ?? "cover", display: "block" }}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-slate-800/50 text-slate-600 text-xs">Sem imagem</div>
  );
}

export function RenderVideo({ componente }: { componente: VideoComponente }) {
  return componente.url ? (
    <video
      src={componente.url}
      autoPlay={componente.autoplay}
      loop={componente.loop}
      controls={componente.controles}
      muted={componente.muted}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-slate-800/50 text-slate-600 text-xs">Sem vídeo</div>
  );
}

export function RenderAudio({ componente }: { componente: AudioComponente }) {
  return componente.url ? (
    <div className="flex h-full w-full items-center gap-3 rounded-xl border border-white/10 bg-slate-950/80 px-4">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{componente.titulo}</span>
      <audio
        src={componente.url}
        autoPlay={componente.autoplay}
        loop={componente.loop}
        controls={componente.controles}
        className="h-10 min-w-0 flex-[2]"
      />
    </div>
  ) : (
    <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-800/50 text-xs text-slate-600">Sem áudio</div>
  );
}

export function RenderBotao({ componente }: { componente: BotaoComponente }) {
  return (
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
  );
}

export function RenderIcone({ componente }: { componente: IconeComponente }) {
  const candidato = (LucideIcons as unknown as Record<string, unknown>)[componente.nomeIcone];
  const IconeComponente = typeof candidato === "function" ? (candidato as LucideIcon) : Sparkles;
  return (
    <div className="flex h-full w-full items-center justify-center">
      <IconeComponente size={componente.tamanhoIcone ?? 32} color={componente.cor ?? "currentColor"} aria-hidden="true" />
    </div>
  );
}

export function RenderDivisor({ componente }: { componente: DivisorComponente }) {
  return <div style={{ width: "100%", height: componente.espessura ?? 2, background: componente.cor ?? "#ffffff33" }} />;
}
