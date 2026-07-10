import { TIPOS_COMPONENTE } from "../registry/componentes-registry";
import { ItemComponenteArrastavel } from "./ItemComponenteArrastavel";

export function SidebarComponentes() {
  return (
    <div className="space-y-3 p-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Componentes</h3>
      <div className="grid grid-cols-2 gap-2">
        {TIPOS_COMPONENTE.map((tipo) => (
          <ItemComponenteArrastavel key={tipo} tipo={tipo} />
        ))}
      </div>
    </div>
  );
}
