"use client";

import Image from "next/image";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Archive, Box, ExternalLink, FileText, MapPin, Pencil, ScanBarcode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ArquivarProduto, ExcluirProdutoDefinitivamente } from "@/actions/Estoque";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InventoryMovementsPanel } from "@/components/Estoque/InventoryMovementsPanel";
import type { InventoryItem } from "@/lib/estoque/types";
import { getInventoryItemLocation, inventoryStatusLabel, isLowStock } from "@/lib/estoque/view-model";
import { isOptimizableInventoryImage } from "@/lib/estoque/images";

interface InventoryItemDetailsProps {
  item: InventoryItem | null;
  onClose: () => void;
  onEdit: (item: InventoryItem) => void;
  onMove: (item: InventoryItem, type: "ENTRADA" | "SAIDA" | "EM_USO" | "TRANSFERENCIA" | "MANUTENCAO" | "BAIXA") => void;
  onRegisterAsset: (item: InventoryItem) => void;
}

export function InventoryItemDetails({ item, onClose, onEdit, onMove, onRegisterAsset }: InventoryItemDetailsProps) {
  const router = useRouter();
  const [archiving, startArchiving] = useTransition();

  function archiveItem(currentItem: InventoryItem) {
    if (!window.confirm(`Arquivar "${currentItem.nome}"? O histórico e os relacionamentos serão preservados.`)) return;
    startArchiving(async () => {
      const result = await ArquivarProduto(currentItem.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Item arquivado com histórico preservado.");
      onClose();
      router.refresh();
    });
  }

  function deleteItem(currentItem: InventoryItem) {
    const confirmation = window.prompt(`Excluir definitivamente "${currentItem.nome}"?\n\nEsta ação não é uma baixa e não pode ser desfeita. Digite EXCLUIR para confirmar.`);
    if (confirmation !== "EXCLUIR") return;
    startArchiving(async () => {
      const result = await ExcluirProdutoDefinitivamente(currentItem.id, confirmation);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Item excluído definitivamente.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="estoque-sheet estoque-scroll w-full overflow-y-auto border-white/10 bg-[#061225] text-white sm:max-w-lg">
        {item && <>
          <SheetHeader>
            <SheetTitle className="text-white">{item.nome}</SheetTitle>
            <SheetDescription>{item.categoria.nome}</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-6">
            <div className="group relative grid aspect-[16/9] place-items-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
              {item.imagem ? <><Image src={item.imagem} alt={item.nome} fill sizes="(max-width: 640px) 100vw, 512px" unoptimized={!isOptimizableInventoryImage(item.imagem)} className="object-contain" /><a href={item.imagem} target="_blank" rel="noreferrer" className="absolute right-3 top-3 grid size-9 place-items-center rounded-xl bg-slate-950/80 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label="Abrir foto em tamanho original"><ExternalLink size={15} /></a></> : <Box size={48} className="text-slate-700" />}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[{ label: "Disponível", value: item.quantidade }, { label: "Em uso", value: item.quantidadeEmUso ?? 0 }, { label: "Total", value: item.quantidadeTotal || item.quantidade }].map((entry) => (
                <div key={entry.label} className="estoque-section rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-center">
                  <p className="text-xl font-black tabular-nums">{entry.value}</p><p className="mt-1 text-xs text-slate-500">{entry.label}</p>
                </div>
              ))}
            </div>
            {isLowStock(item) && <div className="flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100"><AlertTriangle className="mt-0.5 shrink-0" size={17} /><p>Disponível: {item.quantidade}. Mínimo definido: {item.estoqueMinimo} {item.unidade}.</p></div>}
            <div className="estoque-section space-y-3 rounded-2xl border border-white/[0.08] p-4 text-sm">
              <div className="flex justify-between gap-4"><span className="text-slate-500">Tipo</span><span>{item.trackingMode === "INDIVIDUAL" ? "Individual / patrimônio" : "Por quantidade"}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Status</span><Badge variant="outline">{inventoryStatusLabel(item.status)}</Badge></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Unidade</span><span>{item.unidade}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Localização</span><span className="flex items-center gap-1 text-slate-300"><MapPin size={13} /> {getInventoryItemLocation(item)}</span></div>
              {item.codigoInterno && <div className="flex justify-between gap-4"><span className="text-slate-500">Código interno</span><span className="flex items-center gap-1 font-mono text-xs"><ScanBarcode size={13} /> {item.codigoInterno}</span></div>}
              {(item.marca || item.modelo) && <div className="flex justify-between gap-4"><span className="text-slate-500">Marca / modelo</span><span>{[item.marca, item.modelo].filter(Boolean).join(" · ")}</span></div>}
              {item.fornecedor && <div className="flex justify-between gap-4"><span className="text-slate-500">Fornecedor</span><span>{item.fornecedor}</span></div>}
              {item.inventoryImages?.[0] && <div className="flex items-center justify-between gap-4"><span className="text-slate-500">Nota fiscal</span><a href={item.inventoryImages[0].url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-300 hover:text-blue-200"><FileText size={13} /> Abrir arquivo <ExternalLink size={11} /></a></div>}
              <div className="flex justify-between gap-4"><span className="text-slate-500">Histórico</span><Badge variant="outline">Ledger ativo</Badge></div>
            </div>
            {item.descricao && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Descrição</p><p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.descricao}</p></div>}
            {(item.inventoryAssets?.length ?? 0) > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Unidades individuais</p><div className="space-y-2">{item.inventoryAssets?.map((asset) => <div key={asset.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-300"><span className="font-semibold">{asset.patrimonio || asset.codigoInterno || "Sem patrimônio"}</span>{asset.serial && <span className="ml-2 text-slate-500">Serial {asset.serial}</span>}</div>)}</div></div>}
            {item.observacoes && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Observações</p><p className="whitespace-pre-wrap text-sm leading-6 text-slate-400">{item.observacoes}</p></div>}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => onEdit(item)} className="estoque-secondary"><Pencil size={15} /> Editar</Button>
              {item.trackingMode === "INDIVIDUAL" ? <Button onClick={() => onRegisterAsset(item)} className="estoque-primary"><ScanBarcode size={15} /> Cadastrar unidade</Button> : <Button onClick={() => onMove(item, "ENTRADA")} className="estoque-primary">Adicionar estoque</Button>}
              <Button variant="outline" onClick={() => onMove(item, "SAIDA")} className="estoque-secondary">Remover estoque</Button>
              <Button variant="outline" onClick={() => onMove(item, "EM_USO")} className="estoque-secondary">Colocar em uso</Button>
              <Button variant="outline" onClick={() => onMove(item, "TRANSFERENCIA")} className="estoque-secondary">Transferir</Button>
              <Button variant="outline" onClick={() => onMove(item, "MANUTENCAO")} className="estoque-secondary">Manutenção</Button>
              <Button variant="outline" onClick={() => onMove(item, "BAIXA")} className="estoque-secondary">Dar baixa</Button>
              <Button className="estoque-ghost col-span-2 text-amber-300 hover:text-amber-200" variant="ghost" disabled={archiving} onClick={() => archiveItem(item)}><Archive size={15} /> {archiving ? "Arquivando..." : "Arquivar item"}</Button>
              <Button className="estoque-ghost col-span-2 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200" variant="ghost" disabled={archiving} onClick={() => deleteItem(item)}><Trash2 size={15} /> {archiving ? "Processando..." : "Excluir definitivamente"}</Button>
            </div>
            <div><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Movimentações recentes</p><InventoryMovementsPanel productId={item.id} compact /></div>
          </div>
        </>}
      </SheetContent>
    </Sheet>
  );
}
