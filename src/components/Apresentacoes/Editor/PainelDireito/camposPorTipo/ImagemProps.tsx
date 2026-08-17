import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ImagemComponente } from "@/lib/validations/slide-componentes";
import { enviarArquivoAsset, validarArquivoAsset } from "@/lib/apresentacoes/assets";
import { MOLDURAS_CATALOGO } from "@/lib/apresentacoes/molduras-catalogo";
import { MOLDURA_IMAGEM_TIPOS } from "@/lib/validations/slide-componentes-basicos";
import { useEditorStore } from "../../store/useEditorStore";

export function ImagemProps({ componente, onChange }: { componente: ImagemComponente; onChange: (patch: Partial<ImagemComponente>) => void }) {
  const apresentacaoId = useEditorStore((s) => s.apresentacaoId);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleArquivoSelecionado(arquivo: File | undefined) {
    if (!arquivo || !apresentacaoId || enviando) return;
    const erro = validarArquivoAsset(arquivo);
    if (erro) {
      toast.error(erro);
      return;
    }
    setEnviando(true);
    try {
      const asset = await enviarArquivoAsset(apresentacaoId, arquivo);
      onChange({ url: asset.url });
      toast.success("Imagem enviada e aplicada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setEnviando(false);
      if (inputArquivoRef.current) inputArquivoRef.current.value = "";
    }
  }

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Imagem do computador</label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/15 bg-slate-900/70 px-3 py-2.5 text-xs text-slate-400 hover:border-indigo-400/50 hover:text-slate-200">
          {enviando ? <Loader2 size={15} className="shrink-0 animate-spin" aria-hidden="true" /> : <FileUp size={15} className="shrink-0" aria-hidden="true" />}
          <span className="min-w-0 truncate">{enviando ? "Enviando..." : "Escolher arquivo (PNG, JPG, WebP, GIF)"}</span>
          <input
            ref={inputArquivoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={enviando || !apresentacaoId}
            onChange={(e) => void handleArquivoSelecionado(e.target.files?.[0])}
          />
        </label>
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Ou cole o link da imagem</label>
        <input
          type="text"
          value={componente.url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://..."
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Texto alternativo</label>
        <input
          type="text"
          value={componente.alt ?? ""}
          onChange={(e) => onChange({ alt: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Ajuste</label>
        <select
          value={componente.objectFit ?? "cover"}
          onChange={(e) => onChange({ objectFit: e.target.value as ImagemComponente["objectFit"] })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="cover">Preencher (cover)</option>
          <option value="contain">Ajustar (contain)</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Moldura</label>
        <select
          value={componente.moldura ?? "nenhuma"}
          onChange={(e) => onChange({ moldura: e.target.value as ImagemComponente["moldura"] })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          {MOLDURA_IMAGEM_TIPOS.map((tipo) => (
            <option key={tipo} value={tipo}>{MOLDURAS_CATALOGO[tipo].label}</option>
          ))}
        </select>
      </div>
    </>
  );
}
