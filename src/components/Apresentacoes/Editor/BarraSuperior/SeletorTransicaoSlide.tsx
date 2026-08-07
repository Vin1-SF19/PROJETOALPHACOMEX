"use client";

import { Shuffle } from "lucide-react";
import { useEditorStore } from "../store/useEditorStore";
import { TRANSICAO_BASICA_TIPOS, type TransicaoBasicaTipo } from "@/lib/apresentacoes/transicoes/catalogo";

/**
 * Fase 05 (Alpha Motion) — PRIMEIRA UI do editor para escolher a transição do slide.
 * `Slide.transicaoEntrada` (coluna Prisma) existia desde a Onda 1, mas nunca era editada
 * por nenhum fluxo do usuário — este seletor fecha essa lacuna.
 *
 * Cobre só as 10 transições Básicas (catálogo completo em
 * `src/lib/apresentacoes/transicoes/catalogo.ts`). Push/Wipe/Zoom cinematográfico/Background
 * Crossfade já têm catálogo e lógica prontos (Echo), mas exigem parâmetros ricos
 * (`SlideTransition.direction`/`intensity`/`backgroundMode`) — UI de configuração desses
 * fica para uma fase futura (não implementada aqui, evitando uma UI incompleta/apressada).
 */
const LABEL_TRANSICAO: Record<TransicaoBasicaTipo, string> = {
  none: "Nenhuma",
  fade: "Fade",
  crossfade: "Crossfade",
  dissolve: "Dissolver",
  "slide-left": "Deslizar da Direita",
  "slide-right": "Deslizar da Esquerda",
  "slide-up": "Deslizar de Baixo",
  "slide-down": "Deslizar de Cima",
  "zoom-in": "Aproximar",
  "zoom-out": "Afastar",
};

export function SeletorTransicaoSlide() {
  const transicaoEntrada = useEditorStore((s) => s.transicaoEntrada);
  const atualizarTransicaoSlide = useEditorStore((s) => s.atualizarTransicaoSlide);

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-slate-900/60 px-2 py-1">
      <Shuffle size={13} className="shrink-0 text-slate-500" aria-hidden="true" />
      <label htmlFor="seletor-transicao-slide" className="sr-only">
        Transição do slide
      </label>
      <select
        id="seletor-transicao-slide"
        value={transicaoEntrada ?? "none"}
        onChange={(e) => atualizarTransicaoSlide(e.target.value === "none" ? null : e.target.value)}
        className="cursor-pointer bg-transparent text-[11px] text-slate-400 outline-none hover:text-white"
      >
        {TRANSICAO_BASICA_TIPOS.map((tipo) => (
          <option key={tipo} value={tipo} className="bg-slate-900 text-white">
            {LABEL_TRANSICAO[tipo]}
          </option>
        ))}
      </select>
    </div>
  );
}
