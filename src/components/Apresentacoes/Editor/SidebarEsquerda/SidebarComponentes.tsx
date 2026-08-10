import { ChevronDown } from "lucide-react";
import { CATEGORIAS_COMPONENTE } from "../registry/componentes-registry";
import { ItemComponenteArrastavel } from "./ItemComponenteArrastavel";

export function SidebarComponentes() {
  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Componentes</h3>
      {CATEGORIAS_COMPONENTE.map((categoria) => (
        <details key={categoria.nome} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-white">
            {categoria.nome}
            <ChevronDown size={12} className="transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="grid grid-cols-2 gap-2 pb-2 pt-1">
            {categoria.tipos.map((tipo) => (
              <ItemComponenteArrastavel key={tipo} tipo={tipo} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
