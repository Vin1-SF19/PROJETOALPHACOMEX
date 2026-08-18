"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "../store/useEditorStore";
import { enviarArquivoAsset, validarArquivoAsset } from "@/lib/apresentacoes/assets";
import { MOLDURA_TIPOS } from "@/lib/validations/slide-componentes-basicos";
import { MOLDURAS_CATALOGO } from "@/lib/apresentacoes/molduras-catalogo";
import { ColorField } from "./camposPorTipo/ColorField";
import { SeletorTransicaoSlide } from "../BarraSuperior/SeletorTransicaoSlide";

/** Nota: a cor customizada da moldura NÃO está disponível aqui (diferente do elemento "moldura"
 * solto, em MolduraProps.tsx) — a moldura do slide usa CSS `border-image` para se adaptar ao
 * perímetro real do slide (ver `estiloBordaMoldura`), e recolorir um `border-image` de forma
 * confiável entre navegadores (via `mask-border`) não tem suporte no Firefox. Decisão
 * consciente até existir uma técnica de recoloração validada visualmente para esse caso. */

/** Painel de propriedades exibido quando um SLIDE está ativo mas NENHUM elemento está
 * selecionado — antes disso a mensagem era só "Selecione um componente para editar suas
 * propriedades", sem nenhuma opção do slide em si. Cobre fundo (cor/imagem), moldura decorativa
 * ao redor do slide inteiro e transição de entrada; "efeitos globais do slide" ainda não têm
 * especificação — registrado como pendência consciente em `.bibble/memory/decisions.md`. */
export function PainelPropriedadesSlide() {
  const apresentacaoId = useEditorStore((s) => s.apresentacaoId);
  const canvas = useEditorStore((s) => s.canvas);
  const atualizarFundoCanvas = useEditorStore((s) => s.atualizarFundoCanvas);
  const atualizarFundoCanvasImagem = useEditorStore((s) => s.atualizarFundoCanvasImagem);
  const atualizarMolduraCanvas = useEditorStore((s) => s.atualizarMolduraCanvas);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleImagemFundo(arquivo: File | undefined) {
    if (!arquivo || !apresentacaoId || enviando) return;
    const erro = validarArquivoAsset(arquivo);
    if (erro) {
      toast.error(erro);
      return;
    }
    setEnviando(true);
    try {
      const asset = await enviarArquivoAsset(apresentacaoId, arquivo);
      atualizarFundoCanvasImagem(`url("${asset.url}") center / cover no-repeat`);
      toast.success("Imagem de fundo aplicada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setEnviando(false);
      if (inputArquivoRef.current) inputArquivoRef.current.value = "";
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Propriedades do slide</h3>
        <p className="mt-0.5 text-[10px] text-slate-600">Nenhum elemento selecionado — ajustes se aplicam ao slide inteiro.</p>
      </div>

      <ColorField
        id="slide-cor-fundo"
        label="Cor de fundo"
        value={canvas.backgroundColor}
        fallback="#0f172a"
        onChange={atualizarFundoCanvas}
      />

      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Imagem de fundo</label>
        {canvas.backgroundImage ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2">
            <span className="truncate text-xs text-slate-400">Imagem aplicada</span>
            <button
              type="button"
              onClick={() => atualizarFundoCanvasImagem(undefined)}
              aria-label="Remover imagem de fundo"
              className="rounded-md p-1 text-slate-500 hover:text-white"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/15 bg-slate-900/70 px-3 py-2.5 text-xs text-slate-400 hover:border-indigo-400/50 hover:text-slate-200">
            {enviando ? <Loader2 size={15} className="shrink-0 animate-spin" aria-hidden="true" /> : <FileUp size={15} className="shrink-0" aria-hidden="true" />}
            <span className="min-w-0 truncate">{enviando ? "Enviando..." : "Escolher imagem (PNG, JPG, WebP, GIF)"}</span>
            <input
              ref={inputArquivoRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              disabled={enviando || !apresentacaoId}
              onChange={(e) => void handleImagemFundo(e.target.files?.[0])}
            />
          </label>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Moldura do slide</label>
        <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto rounded-lg border border-white/5 bg-slate-950/40 p-1.5">
          {MOLDURA_TIPOS.map((tipo) => {
            const entrada = MOLDURAS_CATALOGO[tipo];
            const ativo = (canvas.moldura ?? "nenhuma") === tipo;
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => atualizarMolduraCanvas(tipo)}
                title={entrada.label}
                aria-label={`Usar moldura ${entrada.label}`}
                aria-pressed={ativo}
                className={`relative aspect-square overflow-hidden rounded-md border bg-slate-900 ${ativo ? "border-indigo-400 ring-2 ring-indigo-500/30" : "border-white/10 hover:border-white/30"}`}
              >
                {entrada.src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- prévia pequena numa grade de seleção, sem necessidade de otimização
                  <img src={entrada.src} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[9px] text-slate-500">Nenhuma</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Transição de entrada</label>
        <SeletorTransicaoSlide />
      </div>

      <div className="rounded-lg border border-white/5 bg-slate-900/40 px-3 py-2.5 text-[10px] leading-relaxed text-slate-600">
        Efeitos globais do slide ainda não estão disponíveis — chegam em uma fase futura.
      </div>
    </div>
  );
}
