"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { DeletarCategoria, SalvarCategoria } from "@/actions/Estoque";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InventoryIconSelect, inventoryIcon } from "@/components/Estoque/InventoryIconSelect";
import type { InventoryCategory } from "@/lib/estoque/types";

interface InventoryCategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: InventoryCategory[];
  onCategoriesChange: (categories: InventoryCategory[]) => void;
}

interface CategoryDraft {
  id?: string;
  nome: string;
  cor: string;
  icone: string;
  descricao: string;
}

const emptyDraft: CategoryDraft = { nome: "", cor: "#6366f1", icone: "Package", descricao: "" };

export function InventoryCategoryManager({ open, onOpenChange, categories, onCategoriesChange }: InventoryCategoryManagerProps) {
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(draft.id);

  function resetDraft() {
    setDraft(emptyDraft);
  }

  function edit(category: InventoryCategory) {
    setDraft({ id: category.id, nome: category.nome, cor: category.cor ?? "#6366f1", icone: category.icone ?? "Package", descricao: category.descricao ?? "" });
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await SalvarCategoria(draft);
      if (!result.success) {
        toast.error(typeof result.error === "string" ? result.error : "Não foi possível salvar a categoria.");
        return;
      }
      const nextCategory: InventoryCategory = result.data;
      onCategoriesChange([...categories.filter((category) => category.id !== nextCategory.id), nextCategory].sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR")));
      toast.success(editing ? "Categoria atualizada em todo o estoque." : "Categoria criada e pronta para uso.");
      resetDraft();
    });
  }

  function remove(category: InventoryCategory) {
    if (!window.confirm(`Remover a categoria "${category.nome}"? Categorias em uso não podem ser excluídas.`)) return;
    startTransition(async () => {
      const result = await DeletarCategoria(category.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      onCategoriesChange(categories.filter((candidate) => candidate.id !== category.id));
      if (draft.id === category.id) resetDraft();
      toast.success("Categoria removida.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="estoque-dialog estoque-scroll max-h-[90vh] overflow-y-auto border-white/10 bg-[#071226] text-white sm:max-w-2xl">
        <DialogHeader><DialogTitle>Gerenciar categorias</DialogTitle><DialogDescription>Crie ou edite uma categoria. As alterações aparecem imediatamente nos filtros, itens e Tags/Kits, sem atualizar a página.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="estoque-section space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{editing ? "Editar categoria" : "Nova categoria"}</h3>{editing ? <Button type="button" size="sm" variant="ghost" onClick={resetDraft}><X size={14} /> Cancelar edição</Button> : null}</div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_90px]">
            <label className="space-y-1.5 text-xs text-slate-400">Nome<Input value={draft.nome} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} minLength={2} maxLength={80} required placeholder="Ex.: Periféricos" className="estoque-input border-white/10 bg-slate-950/70 text-sm text-white" /></label>
            <label className="space-y-1.5 text-xs text-slate-400">Cor<Input type="color" value={draft.cor} onChange={(event) => setDraft((current) => ({ ...current, cor: event.target.value }))} className="estoque-input border-white/10 bg-slate-950/70 p-1" /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs text-slate-400">Ícone<InventoryIconSelect value={draft.icone} onChange={(icone) => setDraft((current) => ({ ...current, icone }))} /></label>
            <label className="space-y-1.5 text-xs text-slate-400">Descrição opcional<Input value={draft.descricao} onChange={(event) => setDraft((current) => ({ ...current, descricao: event.target.value }))} maxLength={300} placeholder="Quando usar esta categoria" className="estoque-input border-white/10 bg-slate-950/70 text-sm text-white" /></label>
          </div>
          <Button type="submit" disabled={pending || draft.nome.trim().length < 2} className="estoque-primary">{editing ? <Check size={15} /> : <Plus size={15} />}{pending ? "Salvando..." : editing ? "Salvar alterações" : "Adicionar categoria"}</Button>
        </form>
        <section className="space-y-2">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Categorias disponíveis</h3><span className="text-xs text-slate-500">{categories.length} cadastrada(s)</span></div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {categories.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">Nenhuma categoria cadastrada.</p> : categories.map((category) => (
              <div key={category.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${draft.id === category.id ? "border-blue-400/40 bg-blue-400/[0.08]" : "border-white/[0.07] bg-white/[0.025]"}`}>
                {(() => { const CategoryIcon = inventoryIcon(category.icone); return <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${category.cor ?? "#6366f1"}22`, color: category.cor ?? "#6366f1" }}><CategoryIcon size={17} /></span>; })()}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{category.nome}</p>{category.descricao ? <p className="truncate text-xs text-slate-500">{category.descricao}</p> : null}</div>
                <Button type="button" size="icon-sm" variant="ghost" disabled={pending} onClick={() => edit(category)} aria-label={`Editar categoria ${category.nome}`} className="estoque-ghost"><Pencil size={14} /></Button>
                <Button type="button" size="icon-sm" variant="ghost" disabled={pending} onClick={() => remove(category)} aria-label={`Remover categoria ${category.nome}`} className="estoque-ghost"><Trash2 size={14} /></Button>
              </div>
            ))}
          </div>
        </section>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="estoque-secondary">Concluir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
