"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ZoomIn, ZoomOut, Loader2, Check, Palette, WandSparkles, Play, Boxes, Download, Wand2, Undo2, Redo2 } from "lucide-react";
import { useEditorStore } from "../store/useEditorStore";
import { SeletorTema } from "./SeletorTema";
import { SeletorTransicaoSlide } from "./SeletorTransicaoSlide";
import { ModalGerarComIA } from "./ModalGerarComIA";
import { ModalAplicarPreset } from "./ModalAplicarPreset";
import { ToggleReducedMotionSimulado } from "../ReducedMotionSimuladoContext";
import type { TemaResumo } from "../ApresentacaoEditor";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { AssetApresentacao } from "@/lib/apresentacoes/assets";
import { CentralCriativaModal } from "../CentralCriativa/CentralCriativaModal";
import { ModalExportarApresentacao } from "./ModalExportarApresentacao";

interface BarraSuperiorEditorProps {
  titulo: string;
  apresentacaoId: string;
  slugPublicoInicial: string | null;
  aguardarAntesDeExportar: () => Promise<void>;
  temaAtualId: string | null;
  onTemaAplicado: (tema: TemaResumo | null) => void;
  onSlideGeradoAplicado: (componentes: ComponenteSlide[]) => void;
  onApresentar: () => void;
  abrindoApresentacao: boolean;
  assetsIniciais: AssetApresentacao[];
  temaAtual: TemaResumo | null;
}

export function BarraSuperiorEditor({
  titulo,
  apresentacaoId,
  slugPublicoInicial,
  aguardarAntesDeExportar,
  temaAtualId,
  onTemaAplicado,
  onSlideGeradoAplicado,
  onApresentar,
  abrindoApresentacao,
  assetsIniciais,
  temaAtual,
}: BarraSuperiorEditorProps) {
  const router = useRouter();
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const podeDesfazer = useEditorStore((s) => s.historicoPassado.length > 0);
  const podeRefazer = useEditorStore((s) => s.historicoFuturo.length > 0);
  const desfazer = useEditorStore((s) => s.desfazer);
  const refazer = useEditorStore((s) => s.refazer);
  const [tituloLocal, setTituloLocal] = useState(titulo);
  const [seletorTemaAberto, setSeletorTemaAberto] = useState(false);
  const [modalIAAberto, setModalIAAberto] = useState(false);
  const [centralCriativaAberta, setCentralCriativaAberta] = useState(false);
  const [modalExportarAberto, setModalExportarAberto] = useState(false);
  const [modalPresetAberto, setModalPresetAberto] = useState(false);

  return (
    <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-white/5 bg-slate-950/80 px-2 py-2 lg:flex-nowrap lg:px-4">
      <div className="flex min-w-[160px] max-w-[240px] flex-1 items-center gap-2 lg:shrink-0">
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
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none focus:underline"
        />
      </div>

      <div className="flex min-w-0 basis-full items-center gap-2 overflow-x-auto lg:ml-auto lg:basis-auto">
        <div className="flex items-center rounded-lg border border-white/5 bg-slate-900/60 p-0.5" role="group" aria-label="Histórico de edição">
          <button
            type="button"
            onClick={desfazer}
            disabled={!podeDesfazer}
            title="Desfazer (Ctrl+Z)"
            aria-label="Desfazer última mudança"
            className="cursor-pointer rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Undo2 size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={refazer}
            disabled={!podeRefazer}
            title="Refazer (Ctrl+Y)"
            aria-label="Refazer mudança"
            className="cursor-pointer rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Redo2 size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/5 bg-slate-900/60 px-1.5 py-1">
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

        <button
          onClick={() => setCentralCriativaAberta(true)}
          aria-label="Abrir Central Criativa"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-medium text-indigo-200 hover:bg-indigo-500/20"
        >
          <Boxes size={13} aria-hidden="true" /> <span className="hidden 2xl:inline">Central Criativa</span>
        </button>

        <button
          onClick={onApresentar}
          disabled={abrindoApresentacao}
          aria-label="Abrir reprodução da apresentação"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60"
        >
          {abrindoApresentacao ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
          <span className="hidden xl:inline">Apresentar</span>
        </button>

        <button
          onClick={() => setModalExportarAberto(true)}
          aria-label="Abrir opções de exportação"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/5 bg-slate-900/60 px-3 py-1.5 text-[11px] text-slate-400 hover:border-white/10 hover:text-white"
        >
          <Download size={13} aria-hidden="true" /> <span className="hidden 2xl:inline">Exportar</span>
        </button>

        <button
          onClick={() => setModalIAAberto(true)}
          aria-label="Gerar slide com IA"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/5 bg-slate-900/60 px-3 py-1.5 text-[11px] text-slate-400 hover:border-white/10 hover:text-white"
        >
          <WandSparkles size={13} aria-hidden="true" /> <span className="hidden 2xl:inline">Gerar com IA</span>
        </button>

        <button
          onClick={() => setSeletorTemaAberto(true)}
          aria-label="Escolher tema"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/5 bg-slate-900/60 px-3 py-1.5 text-[11px] text-slate-400 hover:border-white/10 hover:text-white"
        >
          <Palette size={13} aria-hidden="true" /> <span className="hidden 2xl:inline">Tema</span>
        </button>

        <SeletorTransicaoSlide />

        <button
          onClick={() => setModalPresetAberto(true)}
          aria-label="Aplicar preset de animação"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/5 bg-slate-900/60 px-3 py-1.5 text-[11px] text-slate-400 hover:border-white/10 hover:text-white"
        >
          <Wand2 size={13} aria-hidden="true" /> <span className="hidden 2xl:inline">Presets</span>
        </button>

        <ToggleReducedMotionSimulado />

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

      </div>

      <SeletorTema
        open={seletorTemaAberto}
        onOpenChange={setSeletorTemaAberto}
        apresentacaoId={apresentacaoId}
        temaAtualId={temaAtualId}
        onTemaAplicado={onTemaAplicado}
      />

      <ModalGerarComIA
        open={modalIAAberto}
        onOpenChange={setModalIAAberto}
        apresentacaoId={apresentacaoId}
        onAplicar={onSlideGeradoAplicado}
      />

      <CentralCriativaModal
        open={centralCriativaAberta}
        onOpenChange={setCentralCriativaAberta}
        apresentacaoId={apresentacaoId}
        titulo={tituloLocal}
        assetsIniciais={assetsIniciais}
        temaAtual={temaAtual}
        onTemaAplicado={onTemaAplicado}
      />

      <ModalAplicarPreset open={modalPresetAberto} onOpenChange={setModalPresetAberto} />
      <ModalExportarApresentacao
        open={modalExportarAberto}
        onOpenChange={setModalExportarAberto}
        apresentacaoId={apresentacaoId}
        titulo={tituloLocal}
        slugPublicoInicial={slugPublicoInicial}
        aguardarAntesDeExportar={aguardarAntesDeExportar}
      />
    </div>
  );
}
