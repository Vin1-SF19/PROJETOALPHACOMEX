import { ArrowDownUp, PackagePlus, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InventoryHeaderProps {
  onNewItem: () => void;
  onNewKit: () => void;
  onMove: () => void;
}

export function InventoryHeader({ onNewItem, onNewKit, onMove }: InventoryHeaderProps) {
  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="estoque-chip mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
          Central de inventário
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Estoque Alpha</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Gestão de equipamentos, materiais e patrimônios da empresa.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onNewItem} className="estoque-primary bg-blue-500 text-white hover:bg-blue-400">
          <PackagePlus size={16} /> Novo Item
        </Button>
        <Button variant="outline" onClick={onNewKit} className="estoque-secondary">
          <Tags size={16} /> Nova Tag / Kit
        </Button>
        <Button variant="outline" onClick={onMove} className="estoque-secondary">
          <ArrowDownUp size={16} /> Movimentar estoque
        </Button>
      </div>
    </header>
  );
}
