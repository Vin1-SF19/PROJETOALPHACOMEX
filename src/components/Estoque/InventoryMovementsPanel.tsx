"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowDownUp, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { BuscarMovimentacoesEstoque } from "@/actions/EstoqueMovimentos";
import { InventoryEmptyState } from "@/components/Estoque/InventoryEmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type MovementPage = Awaited<ReturnType<typeof BuscarMovimentacoesEstoque>>;
type MovementRow = MovementPage["items"][number];

const typeLabels: Record<string, string> = {
  ENTRADA: "Entrada", SAIDA: "Saída", EM_USO: "Em uso", DEVOLUCAO: "Devolução",
  TRANSFERENCIA: "Transferência", AJUSTE: "Ajuste", BAIXA: "Baixa", MANUTENCAO: "Manutenção",
  RETORNO_MANUTENCAO: "Retorno de manutenção", PERDA: "Perda", DANO: "Dano", OUTRO: "Outro",
};

function movementVisual(row: MovementRow) {
  if (!row.fromBucket && row.toBucket) return { icon: ArrowDownLeft, sign: "+", color: "text-emerald-300 bg-emerald-400/10" };
  if (row.fromBucket && !row.toBucket) return { icon: ArrowUpRight, sign: "−", color: "text-rose-300 bg-rose-400/10" };
  return { icon: ArrowDownUp, sign: "", color: "text-blue-300 bg-blue-400/10" };
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function movementRoute(metadataJson: string | null | undefined): string | null {
  if (!metadataJson) return null;
  try {
    const metadata = JSON.parse(metadataJson) as { originCompany?: string; destinationLabel?: string | null };
    if (!metadata.originCompany && !metadata.destinationLabel) return null;
    return `${metadata.originCompany || "Alpha Comex & Compliance"} → ${metadata.destinationLabel || "Destino não informado"}`;
  } catch {
    return null;
  }
}

interface InventoryMovementsPanelProps {
  refreshKey?: number;
  productId?: string;
  compact?: boolean;
  mineOnly?: boolean;
}

export function InventoryMovementsPanel({ refreshKey = 0, productId, compact = false, mineOnly = false }: InventoryMovementsPanelProps) {
  const limit = compact ? 8 : 30;
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (nextCursor?: string, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const page = await BuscarMovimentacoesEstoque({ produtoId: productId, limit, cursor: nextCursor, scope: mineOnly ? "MINE" : "ALL" });
      setRows((current) => append ? [...current, ...page.items] : page.items);
      setCursor(page.nextCursor);
    } catch {
      toast.error("Não foi possível carregar as movimentações.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [limit, mineOnly, productId]);

  useEffect(() => {
    // A chamada assíncrona hidrata a view com eventos persistidos do ledger.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, refreshKey]);

  if (loading) return <div className="estoque-panel rounded-2xl border border-white/[0.08] bg-slate-900/45 py-12 text-center text-sm text-slate-400">Carregando movimentações...</div>;
  if (rows.length === 0) return <InventoryEmptyState icon={ArrowDownUp} title={mineOnly ? "Nenhuma movimentação em seu histórico" : "Nenhuma movimentação encontrada"} description={productId ? "Este item ainda não possui eventos no ledger." : mineOnly ? "Entregas, devoluções e movimentações dos seus itens aparecerão aqui." : "Entradas, saídas, atribuições e devoluções aparecerão aqui."} />;

  return <div className="space-y-4"><div className="estoque-table-shell overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-950/35"><div className="divide-y divide-white/[0.06]">{rows.map((row) => {
    const visual = movementVisual(row);
    const Icon = visual.icon;
    const route = movementRoute(row.operation.metadataJson);
    return <article key={row.id} className="estoque-table-row flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5"><div className={`estoque-card-icon grid size-10 shrink-0 place-items-center rounded-xl ${visual.color}`}><Icon size={18} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-100">{row.produto.nome}</p><Badge variant="outline" className="estoque-badge border-white/10 text-[10px] text-slate-400">{typeLabels[row.operation.type] ?? row.operation.type}</Badge></div><p className="mt-1 truncate text-xs text-slate-500">{row.operation.observacao || `${row.fromBucket ?? "Externo"} → ${row.toBucket ?? "Externo"}`}</p>{route ? <p className="mt-1 truncate text-[11px] text-blue-300/75">{route}</p> : null}</div><div className="sm:text-right"><p className="text-sm font-black tabular-nums text-white">{visual.sign}{row.quantity}</p><p className="text-xs text-slate-500">{row.operation.actorNameSnapshot}</p></div><time className="text-xs text-slate-600 sm:w-32 sm:text-right">{formatDate(row.operation.occurredAt)}</time></article>;
  })}</div></div>{cursor && !compact && <div className="text-center"><Button variant="outline" onClick={() => void load(cursor, true)} disabled={loadingMore} className="estoque-secondary">{loadingMore ? "Carregando..." : "Carregar mais"}</Button></div>}</div>;
}
