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
import { pilhaCssDaFonte } from "@/lib/apresentacoes/pptx/texto";
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

  const vertical = componente.verticalAlign === "middle" ? "center" : componente.verticalAlign === "bottom" ? "flex-end" : "flex-start";
  const alinhamentoTexto = componente.alinhamento ?? "left";
  const richContent = componente.richText?.paragraphs.map((paragraph, paragraphIndex) => {
    const alinhamentoParagrafo = paragraph.alignment ?? alinhamentoTexto;

    return (
      <span
        key={paragraphIndex}
        style={{
          display: "block",
          width: "100%",
          textAlign: alinhamentoParagrafo,
          textAlignLast: alinhamentoParagrafo === "justify" ? "justify" : undefined,
          marginLeft: paragraph.marginLeft,
          textIndent: paragraph.indent,
          lineHeight: paragraph.lineSpacing ? `${paragraph.lineSpacing}%` : undefined,
          marginTop: paragraph.spaceBefore,
          marginBottom: paragraph.spaceAfter,
        }}
      >
        {paragraph.bullet ? `${paragraph.bullet} ` : paragraph.numbering ? `${(paragraph.numbering.startAt ?? 1) + paragraphIndex}. ` : null}
        {paragraph.runs.map((run, runIndex) => {
          const style: React.CSSProperties = {
            fontFamily: pilhaCssDaFonte(run.fontFamily ?? componente.fontFamily),
            fontSize: run.fontSize ?? componente.fontSize,
            fontWeight: run.bold === undefined ? (componente.fontWeight === "bold" ? 700 : 400) : run.bold ? 700 : 400,
            fontStyle: run.italic === undefined ? componente.fontStyle : run.italic ? "italic" : "normal",
            textDecoration: [run.underline && run.underline !== "none" ? "underline" : "", run.strike && run.strike !== "noStrike" ? "line-through" : ""].filter(Boolean).join(" ") || undefined,
            color: run.color ?? componente.corTexto ?? "#ffffff",
            letterSpacing: run.tracking,
            verticalAlign: run.baseline ? `${run.baseline / 1000}%` : undefined,
            textTransform: run.caps === "all" ? "uppercase" : run.caps === "small" ? "lowercase" : undefined,
          };
          return <span key={runIndex} style={style}>{run.text}</span>;
        })}
        {paragraphIndex < (componente.richText?.paragraphs.length ?? 0) - 1 ? "\n" : null}
      </span>
    );
  });
  const conteudo = (
    <Tag
      style={{
        color: componente.corTexto ?? "#ffffff",
        fontSize: componente.fontSize ?? 16,
        fontWeight: componente.fontWeight === "bold" ? 700 : 400,
        textAlign: alinhamentoTexto,
        width: "100%",
        height: "100%",
        margin: 0,
        fontFamily: pilhaCssDaFonte(componente.fontFamily ?? "Inter"),
        fontStyle: componente.fontStyle,
        textDecoration: componente.textDecoration,
        lineHeight: componente.lineHeight,
        letterSpacing: componente.letterSpacing,
        padding: componente.padding
          ? `${componente.padding.top}px ${componente.padding.right}px ${componente.padding.bottom}px ${componente.padding.left}px`
          : undefined,
        display: "flex",
        flexDirection: "column",
        justifyContent: vertical,
        whiteSpace: componente.wrap === false ? "pre" : "pre-wrap",
        overflow: componente.autofit === "shape" ? "visible" : "hidden",
        boxSizing: "border-box",
      }}
    >
      {componente.richText && !ehTyping && !ehCounter ? (
        richContent
      ) : (
        <span
          style={{
            display: "block",
            width: "100%",
            textAlign: alinhamentoTexto,
            textAlignLast: alinhamentoTexto === "justify" ? "justify" : undefined,
          }}
        >
          {textoFinal}
        </span>
      )}
    </Tag>
  );

  // typing/counter já controlam sua própria revelação — não envolver de novo com fade/slide genérico.
  return ehTyping || ehCounter ? conteudo : <AnimacaoWrapper animacao={anim}>{conteudo}</AnimacaoWrapper>;
}

export function RenderImagem({ componente }: { componente: ImagemComponente }) {
  if (componente.tile && componente.url) {
    return <div role="img" aria-label={componente.alt ?? ""} style={{ width: "100%", height: "100%", backgroundImage: `url(${JSON.stringify(componente.url)})`, backgroundRepeat: "repeat" }} />;
  }
  if (componente.crop && componente.url) {
    const visibleWidth = Math.max(0.001, 1 - componente.crop.left - componente.crop.right);
    const visibleHeight = Math.max(0.001, 1 - componente.crop.top - componente.crop.bottom);
    return (
      <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- renderer compartilhado com export offline */}
        <img
          src={componente.url}
          alt={componente.alt ?? ""}
          loading="lazy"
          style={{
            position: "absolute",
            width: `${100 / visibleWidth}%`,
            height: `${100 / visibleHeight}%`,
            left: `${(-componente.crop.left / visibleWidth) * 100}%`,
            top: `${(-componente.crop.top / visibleHeight) * 100}%`,
            objectFit: "fill",
            display: "block",
          }}
        />
      </div>
    );
  }
  return componente.url ? (
    // eslint-disable-next-line @next/next/no-img-element -- RenderEngine é genérico (também roda no Export estático), sem acesso garantido ao otimizador do next/image fora do App Router
    <img
      src={componente.url}
      alt={componente.alt ?? ""}
      loading="lazy"
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
  const strokeDasharray = componente.estilo === "dot" ? "1 4" : componente.estilo === "dash" ? "8 5" : componente.estilo === "dashDot" ? "8 4 1 4" : undefined;
  const markerId = `pptx-arrow-${componente.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <marker id={`${markerId}-end`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={componente.cor ?? "#ffffff33"} /></marker>
        <marker id={`${markerId}-start`} markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto-start-reverse"><path d="M8,0 L0,4 L8,8 Z" fill={componente.cor ?? "#ffffff33"} /></marker>
      </defs>
      <line
        x1="0" y1="5" x2="100" y2="5"
        stroke={componente.cor ?? "#ffffff33"}
        strokeWidth={componente.espessura ?? 2}
        strokeLinecap={componente.cap ?? "butt"}
        strokeDasharray={strokeDasharray}
        markerStart={componente.beginArrow && componente.beginArrow !== "none" ? `url(#${markerId}-start)` : undefined}
        markerEnd={componente.endArrow && componente.endArrow !== "none" ? `url(#${markerId}-end)` : undefined}
      />
    </svg>
  );
}
