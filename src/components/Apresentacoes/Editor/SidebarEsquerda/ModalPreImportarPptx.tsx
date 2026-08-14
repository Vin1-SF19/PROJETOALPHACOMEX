"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { upload } from "@vercel/blob/client";
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
import { stylePosicaoAbsoluta } from "@/components/Apresentacoes/Editor/RenderEngine/posicionamento";
import { resolverFontesNoDocumento, type FontSubstitution } from "@/lib/apresentacoes/pptx/texto";
import type { PptxDiagnosticEntry, PptxDiagnosticSeverity } from "@/lib/apresentacoes/pptx/diagnostico";
import { compararImagens } from "@/lib/apresentacoes/pptx/visual-diff";
import { toPng } from "html-to-image";
import { FontesPersonalizadasStyle } from "@/components/Apresentacoes/FontesPersonalizadasStyle";
import { useFontesPersonalizadas } from "@/components/Apresentacoes/Editor/FontesPersonalizadasContext";
import type { FontePersonalizada } from "@/lib/apresentacoes/fontes-personalizadas";

interface SlideExtraidoPreview {
  componentes: ComponenteSlide[];
  canvas?: CanvasConfig;
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
const PPTX_MAX_BYTES = 80 * 1024 * 1024;
const PPTX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

async function limparUploadsTemporarios(apresentacaoId: string, urls: string[]): Promise<void> {
  const unicas = Array.from(new Set(urls.filter(Boolean)));
  if (unicas.length === 0) return;
  await fetch(`/api/apresentacoes/${apresentacaoId}/pptx-upload`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: unicas }),
    keepalive: true,
  }).catch(() => undefined);
}

function caminhoDoUploadPptx(apresentacaoId: string, nome: string): string {
  const nomeSeguro = nome.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
  return `apresentacoes/${apresentacaoId}/originais/${crypto.randomUUID()}-${nomeSeguro || "apresentacao.pptx"}`;
}

/** 1 slide em miniatura — mesma técnica de palco escalado do Modo Apresentação (canvas em
 * tamanho real, `transform: scale()` pra caber na miniatura), renderizando os componentes de
 * verdade via `RenderComponente` — não é uma simulação, é o mesmo motor de render do editor.
 * Lazy-mount via `useInView`: um deck com muitos slides não pode montar dezenas de árvores de
 * componentes reais (imagens em resolução real, potencialmente 3D) todas de uma vez — mesma
 * causa raiz já corrigida na Dashboard (`CardApresentacao`/miniatura estática), aqui resolvida
 * só renderizando o slide quando ele está perto da viewport do modal. */
