"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ZoomIn, ZoomOut, Loader2, Check, Palette } from "lucide-react";
import { useEditorStore } from "../store/useEditorStore";
import { SeletorTema } from "./SeletorTema";
import type { TemaResumo } from "../ApresentacaoEditor";

interface BarraSuperiorEditorProps {
  titulo: string;
  apresentacaoId: string;
  temaAtualId: string | null;
  onTemaAplicado: (tema: TemaResumo | null) => void;
}

export function BarraSuperiorEditor({ titulo, apresentacaoId, temaAtualId, onTemaAplicado }: BarraSuperiorEditorProps) {
  const router = useRouter();
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const [tituloLocal, setTituloLocal] = useState(titulo);
  const [seletorTemaAberto, setSeletorTemaAberto] = useState(false);

  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-slate-950/80 px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/PainelAlpha/Apresentacoes")}
          aria-label="Voltar ao painel de apresentações"
          className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <input
          value={tituloLocal}
          onChange={(e) => setTituloLocal(e.target.value)}
          aria-label="Título da apresentação"
          className="bg-transparent text-sm font-bold text-white outline-none focus:underline"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setSeletorTemaAberto(true)}
          aria-label="Escolher tema"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/5 bg-slate-900/60 px-3 py-1.5 text-[11px] text-slate-400 hover:border-white/10 hover:text-white"
        >
          <Palette size={13} aria-hidden="true" /> Tema
        </button>

        <div className="flex items-center gap-1 text-[11px] text-slate-500" aria-live="polite">
          {isSaving ? (
            <>
              <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Salvando...
            </>
          ) : isDirty ? (
            "Alterações não salvas"
          ) : (
            <>
              <Check size={12} className="text-emerald-500" aria-hidden="true" /> Salvo
            </>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-slate-900/60 px-1.5 py-1">
          <button
            onClick={() => setZoom(zoom - 0.25)}
            aria-label="Diminuir zoom"
            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <ZoomOut size={14} aria-hidden="true" />
          </button>
          <span className="w-10 text-center text-[11px] text-slate-400">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(zoom + 0.25)}
            aria-label="Aumentar zoom"
            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <ZoomIn size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <SeletorTema
        open={seletorTemaAberto}
        onOpenChange={setSeletorTemaAberto}
        apresentacaoId={apresentacaoId}
        temaAtualId={temaAtualId}
        onTemaAplicado={onTemaAplicado}
      />
    </div>
  );
}
