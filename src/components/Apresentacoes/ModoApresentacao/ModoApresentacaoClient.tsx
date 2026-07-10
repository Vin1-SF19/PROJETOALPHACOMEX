"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RenderComponente } from "@/components/Apresentacoes/Editor/RenderEngine/RenderComponente";
import { stylePosicaoAbsoluta } from "@/components/Apresentacoes/Editor/RenderEngine/posicionamento";
import { TransicaoSlide } from "./TransicaoSlide";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

const SLIDE_W = 1280;
const SLIDE_H = 720;

interface SlideApresentacao {
  id: string;
  transicaoEntrada: string | null;
  componentes: ComponenteSlide[];
}

interface TemaApresentacao {
  id: string;
  nome: string;
  corPrimaria: string;
  corSecundaria: string;
  corAccent: string;
}

interface ModoApresentacaoClientProps {
  apresentacaoId: string;
  slides: SlideApresentacao[];
  tema: TemaApresentacao | null;
}

export function ModoApresentacaoClient({ apresentacaoId, slides, tema }: ModoApresentacaoClientProps) {
  const router = useRouter();
  const [indiceAtual, setIndiceAtual] = useState(0);
  const slideAtual = slides[indiceAtual];

  function proximoSlide() {
    setIndiceAtual((i) => Math.min(i + 1, slides.length - 1));
  }

  function slideAnterior() {
    setIndiceAtual((i) => Math.max(i - 1, 0));
  }

  function sair() {
    router.push(`/PainelAlpha/Apresentacoes/${apresentacaoId}/editor`);
  }

  // Navegação por teclado — subscription a evento do browser (não é fetch de dados, uso legítimo de useEffect).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        proximoSlide();
      } else if (e.key === "ArrowLeft") {
        slideAnterior();
      } else if (e.key === "Escape") {
        sair();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slides.length é estável (vem de props imutáveis desta sessão de apresentação)
  }, []);

  // Fullscreen nativo — melhor esforço, sem crítica se o browser negar/não suportar (rota já é full-page).
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {
      /* usuário pode ter negado, ou browser sem suporte — segue em modo full-page normal */
    });
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  if (!slideAtual) return null;

  return (
    <div
      onClick={(e) => {
        // Não avança se o clique foi em um elemento interativo do próprio slide (ex: botão do usuário).
        if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
        proximoSlide();
      }}
      className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-black"
      style={
        tema
          ? ({
              "--tema-cor-primaria": tema.corPrimaria,
              "--tema-cor-secundaria": tema.corSecundaria,
              "--tema-cor-accent": tema.corAccent,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className="relative shrink-0 bg-slate-900" style={{ width: SLIDE_W, height: SLIDE_H }}>
        <TransicaoSlide slideId={slideAtual.id} transicaoEntrada={slideAtual.transicaoEntrada}>
          {slideAtual.componentes.map((c) => (
            <div key={c.id} style={stylePosicaoAbsoluta(c)}>
              <RenderComponente componente={c} />
            </div>
          ))}
        </TransicaoSlide>
      </div>

      <div className="absolute bottom-4 right-4 rounded-full bg-black/50 px-3 py-1 text-xs text-white/70">
        {indiceAtual + 1} / {slides.length}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          sair();
        }}
        aria-label="Sair do modo apresentação"
        className="absolute right-4 top-4 cursor-pointer rounded-full bg-black/50 px-3 py-1.5 text-xs text-white/70 hover:bg-black/70 hover:text-white"
      >
        Esc para sair
      </button>
    </div>
  );
}
