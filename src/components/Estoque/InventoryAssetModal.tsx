"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { CadastrarUnidadePatrimonial } from "@/actions/EstoqueMovimentos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { InventoryItem, InventoryLocation } from "@/lib/estoque/types";

interface InventoryAssetModalProps {
  item: InventoryItem | null;
  locations: InventoryLocation[];
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

export function InventoryAssetModal({ item, locations, onOpenChange, onCompleted }: InventoryAssetModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serial, setSerial] = useState("");
  const [patrimonio, setPatrimonio] = useState("");
  const [codigoInterno, setCodigoInterno] = useState("");
  const [locationId, setLocationId] = useState(item?.defaultLocationId ?? "");
  const [observation, setObservation] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    startTransition(async () => {
      const result = await CadastrarUnidadePatrimonial({
        idempotencyKey: crypto.randomUUID(), produtoId: item.id,
        serial: serial.trim() || undefined, patrimonio: patrimonio.trim() || undefined,
        codigoInterno: codigoInterno.trim() || undefined, locationId: locationId || undefined,
        observacao: observation.trim() || undefined,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Unidade patrimonial cadastrada com entrada rastreável.");
      onOpenChange(false);
      onCompleted?.();
      router.refresh();
    });
  }

  return <Dialog open={Boolean(item)} onOpenChange={onOpenChange}><DialogContent className="estoque-dialog border-white/10 bg-[#071226] text-white"><DialogHeader><DialogTitle className="flex items-center gap-2"><ScanBarcode size={18} /> Nova unidade patrimonial</DialogTitle><DialogDescription>{item?.nome}. Informe ao menos serial, patrimônio ou código interno.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm text-slate-300">Patrimônio<Input value={patrimonio} onChange={(event) => setPatrimonio(event.target.value)} maxLength={160} className="estoque-input border-white/10 bg-slate-950/70" /></label><label className="block space-y-2 text-sm text-slate-300">Serial<Input value={serial} onChange={(event) => setSerial(event.target.value)} maxLength={160} className="estoque-input border-white/10 bg-slate-950/70" /></label></div><label className="block space-y-2 text-sm text-slate-300">Código interno<Input value={codigoInterno} onChange={(event) => setCodigoInterno(event.target.value)} maxLength={160} className="estoque-input border-white/10 bg-slate-950/70" /></label><label className="block space-y-2 text-sm text-slate-300">Localização<select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="">Sem localização</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.nome}</option>)}</select></label><label className="block space-y-2 text-sm text-slate-300">Observação<textarea value={observation} onChange={(event) => setObservation(event.target.value)} maxLength={2_000} rows={3} className="estoque-textarea w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-2" /></label><DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="estoque-ghost">Cancelar</Button><Button type="submit" disabled={pending || (!serial.trim() && !patrimonio.trim() && !codigoInterno.trim())}>{pending ? "Cadastrando..." : "Cadastrar unidade"}</Button></DialogFooter></form></DialogContent></Dialog>;
}
