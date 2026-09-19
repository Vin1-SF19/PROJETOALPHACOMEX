"use client";

import { useMemo, useState, useTransition } from "react";
import { CircleHelp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { salvarTagKit } from "@/actions/EstoqueKits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InventoryIconSelect } from "@/components/Estoque/InventoryIconSelect";
import type { InventoryCategory } from "@/lib/estoque/types";
import type { InventoryKitCatalogProduct, InventoryTagKitView } from "@/lib/estoque/kits-domain";

interface RequirementDraft {
  produtoId: string;
  quantityRequired: number;
  required: boolean;
}

interface TagKitEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: InventoryTagKitView | null;
  products: InventoryKitCatalogProduct[];
  categories: InventoryCategory[];
  onSaved: () => void;
}

export function TagKitEditor({ open, onOpenChange, tag, products, categories, onSaved }: TagKitEditorProps) {
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<"ETIQUETA" | "KIT_MODELO">(tag?.kind ?? "KIT_MODELO");
  const [name, setName] = useState(tag?.nome ?? "");
  const [description, setDescription] = useState(tag?.descricao ?? "");
  const [color, setColor] = useState(tag?.cor ?? "#2563eb");
  const [icon, setIcon] = useState(tag?.icone ?? "Package");
  const [categoryId, setCategoryId] = useState(tag?.categoriaId ?? "");
  const [taggedProductIds, setTaggedProductIds] = useState<string[]>(tag?.itemTags.map((item) => item.produto.id) ?? []);
  const [requirements, setRequirements] = useState<RequirementDraft[]>(tag?.requirements.map((item) => ({ produtoId: item.produtoId, quantityRequired: item.quantityRequired, required: item.required })) ?? []);
  const availableRequirementProducts = useMemo(
    () => products.filter((product) => !requirements.some((requirement) => requirement.produtoId === product.id)),
    [products, requirements],
  );

  function addRequirement() {
    const product = availableRequirementProducts[0];
    if (product) setRequirements((current) => [...current, { produtoId: product.id, quantityRequired: 1, required: true }]);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await salvarTagKit({
        id: tag?.id,
        version: tag?.version,
        kind,
        nome: name,
        descricao: description,
        cor: color,
        icone: icon,
        categoriaId: categoryId,
        produtoIds: kind === "ETIQUETA" ? taggedProductIds : [],
        requirements: kind === "KIT_MODELO"
          ? requirements.map((requirement, index) => ({ ...requirement, sortOrder: index }))
          : [],
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(tag ? "Tag/Kit atualizado." : "Tag/Kit criado.");
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="estoque-dialog estoque-scroll max-h-[90vh] overflow-y-auto border-white/10 bg-[#071226] text-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{tag ? "Editar Tag / Kit" : "Nova Tag / Kit"}</DialogTitle>
          <DialogDescription>Tags agrupam itens; modelos de kit também definem quantidades obrigatórias e opcionais.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">Tipo
              <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} disabled={Boolean(tag?.kitInstances.length)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3">
                <option value="KIT_MODELO">Modelo de kit</option><option value="ETIQUETA">Tag simples</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-300">Nome<Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required className="estoque-input border-white/10 bg-slate-950/70" /></label>
          </div>
          <label className="block space-y-2 text-sm text-slate-300">Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={800} rows={2} className="estoque-textarea w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-2" /></label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-2 text-sm text-slate-300">Cor<Input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="estoque-input border-white/10 bg-slate-950/70 p-1" /></label>
            <label className="space-y-2 text-sm text-slate-300">Ícone<InventoryIconSelect value={icon} onChange={setIcon} /></label>
            <label className="space-y-2 text-sm text-slate-300">Categoria
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nome}</option>)}</select>
            </label>
          </div>

          {kind === "ETIQUETA" ? (
            <fieldset className="estoque-section space-y-3 rounded-xl border border-white/10 p-4"><legend className="px-2 text-sm font-medium">Itens vinculados</legend>
              <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">{products.map((product) => <label key={product.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-2 text-sm"><input type="checkbox" checked={taggedProductIds.includes(product.id)} onChange={(event) => setTaggedProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} />{product.nome}</label>)}</div>
            </fieldset>
          ) : (
            <fieldset className="estoque-section space-y-4 rounded-xl border border-white/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><legend className="text-sm font-semibold">Composição do modelo</legend><p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">Escolha exatamente quais produtos formam este kit, a quantidade necessária de cada um e se o componente é obrigatório para o kit ser considerado completo.</p></div><Button type="button" size="sm" variant="outline" onClick={addRequirement} disabled={!availableRequirementProducts.length || Boolean(tag?.kitInstances.length)} className="estoque-secondary"><Plus size={14} /> Adicionar produto</Button></div>
              <div className="flex items-start gap-2 rounded-lg border border-blue-400/10 bg-blue-400/[0.055] p-3 text-xs leading-5 text-slate-400"><CircleHelp size={15} className="mt-0.5 shrink-0 text-blue-300" /><span><strong className="text-blue-200">Obrigatório</strong> entra no cálculo de completude. <strong className="text-blue-200">Opcional</strong> pode ser adicionado ao kit sem impedir sua validação.</span></div>
              {tag?.kitInstances.length ? <p className="rounded-lg bg-amber-400/[0.08] p-3 text-xs text-amber-300">A composição está bloqueada porque já existem kits montados a partir deste modelo. Nome, descrição, cor e ícone ainda podem ser editados.</p> : null}
              {requirements.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center"><p className="text-sm font-medium text-slate-300">Nenhum produto na composição</p><p className="mt-1 text-xs text-slate-500">Clique em “Adicionar produto” para definir o primeiro componente do kit.</p></div> : <div className="space-y-2">
                <div className="hidden grid-cols-[minmax(220px,1fr)_140px_150px_44px] gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:grid"><span>Produto / item</span><span>Quantidade</span><span>Obrigatoriedade</span><span className="sr-only">Ação</span></div>
                {requirements.map((requirement, index) => {
                  const selectedProduct = products.find((product) => product.id === requirement.produtoId);
                    return <div key={`${requirement.produtoId}-${index}`} className="estoque-row-card grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 sm:grid-cols-[minmax(220px,1fr)_140px_150px_44px] sm:items-center">
                    <label className="space-y-1 sm:space-y-0"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:hidden">Produto / item</span><select aria-label={`Produto do componente ${index + 1}`} value={requirement.produtoId} disabled={Boolean(tag?.kitInstances.length)} onChange={(event) => setRequirements((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, produtoId: event.target.value } : item))} className="estoque-select h-10 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm">{products.filter((product) => product.id === requirement.produtoId || !requirements.some((item) => item.produtoId === product.id)).map((product) => <option key={product.id} value={product.id}>{product.nome} · {product.trackingMode === "INDIVIDUAL" ? "Patrimônio" : product.unidade}</option>)}</select>{selectedProduct ? <span className="block text-[10px] text-slate-500">Disponível agora: {selectedProduct.quantidade} {selectedProduct.unidade}</span> : null}</label>
                    <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:hidden">Quantidade necessária</span><Input aria-label={`Quantidade necessária de ${selectedProduct?.nome ?? `componente ${index + 1}`}`} type="number" min={1} max={10_000} value={requirement.quantityRequired} disabled={Boolean(tag?.kitInstances.length)} onChange={(event) => setRequirements((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantityRequired: Number(event.target.value) } : item))} className="estoque-input border-white/10 bg-slate-950/70" /></label>
                    <label className="space-y-1"><span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:hidden">Obrigatoriedade</span><select aria-label={`Obrigatoriedade de ${selectedProduct?.nome ?? `componente ${index + 1}`}`} value={requirement.required ? "OBRIGATORIO" : "OPCIONAL"} disabled={Boolean(tag?.kitInstances.length)} onChange={(event) => setRequirements((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.target.value === "OBRIGATORIO" } : item))} className="estoque-select h-10 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm"><option value="OBRIGATORIO">Obrigatório</option><option value="OPCIONAL">Opcional</option></select></label>
                    <Button type="button" size="icon" variant="ghost" disabled={Boolean(tag?.kitInstances.length)} onClick={() => setRequirements((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover ${selectedProduct?.nome ?? "componente"}`} className="estoque-ghost"><Trash2 size={15} /></Button>
                  </div>;
                })}
                <div className="flex flex-wrap gap-3 px-1 pt-1 text-xs text-slate-500"><span>{requirements.length} produto(s)</span><span>•</span><span>{requirements.filter((item) => item.required).length} obrigatório(s)</span><span>•</span><span>{requirements.filter((item) => !item.required).length} opcional(is)</span></div>
              </div>}
            </fieldset>
          )}
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="estoque-ghost">Cancelar</Button><Button type="submit" disabled={pending} className="estoque-primary">{pending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
