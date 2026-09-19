"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, Archive, CheckCircle2, CircleX, Eye, Layers3, Pencil, Plus, Search, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { arquivarTagKit, carregarPainelKits, excluirTagKitDefinitivamente } from "@/actions/EstoqueKits";
import { InventoryEmptyState } from "@/components/Estoque/InventoryEmptyState";
import { KitBuilder } from "@/components/Estoque/kits/KitBuilder";
import { TagKitEditor } from "@/components/Estoque/kits/TagKitEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inventoryIcon } from "@/components/Estoque/InventoryIconSelect";
import type { InventoryCategory } from "@/lib/estoque/types";
import { inventoryKitAvailability, type InventoryKitsPanelData, type InventoryTagKitView } from "@/lib/estoque/kits-domain";

interface InventoryKitsPanelProps {
  categories: InventoryCategory[];
  canConfirmReturns?: boolean;
  movementRequest?: { tagId: string; instanceId: string | null; token: number } | null;
  onMovementRequestHandled?: () => void;
}

export function InventoryKitsPanel({ categories, canConfirmReturns = false, movementRequest, onMovementRequestHandled }: InventoryKitsPanelProps) {
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InventoryKitsPanelData>({ tags: [], products: [], collaborators: [], locations: [], nextTagCursor: null });
  const [editorOpen, setEditorOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<InventoryTagKitView | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");

  const load = useCallback(async () => {
    const result = await carregarPainelKits();
    if (result.success) setData(result.data);
    else toast.error(result.error);
  }, []);

  useEffect(() => {
    let active = true;
    void carregarPainelKits().then((result) => {
      if (!active) return;
      if (result.success) setData(result.data);
      else toast.error(result.error);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!movementRequest || loading) return;
    const tag = data.tags.find((candidate) => candidate.id === movementRequest.tagId);
    if (!tag) return;
    const timeout = window.setTimeout(() => {
      setSelectedTag(tag);
      setSelectedInstanceId(movementRequest.instanceId);
      setBuilderOpen(true);
      onMovementRequestHandled?.();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [data.tags, loading, movementRequest, onMovementRequestHandled]);

  function openEditor(tag: InventoryTagKitView | null) {
    setSelectedTag(tag);
    setEditorOpen(true);
  }

  function openBuilder(tag: InventoryTagKitView, instanceId: string | null = null) {
    setSelectedTag(tag);
    setSelectedInstanceId(instanceId);
    setBuilderOpen(true);
  }

  function archive(tag: InventoryTagKitView) {
    if (!window.confirm(`Arquivar "${tag.nome}"? O histórico será preservado.`)) return;
    startTransition(async () => {
      const result = await arquivarTagKit({ id: tag.id, version: tag.version });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Tag/Kit arquivado.");
      await load();
    });
  }

  function permanentlyDelete(tag: InventoryTagKitView) {
    const confirmation = window.prompt(`Excluir definitivamente "${tag.nome}" e seus kits ainda sem histórico?\n\nEsta ação não pode ser desfeita. Digite EXCLUIR para confirmar.`);
    if (confirmation !== "EXCLUIR") return;
    startTransition(async () => {
      const result = await excluirTagKitDefinitivamente({ id: tag.id, confirmation });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Tag/Kit excluída definitivamente.");
      await load();
    });
  }

  function loadMoreTags() {
    if (!data.nextTagCursor) return;
    startTransition(async () => {
      const result = await carregarPainelKits({ cursor: data.nextTagCursor });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setData((current) => ({
        ...result.data,
        tags: [...current.tags, ...result.data.tags.filter((tag) => !current.tags.some((currentTag) => currentTag.id === tag.id))],
      }));
    });
  }

  function searchCatalog() {
    const query = catalogQuery.trim();
    if (query.length < 2) {
      toast.error("Digite ao menos 2 caracteres para buscar no catálogo.");
      return;
    }
    startTransition(async () => {
      const result = await carregarPainelKits({ productQuery: query, productLimit: 250 });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setData((current) => ({
        ...current,
        products: [
          ...current.products,
          ...result.data.products.filter((product) => !current.products.some((currentProduct) => currentProduct.id === product.id)),
        ],
      }));
      if (result.data.products.length === 0) toast.info("Nenhum item encontrado no catálogo.");
      else toast.success(`${result.data.products.length} item(ns) disponível(is) para a composição.`);
    });
  }

  if (loading) return <div className="estoque-panel rounded-2xl border border-white/[0.08] bg-slate-900/45 py-16 text-center text-sm text-slate-400">Carregando Tags e Kits...</div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-semibold">Tags e modelos de kit</h3><p className="text-sm text-slate-500">Agrupe itens ou defina composições reutilizáveis para kits reais.</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex min-w-64 items-center gap-2"><Input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); searchCatalog(); } }} placeholder="Buscar item para composição" className="estoque-input border-white/10 bg-slate-950/70" aria-label="Buscar item no catálogo para Tags e Kits" /><Button type="button" size="icon" variant="outline" onClick={searchCatalog} disabled={pending} aria-label="Buscar no catálogo" className="estoque-secondary"><Search size={15} /></Button></div><Button onClick={() => openEditor(null)} className="estoque-primary"><Plus size={15} /> Nova Tag / Kit</Button></div></div>
    {data.tags.length === 0 ? <InventoryEmptyState icon={Tags} title="Nenhuma Tag ou Kit criado" description="Crie uma tag simples ou um modelo com requisitos obrigatórios e opcionais." /> : <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{data.tags.map((tag) => {
      const assembled = tag.kitInstances.length;
      const required = tag.requirements.filter((item) => item.required).length;
      const optional = tag.requirements.length - required;
      const availability = inventoryKitAvailability(tag, data.products);
      const TagIcon = inventoryIcon(tag.icone);
      const alertNames = availability.requirements.filter((item) => item.required && item.kitsPossible <= 1).map((item) => item.produto.nome);
      return <article key={tag.id} className={`estoque-kit-card overflow-hidden rounded-2xl border bg-slate-900/55 shadow-xl shadow-black/10 ${availability.alert === "CRITICAL" ? "border-rose-500/45" : availability.alert === "WARNING" ? "border-amber-400/40" : "border-white/[0.08]"}`}><div className="h-1" style={{ backgroundColor: tag.cor }} /><div className="space-y-4 p-5"><div className="flex items-start gap-3"><div className="rounded-xl p-2.5" style={{ backgroundColor: `${tag.cor}22`, color: tag.cor }}><TagIcon size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="truncate font-semibold">{tag.nome}</h4><Badge variant="outline" className="border-white/10 text-[10px] text-slate-400">{tag.kind === "KIT_MODELO" ? "KIT" : "TAG"}</Badge></div><p className="mt-1 line-clamp-2 text-xs text-slate-500">{tag.descricao || "Sem descrição"}</p></div></div>
        {tag.kind === "KIT_MODELO" && availability.alert !== "OK" ? <div className={`flex gap-2 rounded-xl border p-3 text-xs leading-5 ${availability.alert === "CRITICAL" ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "animate-pulse border-amber-400/30 bg-amber-400/10 text-amber-100 motion-reduce:animate-none"}`}>{availability.alert === "CRITICAL" ? <CircleX size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}<div><strong className="block">{availability.alert === "CRITICAL" ? "Kit indisponível" : "Estoque perto do limite"}</strong><span>{alertNames.join(", ")}</span></div></div> : null}
        {tag.kind === "KIT_MODELO" ? <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-white/[0.03] p-2.5"><strong className="block text-slate-200">{required}</strong><span className="text-slate-500">obrigatórios</span></div><div className="rounded-lg bg-white/[0.03] p-2.5"><strong className="block text-slate-200">{optional}</strong><span className="text-slate-500">opcionais</span></div><div className="rounded-lg bg-emerald-500/[0.07] p-2.5"><strong className="block text-emerald-300">{availability.completeKitsPossible}</strong><span className="text-slate-500">disponível(is) agora</span></div><div className="rounded-lg bg-blue-500/[0.07] p-2.5"><strong className="block text-blue-300">{assembled}</strong><span className="text-slate-500">kit(s) montado(s)</span></div></div> : <p className="text-sm text-slate-400">{tag.itemTags.length} item(ns) vinculado(s)</p>}
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setSelectedTag(tag); setDetailsOpen(true); }} className="estoque-secondary"><Eye size={14} /> Ver</Button>{tag.kind === "KIT_MODELO" ? <Button size="sm" onClick={() => openBuilder(tag)} disabled={tag.requirements.length === 0} className="estoque-primary"><Plus size={14} /> Montar Kit</Button> : null}<Button size="sm" variant="ghost" onClick={() => openEditor(tag)} className="estoque-ghost"><Pencil size={14} /> Editar</Button><Button size="icon" variant="ghost" onClick={() => archive(tag)} disabled={pending} aria-label={`Arquivar ${tag.nome}`} title="Arquivar" className="estoque-ghost"><Archive size={14} /></Button><Button size="icon" variant="ghost" onClick={() => permanentlyDelete(tag)} disabled={pending} aria-label={`Excluir definitivamente ${tag.nome}`} title="Excluir definitivamente" className="estoque-ghost text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"><Trash2 size={14} /></Button></div>
      </div></article>;
    })}</div>}
    {data.nextTagCursor ? <div className="flex justify-center"><Button type="button" variant="outline" onClick={loadMoreTags} disabled={pending} className="estoque-secondary">{pending ? "Carregando..." : "Carregar mais Tags / Kits"}</Button></div> : null}

    {editorOpen ? <TagKitEditor open onOpenChange={setEditorOpen} tag={selectedTag} products={data.products} categories={categories} onSaved={load} /> : null}
    {builderOpen ? <KitBuilder open onOpenChange={setBuilderOpen} tag={selectedTag} instanceId={selectedInstanceId} products={data.products} collaborators={data.collaborators} locations={data.locations} canConfirmReturns={canConfirmReturns} onSaved={load} /> : null}
    <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}><DialogContent className="estoque-dialog estoque-scroll max-h-[90vh] overflow-y-auto border-white/10 bg-[#071226] text-white sm:max-w-4xl"><DialogHeader><DialogTitle>{selectedTag?.nome}</DialogTitle><DialogDescription>{selectedTag?.descricao || "Detalhes, disponibilidade e instâncias deste modelo."}</DialogDescription></DialogHeader>{selectedTag ? (() => {
      const availability = inventoryKitAvailability(selectedTag, data.products);
      return <div className="space-y-5">{selectedTag.kind === "KIT_MODELO" ? <><section className={`rounded-2xl border p-4 ${availability.alert === "CRITICAL" ? "border-rose-500/30 bg-rose-500/[0.08]" : availability.alert === "WARNING" ? "border-amber-400/30 bg-amber-400/[0.08]" : "border-emerald-400/25 bg-emerald-400/[0.07]"}`}><div className="flex items-center gap-3">{availability.alert === "CRITICAL" ? <CircleX className="text-rose-300" /> : availability.alert === "WARNING" ? <AlertTriangle className="text-amber-300" /> : <CheckCircle2 className="text-emerald-300" />}<div><p className="font-semibold">{availability.completeKitsPossible} kit(s) completo(s) podem ser montados agora</p><p className="text-xs text-slate-400">Cálculo feito com o estoque disponível de todos os itens obrigatórios.</p></div></div></section><section><h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Layers3 size={16} /> Composição e disponibilidade</h4><div className="overflow-hidden rounded-xl border border-white/[0.08]"><div className="hidden grid-cols-[minmax(180px,1fr)_90px_90px_120px] gap-3 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:grid"><span>Produto / descrição</span><span>Disponível</span><span>Necessário</span><span>Situação</span></div>{availability.requirements.map((requirement) => <div key={requirement.id} className="grid gap-2 border-t border-white/[0.06] px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(180px,1fr)_90px_90px_120px] sm:items-center"><div><p className="text-sm font-medium">{requirement.produto.nome}</p><p className="mt-0.5 text-xs text-slate-500">{requirement.product?.descricao || [requirement.product?.marca, requirement.product?.modelo].filter(Boolean).join(" · ") || (requirement.product?.trackingMode === "INDIVIDUAL" ? "Patrimônio individual" : `Controle por ${requirement.product?.unidade || "unidade"}`)}</p></div><p className="text-sm"><span className="text-[10px] uppercase text-slate-600 sm:hidden">Disponível: </span><strong>{requirement.available}</strong> {requirement.product?.unidade}</p><p className="text-sm"><span className="text-[10px] uppercase text-slate-600 sm:hidden">Necessário: </span><strong>{requirement.quantityRequired}</strong></p><div><Badge variant="outline" className={requirement.available === 0 && requirement.required ? "border-rose-400/30 text-rose-300" : requirement.kitsPossible <= 1 && requirement.required ? "border-amber-400/30 text-amber-300" : "border-emerald-400/25 text-emerald-300"}>{requirement.available === 0 && requirement.required ? `Faltam ${requirement.quantityRequired}` : requirement.missingForOne > 0 && requirement.required ? `Faltam ${requirement.missingForOne}` : requirement.required ? `${requirement.kitsPossible} kit(s)` : "Opcional"}</Badge></div></div>)}</div></section></> : <section><h4 className="mb-2 text-sm font-semibold">Itens vinculados</h4><div className="space-y-2">{selectedTag.itemTags.map((item) => <div key={item.produto.id} className="rounded-lg bg-white/[0.03] p-3 text-sm">{item.produto.nome}</div>)}</div></section>}{selectedTag.kind === "KIT_MODELO" ? <section><h4 className="mb-2 text-sm font-semibold">Kits montados</h4>{selectedTag.kitInstances.length === 0 ? <p className="text-sm text-slate-500">Nenhum kit montado.</p> : <div className="space-y-2">{selectedTag.kitInstances.map((instance) => <button key={instance.id} type="button" onClick={() => { setDetailsOpen(false); openBuilder(selectedTag, instance.id); }} className="flex w-full items-center gap-3 rounded-lg bg-white/[0.03] p-3 text-left text-sm transition hover:bg-white/[0.07]"><CheckCircle2 size={16} className={instance.status === "COMPLETO" ? "text-emerald-400" : "text-amber-400"} /><span className="font-medium">{instance.code}</span><span className="ml-auto text-xs text-slate-500">{instance.fulfilledQuantityCache}/{instance.requiredQuantityCache} · {instance.status}</span></button>)}</div>}</section> : null}</div>;
    })() : null}</DialogContent></Dialog>
  </div>;
}
