"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, TriangleAlert, X, RotateCcw, FileWarning } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { RenderComponente } from "@/components/Apresentacoes/Editor/RenderEngine/RenderComponente";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { CanvasConfig } from "@/lib/apresentacoes/canvas";

interface SlideExtraidoPreview {
  componentes: ComponenteSlide[];
}

interface ModalPreImportarPptxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apresentacaoId: string;
  arquivo: File | null;
  onImportado: () => void;
}

type Status = "carregando" | "pronto" | "erro";

const LARGURA_THUMBNAIL = 220;

/** 1 slide em miniatura — mesma técnica de palco escalado do Modo Apresentação (canvas em
 * tamanho real, `transform: scale()` pra caber na miniatura), renderizando os componentes de
 * verdade via `RenderComponente` — não é uma simulação, é o mesmo motor de render do editor. */
function ThumbnailSlide({ componentes, canvas }: { componentes: ComponenteSlide[]; canvas: CanvasConfig }) {
  const escala = LARGURA_THUMBNAIL / canvas.width;
  const altura = Math.round(canvas.height * escala);

  return (
    <div
      className="relative overflow-hidden rounded-md"
      style={{ width: LARGURA_THUMBNAIL, height: altura, backgroundColor: canvas.backgroundColor }}
    >
      <div style={{ width: canvas.width, height: canvas.height, transform: `scale(${escala})`, transformOrigin: "top left", position: "relative" }}>
        {componentes.map((c) => (
          <div key={c.id} style={{ position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, zIndex: c.zIndex }}>
            <RenderComponente componente={c} modo="apresentacao" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Pré-importador do PPTX: mostra o que o parser extraiu de cada slide (via `RenderComponente`
 * de verdade, não um resumo em texto) ANTES de gravar qualquer coisa no banco. Usuário pode
 * remover slides individuais e só então confirmar ou cancelar — cancelar não deixa nenhum
 * resíduo (a prévia nunca fez upload de imagem nem criou Slide).
 */
export function ModalPreImportarPptx({ open, onOpenChange, apresentacaoId, arquivo, onImportado }: ModalPreImportarPptxProps) {
  const [status, setStatus] = useState<Status>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [slides, setSlides] = useState<SlideExtraidoPreview[]>([]);
  const [canvas, setCanvas] = useState<CanvasConfig | null>(null);
  const [ignorados, setIgnorados] = useState<Record<string, number>>({});
  const [excluidos, setExcluidos] = useState<Set<number>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const arquivoRef = useRef<File | null>(null);

  useEffect(() => {
    arquivoRef.current = arquivo;
  }, [arquivo]);

  useEffect(() => {
    if (!open || !arquivo) return;
    let cancelado = false;

    (async () => {
      setStatus("carregando");
      setErro(null);
      setExcluidos(new Set());
      try {
        const formData = new FormData();
        formData.append("file", arquivo);
        const resposta = await fetch(`/api/apresentacoes/${apresentacaoId}/pptx-preview`, { method: "POST", body: formData });
        const resultado = await resposta.json().catch(() => null);
        if (cancelado) return;

        if (!resposta.ok || !resultado?.success) {
          setErro(typeof resultado?.error === "string" ? resultado.error : "Erro ao gerar a prévia do PowerPoint.");
          setStatus("erro");
          return;
        }

        setSlides(resultado.data.slides);
        setCanvas(resultado.data.canvas);
        setIgnorados(resultado.data.ignorados ?? {});
        setStatus("pronto");
      } catch {
        if (cancelado) return;
        setErro("Erro de conexão ao gerar a prévia do PowerPoint.");
        setStatus("erro");
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [open, arquivo, apresentacaoId]);

  function alternarExclusao(indice: number) {
    setExcluidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(indice)) novo.delete(indice);
      else novo.add(indice);
      return novo;
    });
  }

  async function handleConfirmar() {
    const arquivoAtual = arquivoRef.current;
    if (!arquivoAtual || confirmando) return;
    setConfirmando(true);
    try {
      const formData = new FormData();
      formData.append("file", arquivoAtual);
      formData.append("excluirIndices", JSON.stringify(Array.from(excluidos)));
      const resposta = await fetch(`/api/apresentacoes/${apresentacaoId}/importar-pptx`, { method: "POST", body: formData });
      const resultado = await resposta.json().catch(() => null);

      if (!resposta.ok || !resultado?.success) {
        toast.error(typeof resultado?.error === "string" ? resultado.error : "Erro ao importar o PowerPoint.");
        return;
      }

      const { slidesCriados, ignorados: ignoradosFinal, errosDeImagem } = resultado.data as {
        slidesCriados: number;
        ignorados: Record<string, number>;
        errosDeImagem: string[];
      };
      const totalIgnorados = Object.values(ignoradosFinal ?? {}).reduce((soma, n) => soma + n, 0);
      toast.success(`${slidesCriados} slide${slidesCriados === 1 ? "" : "s"} importado${slidesCriados === 1 ? "" : "s"} do PowerPoint.`);
      if (totalIgnorados > 0 || errosDeImagem?.length > 0) {
        const detalhes = Object.entries(ignoradosFinal ?? {}).map(([motivo, n]) => `${motivo} (${n})`).join(", ");
        toast.warning(
          `${totalIgnorados > 0 ? `${totalIgnorados} elemento(s) não puderam ser convertidos: ${detalhes}.` : ""}`
          + `${errosDeImagem?.length ? ` ${errosDeImagem.length} imagem(ns) falharam no upload.` : ""}`,
          { duration: 8000 },
        );
      }

      onOpenChange(false);
      onImportado();
    } catch {
      toast.error("Erro de conexão ao importar o PowerPoint.");
    } finally {
      setConfirmando(false);
    }
  }

  const totalRestante = slides.length - excluidos.size;
  const totalIgnoradosPreview = Object.values(ignorados).reduce((soma, n) => soma + n, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !confirmando && onOpenChange(v)}>
      <DialogContent className="flex max-h-[85vh] w-[min(96vw,1100px)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-white/10 bg-slate-950 p-0 sm:max-w-none">
        <DialogTitle className="border-b border-white/5 px-5 py-4 text-sm font-bold text-white">
          Importar PowerPoint
        </DialogTitle>
        <DialogDescription className="sr-only">
          Prévia dos slides extraídos do arquivo PowerPoint antes de confirmar a importação.
        </DialogDescription>

        {status === "carregando" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <Loader2 size={24} className="animate-spin" aria-hidden="true" />
            <p className="text-sm">Analisando o arquivo…</p>
          </div>
        )}

        {status === "erro" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center text-slate-300">
            <TriangleAlert size={24} className="text-amber-400" aria-hidden="true" />
            <p className="max-w-md text-sm">{erro}</p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:border-white/20 hover:text-white"
            >
              Fechar
            </button>
          </div>
        )}

        {status === "pronto" && canvas && (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-2.5 text-xs text-slate-400">
              <span>{slides.length} slide{slides.length === 1 ? "" : "s"} encontrado{slides.length === 1 ? "" : "s"}</span>
              {totalIgnoradosPreview > 0 && (
                <span className="flex items-center gap-1.5 text-amber-400">
                  <FileWarning size={13} aria-hidden="true" />
                  {totalIgnoradosPreview} elemento(s) não puderam ser convertidos — {Object.entries(ignorados).map(([m, n]) => `${m} (${n})`).join(", ")}
                </span>
              )}
            </div>

            <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 overflow-y-auto p-5">
              {slides.map((slide, indice) => {
                const excluido = excluidos.has(indice);
                return (
                  <div key={indice} className="flex flex-col gap-1.5">
                    <div
                      className={`relative rounded-md border transition-opacity ${excluido ? "border-white/5 opacity-35" : "border-white/10"}`}
                    >
                      <ThumbnailSlide componentes={slide.componentes} canvas={canvas} />
                      <button
                        type="button"
                        onClick={() => alternarExclusao(indice)}
                        aria-label={excluido ? `Manter slide ${indice + 1}` : `Remover slide ${indice + 1}`}
                        title={excluido ? "Manter este slide" : "Remover este slide"}
                        className="absolute right-1.5 top-1.5 flex size-6 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90"
                      >
                        {excluido ? <RotateCcw size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
                      </button>
                    </div>
                    <span className="text-center text-[11px] text-slate-500">Slide {indice + 1}{excluido ? " (removido)" : ""}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/5 px-5 py-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={confirmando}
                className="cursor-pointer rounded-lg border border-white/10 bg-slate-900/60 px-4 py-2 text-xs text-slate-300 hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmar()}
                disabled={confirmando || totalRestante === 0}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {confirmando && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                Confirmar importação ({totalRestante})
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
