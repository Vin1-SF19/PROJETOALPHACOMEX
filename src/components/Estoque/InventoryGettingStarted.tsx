import { ArrowDownUp, ChevronDown, PackagePlus, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InventoryGettingStartedProps {
  onNewItem: () => void;
  onMove: () => void;
  onKits: () => void;
}

export function InventoryGettingStarted({ onNewItem, onMove, onKits }: InventoryGettingStartedProps) {
  return (
    <details className="estoque-guide group rounded-2xl border border-blue-400/15 bg-blue-500/[0.055] open:bg-blue-500/[0.075]">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm text-blue-100 marker:content-none">
        <span className="flex size-7 items-center justify-center rounded-full bg-blue-400/15 text-xs font-bold text-blue-300">?</span>
        <span className="min-w-0 flex-1"><strong className="block">Como usar o Estoque Alpha</strong><span className="text-xs text-slate-400">Abra este guia rápido sempre que precisar.</span></span>
        <ChevronDown size={17} className="text-blue-300 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 border-t border-blue-400/10 p-4 md:grid-cols-3">
        <GuideStep icon={PackagePlus} number="1" title="Cadastre o item" description="Informe o que é, sua categoria, tipo de controle e onde ficará." action="Novo item" onClick={onNewItem} />
        <GuideStep icon={ArrowDownUp} number="2" title="Registre cada movimento" description="Use entrada, saída, entrega, devolução ou manutenção. O histórico é automático." action="Movimentar" onClick={onMove} />
        <GuideStep icon={Tags} number="3" title="Monte Tags e Kits" description="Defina os produtos, quantidades e o que é obrigatório antes de montar um kit real." action="Tags / Kits" onClick={onKits} />
      </div>
    </details>
  );
}

function GuideStep({ icon: Icon, number, title, description, action, onClick }: { icon: typeof PackagePlus; number: string; title: string; description: string; action: string; onClick: () => void }) {
  return <article className="estoque-guide-card flex flex-col rounded-xl border border-white/[0.07] bg-slate-950/35 p-4"><div className="mb-3 flex items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-widest text-blue-300">Passo {number}</span><Icon size={15} className="ml-auto text-blue-300" /></div><h3 className="font-semibold text-white">{title}</h3><p className="mt-1 flex-1 text-xs leading-5 text-slate-400">{description}</p><Button type="button" variant="ghost" size="sm" className="estoque-ghost mt-3 self-start text-blue-300" onClick={onClick}>{action}</Button></article>;
}
