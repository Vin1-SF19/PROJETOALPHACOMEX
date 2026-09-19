"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, useTransition } from "react";
import { PackageCheck, RotateCcw, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { BuscarAtribuicoesEstoque, DevolverItemEstoque } from "@/actions/EstoqueMovimentos";
import { InventoryEmptyState } from "@/components/Estoque/InventoryEmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { InventoryLocation } from "@/lib/estoque/types";

type AssignmentPage = Awaited<ReturnType<typeof BuscarAtribuicoesEstoque>>;
type AssignmentRow = AssignmentPage["items"][number];

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

interface InventoryAssignmentsPanelProps {
  locations: InventoryLocation[];
  refreshKey?: number;
  mineOnly?: boolean;
  canReturn?: boolean;
}

export function InventoryAssignmentsPanel({ locations, refreshKey = 0, mineOnly = false, canReturn = false }: InventoryAssignmentsPanelProps) {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<AssignmentRow | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState("BOM");
  const [locationId, setLocationId] = useState("");
  const [observation, setObservation] = useState("");
  const [pending, startTransition] = useTransition();

  const load = useCallback(async (nextCursor?: string, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const page = await BuscarAtribuicoesEstoque({ limit: 30, cursor: nextCursor, scope: mineOnly ? "MINE" : "ALL" });
      const activeItems = page.items.filter((item) => item.status === "ATIVA" || item.status === "PARCIALMENTE_DEVOLVIDA");
      setRows((current) => append ? [...current, ...activeItems] : activeItems);
      setCursor(page.nextCursor);
    } catch {
      toast.error("Não foi possível carregar os itens em uso.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [mineOnly]);

  useEffect(() => {
    // A chamada assíncrona hidrata a view com o ledger; não deriva estado local de props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  function returnAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    startTransition(async () => {
      const result = await DevolverItemEstoque({
        idempotencyKey: crypto.randomUUID(),
        assignmentId: selected.id,
        quantity: Number(quantity),
        condition,
        destinationLocationId: locationId || undefined,
        observacao: observation.trim() || undefined,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Devolução registrada com histórico.");
      setSelected(null);
      await load();
    });
  }

  if (loading) return <div className="estoque-panel rounded-2xl border border-white/[0.08] bg-slate-900/45 py-16 text-center text-sm text-slate-400">Carregando itens em uso...</div>;
  if (rows.length === 0) return <InventoryEmptyState icon={UserRoundCheck} title={mineOnly ? "Nenhum item em sua posse" : "Nenhum equipamento em uso"} description={mineOnly ? "Itens e kits disponibilizados para você aparecerão aqui." : "Atribuições ativas aparecerão aqui com responsável, setor, local e data de entrega."} />;

  return <div className="space-y-4">
    <div className="estoque-table-shell overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-950/35"><div className="hidden grid-cols-[2fr_1.2fr_1fr_1fr_auto] gap-4 border-b border-white/[0.06] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 lg:grid"><span>Item</span><span>Responsável</span><span>Entregue em</span><span>Status</span><span>Ação</span></div><div className="divide-y divide-white/[0.06]">{rows.map((row) => {
      const remaining = row.quantity - row.returnedQuantity;
      const title = row.produto?.nome ?? row.kitInstance?.code ?? "Kit / item atribuído";
              return <article key={row.id} className="estoque-table-row grid gap-3 px-4 py-4 lg:grid-cols-[2fr_1.2fr_1fr_1fr_auto] lg:items-center lg:gap-4 lg:px-5"><div className="flex items-center gap-3">{row.produto?.imagem ? <div className="estoque-thumbnail relative size-10 overflow-hidden rounded-xl"><Image src={row.produto.imagem} alt="" fill sizes="40px" unoptimized className="object-cover" /></div> : <div className="estoque-card-icon grid size-10 place-items-center rounded-xl bg-violet-400/10 text-violet-300"><PackageCheck size={18} /></div>}<div><p className="text-sm font-semibold text-slate-100">{title}</p><p className="text-xs text-slate-500">{row.asset?.patrimonio || row.asset?.serial || `${remaining} ${row.produto?.unidade ?? "un."}`}</p></div></div><div><p className="text-sm text-slate-200">{row.responsible?.nome ?? "Responsável não localizado"}</p><p className="text-xs text-slate-500">{row.responsible?.role ?? row.location?.nome ?? "Setor não informado"}</p></div><time className="text-sm text-slate-400">{formatDate(row.deliveredAt)}</time><Badge variant="outline" className="estoque-badge w-fit border-violet-400/20 text-violet-300">{row.status === "PARCIALMENTE_DEVOLVIDA" ? "Devolução parcial" : "Em uso"}</Badge>{canReturn ? <Button size="sm" variant="outline" onClick={() => { setSelected(row); setQuantity("1"); setLocationId(row.locationId ?? ""); }} className="estoque-secondary"><RotateCcw size={14} /> Confirmar devolução</Button> : <span className="text-xs text-slate-600">Devolução confirmada pelo TI</span>}</article>;
    })}</div></div>
    {cursor && <div className="text-center"><Button variant="outline" onClick={() => void load(cursor, true)} disabled={loadingMore} className="estoque-secondary">{loadingMore ? "Carregando..." : "Carregar mais"}</Button></div>}
    {canReturn ? <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="estoque-dialog border-white/10 bg-[#071226] text-white"><DialogHeader><DialogTitle>Registrar devolução</DialogTitle><DialogDescription>{selected?.produto?.nome ?? selected?.kitInstance?.code}</DialogDescription></DialogHeader><form onSubmit={returnAssignment} className="space-y-4"><label className="block space-y-2 text-sm text-slate-300">Quantidade<Input type="number" min={1} max={selected ? selected.quantity - selected.returnedQuantity : 1} value={quantity} onChange={(event) => setQuantity(event.target.value)} required className="estoque-input border-white/10 bg-slate-950/70" /></label><label className="block space-y-2 text-sm text-slate-300">Condição<select value={condition} onChange={(event) => setCondition(event.target.value)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="BOM">Bom</option><option value="COM_AVARIA">Com avaria</option><option value="NECESSITA_MANUTENCAO">Necessita manutenção</option><option value="DANIFICADO">Danificado</option></select></label><label className="block space-y-2 text-sm text-slate-300">Destino<select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="">Sem localização</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.nome}</option>)}</select></label><label className="block space-y-2 text-sm text-slate-300">Observação<textarea value={observation} onChange={(event) => setObservation(event.target.value)} maxLength={2_000} rows={3} className="estoque-textarea w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-2" /></label><DialogFooter><Button type="button" variant="ghost" onClick={() => setSelected(null)} className="estoque-ghost">Cancelar</Button><Button type="submit" disabled={pending} className="estoque-primary">{pending ? "Registrando..." : "Confirmar devolução"}</Button></DialogFooter></form></DialogContent></Dialog> : null}
  </div>;
}