function ThumbnailSlide({ componentes, canvas, captureRef, onVisivel }: { componentes: ComponenteSlide[]; canvas: CanvasConfig; captureRef?: (node: HTMLDivElement | null) => void; onVisivel?: () => void }) {
  const escala = LARGURA_THUMBNAIL / canvas.width;
  const altura = Math.round(canvas.height * escala);
  const containerRef = useRef<HTMLDivElement>(null);
  const estaVisivel = useInView(containerRef, { margin: "300px" });

  useEffect(() => {
    if (estaVisivel) onVisivel?.();
  }, [estaVisivel, onVisivel]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-md"
      style={{ width: LARGURA_THUMBNAIL, height: altura, backgroundColor: canvas.backgroundColor, backgroundImage: canvas.backgroundImage }}
    >
      {estaVisivel && (
        <div
          ref={captureRef}
          style={{
            width: canvas.width,
            height: canvas.height,
            transform: `scale(${escala})`,
            transformOrigin: "top left",
            position: "relative",
            backgroundColor: canvas.backgroundColor,
            backgroundImage: canvas.backgroundImage,
          }}
        >
          {componentes.map((c) => (
            <div key={c.id} style={stylePosicaoAbsoluta(c)}>
              <RenderComponente componente={c} modo="apresentacao" />
            </div>
          ))}
        </div>
      )}
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
  const [fontes, setFontes] = useState<FontSubstitution[]>([]);
  const [fontesDetectadas, setFontesDetectadas] = useState<string[]>([]);
  const [fontesEmbutidas, setFontesEmbutidas] = useState<FontePersonalizada[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<PptxDiagnosticEntry[]>([]);
  const [resumoDiagnosticos, setResumoDiagnosticos] = useState<Record<PptxDiagnosticSeverity, number>>({ INFO: 0, WARNING: 0, FALLBACK: 0, ERROR: 0 });
  const [referenceImages, setReferenceImages] = useState<Array<{ slideNumber: number; url: string }>>([]);
  const [referenceRenderer, setReferenceRenderer] = useState<{ available: boolean; name?: string; reason?: string } | null>(null);
  const [visualDiffs, setVisualDiffs] = useState<Record<number, { importedUrl: string; diffUrl: string; similarity: number }>>({});
  const [slidesVisiveis, setSlidesVisiveis] = useState<Set<number>>(new Set());
  const diffCalculadoRef = useRef<Set<number>>(new Set());
  const captureRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [excluidos, setExcluidos] = useState<Set<number>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [progressoUpload, setProgressoUpload] = useState(0);
  const arquivoRef = useRef<File | null>(null);
  const originalUploadRef = useRef<string | null>(null);
  const previewAssetsRef = useRef<string[]>([]);
  const preservarOriginalRef = useRef(false);
  const { registrarFontes } = useFontesPersonalizadas();

  useEffect(() => {
    arquivoRef.current = arquivo;
  }, [arquivo]);

  useEffect(() => {
    if (!open || !arquivo) return;
    let cancelado = false;
    let urlEnviada: string | null = null;

    (async () => {
      setStatus("carregando");
      setProgressoUpload(0);
      setErro(null);
      setExcluidos(new Set());
      setVisualDiffs({});
      setSlidesVisiveis(new Set());
      diffCalculadoRef.current = new Set();
      setFontes([]);
      setFontesDetectadas([]);
      setFontesEmbutidas([]);
      try {
        if (!arquivo.name.toLowerCase().endsWith(".pptx")) throw new Error("Envie um arquivo .pptx (PowerPoint).");
        if (arquivo.size <= 0) throw new Error("O arquivo está vazio.");
        if (arquivo.size > PPTX_MAX_BYTES) throw new Error("O arquivo excede o limite de 80 MB.");

        preservarOriginalRef.current = false;
        originalUploadRef.current = null;
        previewAssetsRef.current = [];
        const blob = await upload(caminhoDoUploadPptx(apresentacaoId, arquivo.name), arquivo, {
          access: "public",
          contentType: PPTX_CONTENT_TYPE,
          multipart: true,
          handleUploadUrl: `/api/apresentacoes/${apresentacaoId}/pptx-upload`,
          onUploadProgress: ({ percentage }) => {
            if (!cancelado) setProgressoUpload(Math.round(percentage));
          },
        });
        urlEnviada = blob.url;
        if (cancelado) {
          await limparUploadsTemporarios(apresentacaoId, [blob.url]);
          return;
        }
        originalUploadRef.current = blob.url;

        const resposta = await fetch(`/api/apresentacoes/${apresentacaoId}/pptx-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl: blob.url, fileName: arquivo.name }),
        });
        const resultado = await resposta.json().catch(() => null);
        const urlsTemporarias = Array.isArray(resultado?.data?.temporaryAssetUrls)
          ? resultado.data.temporaryAssetUrls.filter((url: unknown): url is string => typeof url === "string")
          : [];
        if (cancelado) {
          await limparUploadsTemporarios(apresentacaoId, urlsTemporarias);
          return;
        }

        if (!resposta.ok || !resultado?.success) {
          setErro(typeof resultado?.error === "string" ? resultado.error : "Erro ao gerar a prévia do PowerPoint.");
          setStatus("erro");
          return;
        }

        setSlides(resultado.data.slides);
        setCanvas(resultado.data.canvas);
        setIgnorados(resultado.data.ignorados ?? {});
        setDiagnosticos(resultado.data.diagnosticos ?? []);
        setResumoDiagnosticos(resultado.data.resumoDiagnosticos ?? { INFO: 0, WARNING: 0, FALLBACK: 0, ERROR: 0 });
        setReferenceImages(resultado.data.referenceImages ?? []);
        previewAssetsRef.current = urlsTemporarias;
        setReferenceRenderer(resultado.data.referenceRenderer ?? null);
        setFontesDetectadas(resultado.data.fontesDetectadas ?? []);
        setFontesEmbutidas(resultado.data.fontesEmbutidas ?? []);
        setStatus("pronto");
      } catch (error) {
        if (cancelado) return;
        setErro(error instanceof Error && error.message ? error.message : "Erro de conexão ao gerar a prévia do PowerPoint.");
        setStatus("erro");
      }
    })();

    return () => {
      cancelado = true;
      const urls = [
        ...previewAssetsRef.current,
        ...(!preservarOriginalRef.current && urlEnviada ? [urlEnviada] : []),
      ];
      previewAssetsRef.current = [];
      if (!preservarOriginalRef.current) originalUploadRef.current = null;
      void limparUploadsTemporarios(apresentacaoId, urls);
    };
  }, [open, arquivo, apresentacaoId]);

  useEffect(() => {
    if (status !== "pronto") return;
    let cancelado = false;
    void document.fonts?.ready
      .then(() => resolverFontesNoDocumento(fontesDetectadas))
      .then((resultado) => {
        if (!cancelado) setFontes(resultado);
      });
    return () => { cancelado = true; };
  }, [fontesDetectadas, fontesEmbutidas, status]);

  // Só calcula o diff visual dos slides que já ficaram visíveis (lazy-mount de `ThumbnailSlide`
  // significa que slides fora de vista ainda não têm `captureRefs.current[index]` preenchido) —
  // reprocessa a lista sempre que um novo slide entra em vista rolando o grid.
  useEffect(() => {
    if (status !== "pronto" || !canvas || referenceImages.length === 0 || slidesVisiveis.size === 0) return;
    let cancelled = false;
    (async () => {
      await document.fonts?.ready;
      for (const index of slidesVisiveis) {
        if (cancelled) return;
        if (diffCalculadoRef.current.has(index)) continue;
        const node = captureRefs.current[index];
        const reference = referenceImages.find((item) => item.slideNumber === index + 1);
        if (!node || !reference) continue;
        diffCalculadoRef.current.add(index);
        try {
          const slideCanvas = slides[index].canvas ?? canvas;
          const importedUrl = await toPng(node, {
            canvasWidth: slideCanvas.width,
            canvasHeight: slideCanvas.height,
            pixelRatio: 1,
            backgroundColor: slideCanvas.backgroundColor,
            style: { transform: "none", transformOrigin: "top left" },
          });
          const diff = await compararImagens(reference.url, importedUrl, {
            width: 320,
            height: Math.max(1, Math.round(320 * slideCanvas.height / slideCanvas.width)),
          });
          if (!cancelled) setVisualDiffs((atual) => ({ ...atual, [index]: { importedUrl, diffUrl: diff.diffUrl, similarity: diff.similarity } }));
        } catch (error) {
          console.warn(`[PPTX Import] Falha no diff visual do slide ${index + 1}`, error);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [status, canvas, referenceImages, slides, slidesVisiveis]);

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
    const originalUrl = originalUploadRef.current;
    if (!arquivoAtual || !originalUrl || confirmando) return;
    setConfirmando(true);
    try {
      const resposta = await fetch(`/api/apresentacoes/${apresentacaoId}/importar-pptx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: originalUrl, fileName: arquivoAtual.name, excluirIndices: Array.from(excluidos) }),
      });
      const resultado = await resposta.json().catch(() => null);

      if (!resposta.ok || !resultado?.success) {
        toast.error(typeof resultado?.error === "string" ? resultado.error : "Erro ao importar o PowerPoint.");
        return;
      }

      const { slidesCriados, ignorados: ignoradosFinal, errosDeImagem, fontesEmbutidas: fontesPublicadas = [] } = resultado.data as {
        slidesCriados: number;
        ignorados: Record<string, number>;
        errosDeImagem: string[];
        fontesEmbutidas?: FontePersonalizada[];
      };
      registrarFontes(fontesPublicadas);
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

      preservarOriginalRef.current = true;
      originalUploadRef.current = null;
      await limparUploadsTemporarios(apresentacaoId, previewAssetsRef.current);
      previewAssetsRef.current = [];
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
  const fontesAusentes = fontes.filter((font) => !font.available);
  const problemasVisuais = diagnosticos.filter((item) => item.severity !== "INFO");

  return (
    <>
      <FontesPersonalizadasStyle fontes={fontesEmbutidas} />
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
            <p className="text-sm">{progressoUpload < 100 ? `Enviando PowerPoint… ${progressoUpload}%` : "Analisando o arquivo…"}</p>
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

            {(fontesAusentes.length > 0 || problemasVisuais.length > 0) && (
              <div className="border-b border-white/5 bg-slate-900/40 px-5 py-2 text-[11px] text-slate-400">
                {fontesAusentes.length > 0 && (
                  <p className="text-amber-300">
                    {fontesAusentes.map((font) => `Fonte “${font.original}” não disponível — substituída por “${font.substitute}”.`).join(" ")}
                  </p>
                )}
                {problemasVisuais.length > 0 && (
                  <p>
                    Diagnóstico: {resumoDiagnosticos.ERROR} erro(s), {resumoDiagnosticos.FALLBACK} fallback(s), {resumoDiagnosticos.WARNING} aviso(s).
                    {problemasVisuais.slice(0, 3).map((item) => ` Slide ${item.source.slide} / ${item.source.name ?? item.source.shapeId ?? item.type}: ${item.message}`).join(" ")}
                  </p>
                )}
              </div>
            )}

            {referenceRenderer && !referenceRenderer.available && (
              <div className="border-b border-white/5 bg-amber-950/20 px-5 py-2 text-[11px] text-amber-300">
                Comparação visual independente indisponível: {referenceRenderer.reason}
              </div>
            )}

            <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 overflow-y-auto p-5">
              {slides.map((slide, indice) => {
                const excluido = excluidos.has(indice);
                return (
                  <div key={indice} className="flex flex-col gap-1.5">
                    <div
                      className={`relative rounded-md border transition-opacity ${excluido ? "border-white/5 opacity-35" : "border-white/10"}`}
                    >
                      <ThumbnailSlide
                        componentes={slide.componentes}
                        canvas={slide.canvas ?? canvas}
                        captureRef={(node) => { captureRefs.current[indice] = node; }}
                        onVisivel={() => setSlidesVisiveis((atual) => (atual.has(indice) ? atual : new Set(atual).add(indice)))}
                      />
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
                    {visualDiffs[indice] && referenceImages.find((item) => item.slideNumber === indice + 1) && (
                      <div className="grid grid-cols-3 gap-1 text-center text-[9px] text-slate-500">
                        {[
                          ["Original", referenceImages.find((item) => item.slideNumber === indice + 1)!.url],
                          ["Importado", visualDiffs[indice].importedUrl],
                          ["Diferença", visualDiffs[indice].diffUrl],
                        ].map(([label, url]) => (
                          <div key={label}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- data URI gerada localmente para diagnóstico */}
                            <img src={url} alt={label} className="aspect-video w-full rounded-sm border border-white/5 object-fill" />
                            <span>{label}</span>
                          </div>
                        ))}
                        <span className="col-span-3">Similaridade de pixels: {(visualDiffs[indice].similarity * 100).toFixed(1)}% (inspeção visual obrigatória)</span>
                      </div>
                    )}
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
    </>
  );
}
