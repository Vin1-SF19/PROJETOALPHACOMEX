"use client";

import { useState } from "react";
import { Download, FileJson, ImageDown, Loader2, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { CANVAS_PADRAO, FORMATOS_CANVAS, canvasConfigSchema } from "@/lib/apresentacoes/canvas";
import type { AssetApresentacao } from "@/lib/apresentacoes/assets";
import { exportarCanvasComoPng, exportarSlideComoJson } from "@/lib/apresentacoes/exportacao";
import { useEditorStore } from "../store/useEditorStore";

interface ResizeExportPanelProps {
  titulo: string;
  temaId: string | null;
  assets: AssetApresentacao[];
}

function proximoFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export function ResizeExportPanel({ titulo, temaId, assets }: ResizeExportPanelProps) {
  const canvas = useEditorStore((state) => state.canvas);
  const componentes = useEditorStore((state) => state.componentes);
  const redimensionarCanvas = useEditorStore((state) => state.redimensionarCanvas);
  const atualizarFundoCanvas = useEditorStore((state) => state.atualizarFundoCanvas);
  const selecionarComponente = useEditorStore((state) => state.selecionarComponente);
  const [largura, setLargura] = useState(canvas.width);
  const [altura, setAltura] = useState(canvas.height);
  const [escalaExportacao, setEscalaExportacao] = useState(2);
  const [exportando, setExportando] = useState(false);

  function aplicarDimensoes(width: number, height: number) {
    const validacao = canvasConfigSchema.safeParse({ width, height, backgroundColor: canvas.backgroundColor, backgroundImage: canvas.backgroundImage });
    if (!validacao.success) {
      toast.error("Use dimensões entre 320 e 3840 pixels.");
      return;
    }
    redimensionarCanvas(validacao.data);
    setLargura(width);
    setAltura(height);
    toast.success(`Canvas alterado para ${width} × ${height}; conteúdo redimensionado proporcionalmente.`);
  }

  async function handleExportarPng() {
    setExportando(true);
    selecionarComponente(null);
    try {
      await proximoFrame();
      await exportarCanvasComoPng(titulo, escalaExportacao);
      toast.success("PNG exportado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível exportar o PNG.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-5 overflow-y-auto pr-1 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <div><h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Maximize2 size={16} className="text-indigo-400" /> Magic Resize</h3><p className="mt-1 text-xs text-slate-500">Troca o formato e preserva proporções, hierarquia e posição relativa.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {FORMATOS_CANVAS.map((formato) => {
            const ativo = canvas.width === formato.width && canvas.height === formato.height;
            return <button key={formato.id} onClick={() => aplicarDimensoes(formato.width, formato.height)} className={`rounded-xl border p-3 text-left transition-colors ${ativo ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/10 bg-slate-950/50 hover:border-white/20"}`}><span className="block text-xs font-semibold text-slate-200">{formato.nome}</span><span className="mt-1 block text-[10px] text-slate-500">{formato.width} × {formato.height} · {formato.descricao}</span></button>;
          })}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="space-y-1.5 text-xs text-slate-400">Largura<input type="number" min={320} max={3840} value={largura} onChange={(event) => setLargura(Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" /></label>
          <span className="pb-2 text-slate-600">×</span>
          <label className="space-y-1.5 text-xs text-slate-400">Altura<input type="number" min={320} max={3840} value={altura} onChange={(event) => setAltura(Number(event.target.value))} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" /></label>
        </div>
        <button onClick={() => aplicarDimensoes(largura, altura)} className="w-full rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20">Aplicar formato personalizado</button>
        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-400">Cor de fundo do slide<input type="color" value={canvas.backgroundColor} onChange={(event) => atualizarFundoCanvas(event.target.value)} className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent" /></label>
        <button onClick={() => aplicarDimensoes(CANVAS_PADRAO.width, CANVAS_PADRAO.height)} className="text-xs text-slate-500 underline-offset-4 hover:text-white hover:underline">Restaurar 1280 × 720</button>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <div><h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Download size={16} className="text-indigo-400" /> Exportar</h3><p className="mt-1 text-xs text-slate-500">Baixe o slide atual como imagem ou pacote editável.</p></div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-200">PNG em alta resolução</p><p className="mt-1 text-[10px] text-slate-500">Captura o quadro atual de vídeos e elementos 3D.</p></div><ImageDown size={22} className="text-slate-500" /></div>
          <div className="mb-3 grid grid-cols-3 gap-2">{[1, 2, 3].map((escala) => <button key={escala} onClick={() => setEscalaExportacao(escala)} className={`rounded-lg border py-2 text-xs ${escalaExportacao === escala ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-200" : "border-white/10 text-slate-500 hover:text-white"}`}>{escala}×</button>)}</div>
          <button onClick={() => void handleExportarPng()} disabled={exportando} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">{exportando ? <Loader2 size={16} className="animate-spin" /> : <ImageDown size={16} />} {exportando ? "Renderizando..." : `Baixar PNG ${escalaExportacao}×`}</button>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-200">Pacote JSON editável</p><p className="mt-1 text-[10px] text-slate-500">Inclui canvas, componentes e referências dos assets.</p></div><FileJson size={22} className="text-slate-500" /></div>
          <button onClick={() => exportarSlideComoJson({ titulo, canvas, componentes, assets, temaId })} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5"><FileJson size={16} /> Baixar JSON</button>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-600">Imagens externas sem permissão CORS podem impedir a captura PNG. Arquivos enviados pela Biblioteca Alpha já são compatíveis.</p>
      </section>
    </div>
  );
}
