import type { MolduraComponente } from "@/lib/validations/slide-componentes";
import { MOLDURAS_CATALOGO } from "@/lib/apresentacoes/molduras-catalogo";
import { MOLDURA_VARIANTE_TIPOS } from "@/lib/validations/slide-componentes-basicos";
import { ColorField } from "./ColorField";

/** Painel de propriedades do elemento MOLDURA — decorativo (ilustração vetorial pronta, não
 * geometria), arrastável/redimensionável como qualquer elemento, desenha a arte por cima de
 * qualquer coisa sem recortar. `corFiltro` recolore via overlay (ver `RenderMoldura`), sem
 * reescrever o SVG original. */
export function MolduraProps({ componente, onChange }: { componente: MolduraComponente; onChange: (patch: Partial<MolduraComponente>) => void }) {
  const entrada = MOLDURAS_CATALOGO[componente.variante];

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-white/5 bg-slate-900/60">
        {entrada.src && (
          // eslint-disable-next-line @next/next/no-img-element -- prévia grande no painel de propriedades, sem otimização necessária
          <img src={entrada.src} alt="" className="h-28 w-full object-contain p-2" />
        )}
        <div className="border-t border-white/5 px-3 py-2 text-[11px] text-slate-500">
          Moldura: <span className="font-semibold text-slate-300">{entrada.label}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Trocar moldura</label>
        <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto rounded-lg border border-white/5 bg-slate-950/40 p-1.5">
          {MOLDURA_VARIANTE_TIPOS.map((tipo) => {
            const opcao = MOLDURAS_CATALOGO[tipo];
            const ativo = componente.variante === tipo;
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => onChange({ variante: tipo })}
                title={opcao.label}
                aria-label={`Usar moldura ${opcao.label}`}
                aria-pressed={ativo}
                className={`relative aspect-square overflow-hidden rounded-md border bg-slate-900 ${ativo ? "border-indigo-400 ring-2 ring-indigo-500/30" : "border-white/10 hover:border-white/30"}`}
              >
                {opcao.src && (
                  // eslint-disable-next-line @next/next/no-img-element -- prévia pequena numa grade de seleção, sem necessidade de otimização
                  <img src={opcao.src} alt="" className="h-full w-full object-contain p-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <ColorField
        id="moldura-cor-filtro"
        label="Cor da moldura"
        value={componente.corFiltro ?? ""}
        fallback="#ffffff"
        onChange={(corFiltro) => onChange({ corFiltro })}
      />
      {componente.corFiltro && (
        <button
          type="button"
          onClick={() => onChange({ corFiltro: undefined })}
          className="text-[10px] font-medium text-indigo-300 hover:text-indigo-200"
        >
          Restaurar cor original
        </button>
      )}
    </>
  );
}
