"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderCog, Search, X } from "lucide-react";
import { toast } from "sonner";
import { BuscarItensEstoque } from "@/actions/EstoqueMovimentos";
import { InventoryItemsTable } from "@/components/Estoque/InventoryItemsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InventoryCategory, InventoryItem, InventoryLocation, InventoryStockFilter } from "@/lib/estoque/types";

type InventoryItemsPage = Awaited<ReturnType<typeof BuscarItensEstoque>>;
type InventoryItemsPageRow = InventoryItemsPage["items"][number];

const PAGE_SIZE = 30;

interface InventoryItemsBrowserProps {
  initialItems: InventoryItem[];
  categories: InventoryCategory[];
  locations: InventoryLocation[];
  onSelect: (item: InventoryItem) => void;
  onManageCategories: () => void;
}

export function InventoryItemsBrowser({ initialItems, categories, locations, onSelect, onManageCategories }: InventoryItemsBrowserProps) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stock, setStock] = useState<InventoryStockFilter>("TODOS");
  const [status, setStatus] = useState("");
  const [locationId, setLocationId] = useState("");
  const [items, setItems] = useState<InventoryItem[]>(() => initialItems.slice(0, PAGE_SIZE));
  const [cursor, setCursor] = useState<string | null>(() => initialItems.length >= PAGE_SIZE ? initialItems[PAGE_SIZE - 1]?.id ?? null : null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const completeById = useMemo(() => new Map(initialItems.map((item) => [item.id, item])), [initialItems]);
  const hasFilters = Boolean(search || categoryId || stock !== "TODOS" || status || locationId);

  const hydrate = useCallback((row: InventoryItemsPageRow): InventoryItem => ({
    ...completeById.get(row.id),
    ...row,
    categoriaId: row.categoria.id,
    categoria: row.categoria,
    inventoryAssets: row.inventoryAssets,
  }), [completeById]);

  const query = useCallback(async (nextCursor?: string, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const page = await BuscarItensEstoque({
        query: search.trim() || undefined,
        categoryId: categoryId || undefined,
        status: status || undefined,
        locationId: locationId || undefined,
        stock: stock === "COM_ESTOQUE" ? "WITH_STOCK" : stock === "SEM_ESTOQUE" ? "WITHOUT_STOCK" : stock === "ESTOQUE_BAIXO" ? "LOW_STOCK" : "ALL",
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      const hydrated = page.items.map(hydrate);
      setItems((current) => append ? [...current, ...hydrated.filter((candidate) => !current.some((item) => item.id === candidate.id))] : hydrated);
      setCursor(page.nextCursor);
    } catch {
      toast.error("Não foi possível consultar os itens do estoque.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [categoryId, hydrate, locationId, search, status, stock]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void query(); }, 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  function clearFilters() {
    setSearch("");
    setCategoryId("");
    setStock("TODOS");
    setStatus("");
    setLocationId("");
  }

  return <div className="space-y-4"><section className="estoque-panel grid gap-3 rounded-2xl border border-white/[0.08] bg-slate-900/45 p-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.4fr)_repeat(4,minmax(150px,.7fr))_auto]" aria-label="Filtros do estoque">
    <label className="relative"><span className="sr-only">Buscar no estoque</span><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, código, serial, patrimônio, responsável ou tag" className="estoque-input border-white/10 bg-slate-950/60 pl-9" /></label>
    <label><span className="sr-only">Filtrar por categoria</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-300 outline-none focus:border-blue-400"><option value="">Todas as categorias</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nome}</option>)}</select></label>
    <label><span className="sr-only">Filtrar por status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-300 outline-none focus:border-blue-400"><option value="">Todos os status</option><option value="DISPONIVEL">Disponível</option><option value="EM_USO">Em uso</option><option value="RESERVADO">Reservado</option><option value="EM_MANUTENCAO">Em manutenção</option><option value="DANIFICADO">Danificado</option><option value="BAIXADO">Baixado</option><option value="EXTRAVIADO">Extraviado</option><option value="SEM_ESTOQUE">Sem estoque</option></select></label>
    <label><span className="sr-only">Filtrar por localização</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-300 outline-none focus:border-blue-400"><option value="">Todas as localizações</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.nome}</option>)}</select></label>
    <label><span className="sr-only">Filtrar por saldo</span><select value={stock} onChange={(event) => setStock(event.target.value as InventoryStockFilter)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-300 outline-none focus:border-blue-400"><option value="TODOS">Todos os saldos</option><option value="COM_ESTOQUE">Com estoque</option><option value="SEM_ESTOQUE">Sem estoque</option><option value="ESTOQUE_BAIXO">Estoque baixo</option></select></label>
    <div className="flex gap-1"><Button variant="ghost" onClick={clearFilters} disabled={!hasFilters} className="estoque-ghost"><X size={15} /> Limpar</Button><Button variant="ghost" onClick={onManageCategories} className="estoque-ghost"><FolderCog size={15} /> Categorias</Button></div>
  </section><div className="flex items-center justify-between px-1 text-xs text-slate-500"><span>{loading ? "Consultando..." : `${items.length} itens exibidos`}</span><span>Busca e filtros processados no servidor</span></div><div className={loading ? "pointer-events-none opacity-60" : ""}><InventoryItemsTable items={items} onSelect={onSelect} /></div>{cursor && <div className="text-center"><Button variant="outline" onClick={() => void query(cursor, true)} disabled={loadingMore} className="estoque-secondary">{loadingMore ? "Carregando..." : "Carregar mais itens"}</Button></div>}</div>;
}
