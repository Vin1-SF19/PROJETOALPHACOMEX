import { useRef, useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { MolduraComponente } from "@/lib/validations/slide-componentes";
import { FORMA_VARIANTE_TIPOS, type FormaVarianteTipo } from "@/lib/validations/slide-componentes-basicos";
import { FORMAS_CATALOGO } from "@/lib/apresentacoes/formas-catalogo";
import { enviarArquivoAsset, validarArquivoAsset } from "@/lib/apresentacoes/assets";
import { useEditorStore } from "../../store/useEditorStore";

/** Painel de propriedades do elemento MOLDURA — estilo Canva: forma geométrica que funciona
 * como slot/recorte de imagem. Sem `imagem`, mostra só o contorno vazio; a troca de `contorno`
 * reaproveita o mesmo catálogo de `FORMAS_CATALOGO` usado pelo elemento "forma". Upload/link de
 * imagem usa o mesmo pipeline de `ImagemProps.tsx` (`enviarArquivoAsset`). */
export function MolduraProps({ componente, onChange }: { componente: MolduraComponente; onChange: (patch: Partial<MolduraComponente>) => void }) {
  const apresentacaoId = useEditorStore((s) => s.apresentacaoId);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const entrada = FORMAS_CATALOGO[componente.contorno];

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
      onChange({ imagem: { url: asset.url } });
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
      <div className="overflow-hidden rounded-lg border border-white/5 bg-slate-900/60">
        <div
          className="flex h-28 items-center justify-center p-3"
          style={componente.imagem?.url ? { backgroundImage: `url(${JSON.stringify(componente.imagem.url)})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          {!componente.imagem?.url && (
            <svg viewBox="0 0 100 100" className="h-full w-full text-slate-600" aria-hidden="true">
              <g fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="4 3">
                {entrada.tipoElemento === "rect" && <rect x="4" y="4" width="92" height="92" rx={componente.contorno === "retanguloArredondado" ? 14 : componente.raioArredondamento ?? 0} />}
                {entrada.tipoElemento === "ellipse" && <ellipse cx="50" cy="50" rx="46" ry="46" />}
                {entrada.tipoElemento === "polygon" && <polygon points={entrada.points} />}
                {entrada.tipoElemento === "path" && <path d={entrada.d} />}
              </g>
            </svg>
          )}
        </div>
        <div className="border-t border-white/5 px-3 py-2 text-[11px] text-slate-500">
          Moldura: <span className="font-semibold text-slate-300">{entrada.label}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Trocar contorno</label>
        <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto rounded-lg border border-white/5 bg-slate-950/40 p-1.5">
          {FORMA_VARIANTE_TIPOS.map((tipo: FormaVarianteTipo) => {
            const opcao = FORMAS_CATALOGO[tipo];
            const ativo = componente.contorno === tipo;
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => onChange({ contorno: tipo })}
                title={opcao.label}
                aria-label={`Usar contorno ${opcao.label}`}
                aria-pressed={ativo}
                className={`relative aspect-square overflow-hidden rounded-md border bg-slate-900 p-1.5 ${ativo ? "border-indigo-400 ring-2 ring-indigo-500/30" : "border-white/10 hover:border-white/30"}`}
              >
                <svg viewBox="0 0 100 100" className="h-full w-full text-slate-400" aria-hidden="true">
                  <g fill="none" stroke="currentColor" strokeWidth={4}>
                    {opcao.tipoElemento === "rect" && <rect x="4" y="4" width="92" height="92" rx={tipo === "retanguloArredondado" ? 14 : 0} />}
                    {opcao.tipoElemento === "ellipse" && <ellipse cx="50" cy="50" rx="46" ry="46" />}
                    {opcao.tipoElemento === "polygon" && <polygon points={opcao.points} />}
                    {opcao.tipoElemento === "path" && <path d={opcao.d} />}
                  </g>
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      {componente.contorno === "retangulo" && (
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Arredondamento dos cantos</label>
          <input
            type="range"
            min={0}
            max={100}
            value={componente.raioArredondamento ?? 0}
            onChange={(e) => onChange({ raioArredondamento: Number(e.target.value) })}
            className="w-full accent-indigo-500"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Imagem</label>
        {componente.imagem?.url ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2">
            <span className="truncate text-xs text-slate-400">Imagem aplicada</span>
            <button
              type="button"
              onClick={() => onChange({ imagem: undefined })}
              aria-label="Remover imagem da moldura"
              className="rounded-md p-1 text-slate-500 hover:text-white"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ) : (
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
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Ou cole o link da imagem</label>
        <input
          type="text"
          value={componente.imagem?.url ?? ""}
          onChange={(e) => onChange({ imagem: e.target.value ? { url: e.target.value } : undefined })}
          placeholder="https://..."
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
    </>
  );
}
