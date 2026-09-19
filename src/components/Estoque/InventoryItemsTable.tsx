"use client";

import Image from "next/image";
import { AlertTriangle, Box, ChevronRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InventoryEmptyState } from "@/components/Estoque/InventoryEmptyState";
import { getInventoryItemLocation, inventoryStatusLabel, isLowStock } from "@/lib/estoque/view-model";
import type { InventoryItem } from "@/lib/estoque/types";
import { isOptimizableInventoryImage } from "@/lib/estoque/images";

interface InventoryItemsTableProps {
  items: InventoryItem[];
  onSelect: (item: InventoryItem) => void;
}

function ItemThumbnail({ item }: { item: InventoryItem }) {
  if (!item.imagem) {
    return <div className="estoque-thumbnail grid size-11 shrink-0 place-items-center rounded-xl bg-blue-400/10 text-blue-300"><Box size={19} /></div>;
  }
  return (
    <div className="estoque-thumbnail relative size-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-900">
      <Image src={item.imagem} alt="" fill sizes="44px" unoptimized={!isOptimizableInventoryImage(item.imagem)} className="object-cover" />
    </div>
  );
}

export function InventoryItemsTable({ items, onSelect }: InventoryItemsTableProps) {
  if (items.length === 0) {
    return <InventoryEmptyState icon={Box} title="Nenhum item encontrado" description="Ajuste a busca ou os filtros. Se este é o primeiro acesso, cadastre um novo item." />;
  }

  return (
    <div className="estoque-table-shell overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-950/35">
      <div className="hidden grid-cols-[minmax(280px,2fr)_1fr_repeat(3,minmax(88px,.7fr))_48px] gap-4 border-b border-white/[0.06] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 lg:grid">
        <span>Item</span><span>Categoria</span><span>Disponível</span><span>Em uso</span><span>Status</span><span />
      </div>
      <div className="divide-y divide-white/[0.06]">
        {items.map((item) => {
          const lowStock = isLowStock(item);
          const noStock = item.quantidade === 0;
          return (
            <button key={item.id} type="button" onClick={() => onSelect(item)} className="estoque-table-row grid w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 lg:grid-cols-[minmax(280px,2fr)_1fr_repeat(3,minmax(88px,.7fr))_48px] lg:items-center lg:gap-4 lg:px-5">
              <span className="flex min-w-0 items-center gap-3">
                <ItemThumbnail item={item} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-100">{item.nome}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {getInventoryItemLocation(item)}</span>
                  <span className="mt-1 block text-[11px] uppercase tracking-wide text-slate-600">{item.trackingMode === "INDIVIDUAL" ? "Patrimônio individual" : "Controle por quantidade"}</span>
                </span>
              </span>
              <span className="text-sm text-slate-400">{item.categoria.nome}</span>
              <span className="text-sm font-semibold tabular-nums text-white">{item.quantidade} <small className="font-normal text-slate-500">{item.unidade}</small></span>
              <span className="text-sm tabular-nums text-slate-500">{item.quantidadeEmUso ?? 0}</span>
              <span>
                <Badge className={`estoque-badge ${noStock ? "border-rose-400/20 bg-rose-400/10 text-rose-300" : lowStock ? "border-amber-400/20 bg-amber-400/10 text-amber-300" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"}`}>
                  {lowStock && <AlertTriangle size={11} />} {noStock ? "Sem estoque" : lowStock ? "Estoque baixo" : inventoryStatusLabel(item.status)}
                </Badge>
              </span>
              <ChevronRight className="hidden text-slate-600 lg:block" size={18} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
