"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { RotateCcw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { BuscarManutencoesEstoque, RetornarItemManutencao } from "@/actions/EstoqueMovimentos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { InventoryLocation } from "@/lib/estoque/types";

type MaintenancePage = Awaited<ReturnType<typeof BuscarManutencoesEstoque>>;
type MaintenanceRow = MaintenancePage["items"][number];

interface InventoryMaintenancePanelProps {
  locations: InventoryLocation[];
  refreshKey?: number;
  onCompleted?: () => void;
}

export function InventoryMaintenancePanel({ locations, refreshKey = 0, onCompleted }: InventoryMaintenancePanelProps) {
  const [rows, setRows] = useState<MaintenanceRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<MaintenanceRow | null>(null);
  const [condition, setCondition] = useState("BOM");
  const [locationId, setLocationId] = useState("");
  const [observation, setObservation] = useState("");
  const [pending, startTransition] = useTransition();

  const load = useCallback(async (nextCursor?: string, append = false) => {
    try {
      const page = await BuscarManutencoesEstoque({ status: "ABERTA", limit: 12, cursor: nextCursor });
      setRows((current) => append ? [...current, ...page.items] : page.items);
      setCursor(page.nextCursor);
    } catch {
      toast.error("Não foi possível carregar as manutenções.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  function finish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    startTransition(async () => {
      const result = await RetornarItemManutencao({ idempotencyKey: crypto.randomUUID(), maintenanceId: selected.id, condition, toLocationId: locationId || undefined, observacao: observation.trim() || undefined });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Retorno da manutenção registrado.");
      setSelected(null);
      await load();
      onCompleted?.();
    });
  }

  if (rows.length === 0) return null;
  return <section className="space-y-3"><div><h3 className="text-base font-semibold text-slate-100">Em manutenção</h3><p className="text-sm text-slate-500">Equipamentos aguardando retorno.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <article key={row.id} className="estoque-maintenance-card rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-4"><div className="flex items-start gap-3"><span className="estoque-card-icon grid size-9 place-items-center rounded-xl bg-amber-400/10 text-amber-300"><Wrench size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{row.produto.nome}</p><p className="mt-1 truncate text-xs text-slate-500">{row.asset?.patrimonio || row.asset?.serial || `${row.quantity} ${row.produto.unidade}`}</p></div><Badge variant="outline" className="estoque-badge border-amber-400/20 text-amber-300">Aberta</Badge></div><p className="mt-3 line-clamp-2 text-xs text-slate-400">{row.reason}</p><Button size="sm" variant="outline" className="estoque-secondary mt-3 w-full" onClick={() => setSelected(row)}><RotateCcw size={14} /> Retornar da manutenção</Button></article>)}</div>{cursor && <Button variant="ghost" onClick={() => void load(cursor, true)} className="estoque-ghost">Carregar mais manutenções</Button>}<Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="estoque-dialog border-white/10 bg-[#071226] text-white"><DialogHeader><DialogTitle>Retornar da manutenção</DialogTitle><DialogDescription>{selected?.produto.nome}</DialogDescription></DialogHeader><form onSubmit={finish} className="space-y-4"><label className="block space-y-2 text-sm text-slate-300">Condição<select value={condition} onChange={(event) => setCondition(event.target.value)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="BOM">Bom</option><option value="COM_AVARIA">Com avaria</option><option value="DANIFICADO">Danificado</option></select></label><label className="block space-y-2 text-sm text-slate-300">Destino<select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="">Sem localização</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.nome}</option>)}</select></label><label className="block space-y-2 text-sm text-slate-300">Observação<textarea value={observation} onChange={(event) => setObservation(event.target.value)} maxLength={2_000} rows={3} className="estoque-textarea w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-2" /></label><DialogFooter><Button type="button" variant="ghost" onClick={() => setSelected(null)} className="estoque-ghost">Cancelar</Button><Button type="submit" disabled={pending} className="estoque-primary">{pending ? "Registrando..." : "Confirmar retorno"}</Button></DialogFooter></form></DialogContent></Dialog></section>;
}
