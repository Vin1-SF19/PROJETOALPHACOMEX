"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronDown, FileText, ImageOff, Paperclip, Package, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { SalvarProduto } from "@/actions/Estoque";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { removeInventoryItemImage, uploadInventoryItemImage } from "@/lib/estoque/images-client";
import { DEFAULT_INVENTORY_IMAGE_MAX_BYTES, validateInventoryImageMetadata } from "@/lib/estoque/images";
import { DEFAULT_INVENTORY_INVOICE_MAX_BYTES, validateInventoryInvoiceMetadata } from "@/lib/estoque/documents";
import { removeInventoryInvoice, uploadInventoryInvoice } from "@/lib/estoque/documents-client";
import type { InventoryCategory, InventoryItem, InventoryLocation } from "@/lib/estoque/types";

interface InventoryItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: InventoryCategory[];
  locations: InventoryLocation[];
  item?: InventoryItem | null;
  onSaved?: () => void;
}

interface FormState {
  nome: string;
  descricao: string;
  categoriaId: string;
  marca: string;
  modelo: string;
  codigoInterno: string;
  trackingMode: "QUANTIDADE" | "INDIVIDUAL";
  usagePolicy: "RETORNAVEL" | "CONSUMIVEL";
  unidade: string;
  estoqueMinimo: string;
  defaultLocationId: string;
  observacoes: string;
  dataAquisicao: string;
  valorAquisicao: string;
  fornecedor: string;
}

function dateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function currencyInputValue(cents: number | null | undefined): string {
  return cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

function parseCurrencyToCents(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function initialState(item: InventoryItem | null | undefined, categories: InventoryCategory[]): FormState {
  return {
    nome: item?.nome ?? "",
    descricao: item?.descricao ?? "",
    categoriaId: item?.categoriaId ?? categories[0]?.id ?? "",
    marca: item?.marca ?? "",
    modelo: item?.modelo ?? "",
    codigoInterno: item?.codigoInterno ?? "",
    trackingMode: item?.trackingMode === "INDIVIDUAL" ? "INDIVIDUAL" : "QUANTIDADE",
    usagePolicy: item?.usagePolicy === "CONSUMIVEL" ? "CONSUMIVEL" : "RETORNAVEL",
    unidade: item?.unidade ?? "unidade",
    estoqueMinimo: String(item?.estoqueMinimo ?? 1),
    defaultLocationId: item?.defaultLocationId ?? "",
    observacoes: item?.observacoes ?? "",
    dataAquisicao: dateInputValue(item?.dataAquisicao),
    valorAquisicao: currencyInputValue(item?.valorAquisicaoCentavos),
    fornecedor: item?.fornecedor ?? "",
  };
}

const fieldClass = "estoque-input border-white/10 bg-slate-950/70";
const selectClass = "estoque-select flex h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm outline-none focus:border-blue-400";

export function InventoryItemForm({ open, onOpenChange, categories, locations, item, onSaved }: InventoryItemFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() => initialState(item, categories));
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(item?.imagem ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const currentInvoice = item?.inventoryImages?.[0] ?? null;
  const [invoice, setInvoice] = useState<File | null>(null);
  const [removeInvoice, setRemoveInvoice] = useState(false);

  useEffect(() => {
    return () => {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    };
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectPhoto(file: File | undefined) {
    if (!file) return;
    const error = validateInventoryImageMetadata(file, DEFAULT_INVENTORY_IMAGE_MAX_BYTES);
    if (error) {
      toast.error(error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    const objectUrl = URL.createObjectURL(file);
    localPreviewRef.current = objectUrl;
    setPhoto(file);
    setPreviewUrl(objectUrl);
    setRemovePhoto(false);
  }

  function requestPhotoRemoval() {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = null;
    setPhoto(null);
    setPreviewUrl(null);
    setRemovePhoto(Boolean(item?.imagem));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function selectInvoice(file: File | undefined) {
    if (!file) return;
    const error = validateInventoryInvoiceMetadata(file);
    if (error) {
      toast.error(error);
      if (invoiceInputRef.current) invoiceInputRef.current.value = "";
      return;
    }
    setInvoice(file);
    setRemoveInvoice(false);
  }

  function requestInvoiceRemoval() {
    setInvoice(null);
    setRemoveInvoice(Boolean(currentInvoice));
    if (invoiceInputRef.current) invoiceInputRef.current.value = "";
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valueCents = parseCurrencyToCents(form.valorAquisicao);
    if (form.valorAquisicao.trim() && valueCents == null) {
      toast.error("Informe um valor de aquisição válido.");
      return;
    }

    startTransition(async () => {
      const result = await SalvarProduto({
        id: item?.id,
        ...form,
        estoqueMinimo: Number(form.estoqueMinimo),
        quantidade: 0,
        valorAquisicaoCentavos: valueCents,
      });
      if (!result.success) {
        toast.error(typeof result.error === "string" ? result.error : "Não foi possível salvar o item.");
        return;
      }

      try {
        if (photo) await uploadInventoryItemImage(result.itemId, photo);
        else if (removePhoto && item?.imagem) await removeInventoryItemImage(result.itemId);
        if (invoice) await uploadInventoryInvoice(result.itemId, invoice);
        else if (removeInvoice && currentInvoice) await removeInventoryInvoice(result.itemId);
        toast.success(item ? "Item atualizado com sucesso." : "Item cadastrado. Registre uma entrada para adicionar saldo.");
      } catch (error) {
        toast.error(error instanceof Error ? `${error.message} Os demais dados foram salvos.` : "Os dados foram salvos, mas a foto não pôde ser atualizada.");
      }
      onOpenChange(false);
      onSaved?.();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="estoque-dialog estoque-scroll max-h-[92vh] overflow-y-auto border-white/10 bg-[#071226] text-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar item" : "Novo item"}</DialogTitle>
          <DialogDescription>Informações cadastrais não alteram o saldo. Entradas e saídas permanecem sempre rastreáveis.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          <section className="grid gap-5 md:grid-cols-[180px_1fr]">
            <div className="space-y-3">
              <div className="estoque-thumbnail relative grid aspect-square place-items-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-slate-950/70">
                {previewUrl ? <Image src={previewUrl} alt="Pré-visualização da foto do item" fill sizes="180px" unoptimized className="object-cover" /> : <Camera className="text-slate-600" size={34} aria-hidden="true" />}
              </div>
              <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => selectPhoto(event.target.files?.[0])} />
              <Button type="button" variant="outline" className="estoque-secondary w-full" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> {previewUrl ? "Trocar foto" : "Selecionar foto"}</Button>
              {previewUrl && <Button type="button" variant="ghost" className="estoque-ghost w-full text-rose-300 hover:text-rose-200" onClick={requestPhotoRemoval}><ImageOff size={15} /> Remover</Button>}
              <p className="text-center text-[11px] leading-4 text-slate-500">PNG, JPG/JPEG ou WebP. Até {DEFAULT_INVENTORY_IMAGE_MAX_BYTES / 1024 / 1024} MB.</p>
            </div>

            <div className="space-y-4">
              <label className="block space-y-2 text-sm text-slate-300">Nome do item<Input value={form.nome} onChange={(event) => update("nome", event.target.value)} minLength={2} maxLength={160} required placeholder="Notebook Dell Latitude 5440" className={fieldClass} /></label>
              <label className="block space-y-2 text-sm text-slate-300">Descrição<textarea value={form.descricao} onChange={(event) => update("descricao", event.target.value)} maxLength={2_000} rows={3} placeholder="Características e finalidade do item" className="w-full resize-y rounded-md border border-white/10 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:border-blue-400" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 text-sm text-slate-300">Categoria<select value={form.categoriaId} onChange={(event) => update("categoriaId", event.target.value)} required className={selectClass}><option value="">Selecione</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nome}</option>)}</select></label>
                <label className="block space-y-2 text-sm text-slate-300">Tipo de controle<select value={form.trackingMode} onChange={(event) => update("trackingMode", event.target.value as FormState["trackingMode"])} className={selectClass}><option value="QUANTIDADE">Por quantidade</option><option value="INDIVIDUAL">Individual / patrimônio</option></select></label>
              </div>
              {form.trackingMode === "INDIVIDUAL" && <div className="rounded-xl border border-blue-400/15 bg-blue-400/[0.07] p-3 text-xs leading-5 text-blue-200">Após salvar o cadastro, adicione as unidades patrimoniais para informar serial e patrimônio sem misturar esses dados ao saldo quantitativo.</div>}
            </div>
          </section>

          <section className="estoque-section grid gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block space-y-2 text-sm text-slate-300">Unidade<Input value={form.unidade} onChange={(event) => update("unidade", event.target.value)} minLength={1} maxLength={30} required className={fieldClass} /></label>
            <label className="block space-y-2 text-sm text-slate-300">Quantidade mínima<Input value={form.estoqueMinimo} onChange={(event) => update("estoqueMinimo", event.target.value)} type="number" min={0} max={1_000_000} required className={fieldClass} /></label>
            <label className="block space-y-2 text-sm text-slate-300">Localização<select value={form.defaultLocationId} onChange={(event) => update("defaultLocationId", event.target.value)} className={selectClass}><option value="">Não informada</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.nome}</option>)}</select></label>
            <label className="block space-y-2 text-sm text-slate-300">Natureza<select value={form.usagePolicy} onChange={(event) => update("usagePolicy", event.target.value as FormState["usagePolicy"])} className={selectClass}><option value="RETORNAVEL">Retornável</option><option value="CONSUMIVEL">Consumível</option></select></label>
          </section>

          <details className="estoque-section group rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"><span className="flex items-center gap-2"><Package size={16} /> Mais informações</span><ChevronDown size={16} className="transition-transform group-open:rotate-180" /></summary>
            <div className="grid gap-4 border-t border-white/[0.06] p-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block space-y-2 text-sm text-slate-300">Marca<Input value={form.marca} onChange={(event) => update("marca", event.target.value)} maxLength={120} className={fieldClass} /></label>
              <label className="block space-y-2 text-sm text-slate-300">Modelo<Input value={form.modelo} onChange={(event) => update("modelo", event.target.value)} maxLength={120} className={fieldClass} /></label>
              <label className="block space-y-2 text-sm text-slate-300">Código interno<Input value={form.codigoInterno} onChange={(event) => update("codigoInterno", event.target.value)} maxLength={100} className={fieldClass} /></label>
              <label className="block space-y-2 text-sm text-slate-300">Data de aquisição<Input value={form.dataAquisicao} onChange={(event) => update("dataAquisicao", event.target.value)} type="date" className={fieldClass} /></label>
              <label className="block space-y-2 text-sm text-slate-300">Valor de aquisição (R$)<Input value={form.valorAquisicao} onChange={(event) => update("valorAquisicao", event.target.value)} inputMode="decimal" placeholder="0,00" className={fieldClass} /></label>
              <label className="block space-y-2 text-sm text-slate-300">Nota fiscal
                <input ref={invoiceInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => selectInvoice(event.target.files?.[0])} />
                <span className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-slate-950/70 px-2">
                  <FileText size={15} className="shrink-0 text-slate-500" />
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{invoice?.name || (!removeInvoice && currentInvoice ? "Nota fiscal anexada" : "PDF ou imagem")}</span>
                  {(invoice || (!removeInvoice && currentInvoice)) ? <button type="button" onClick={requestInvoiceRemoval} className="rounded p-1 text-slate-500 hover:text-rose-300" aria-label="Remover nota fiscal"><X size={13} /></button> : null}
                  <button type="button" onClick={() => invoiceInputRef.current?.click()} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-blue-200 hover:bg-blue-400/10"><Paperclip size={12} className="mr-1 inline" />Anexar</button>
                </span>
                <span className="block text-[10px] text-slate-500">PDF, JPG, PNG ou WebP · até {DEFAULT_INVENTORY_INVOICE_MAX_BYTES / 1024 / 1024} MB</span>
              </label>
              <label className="block space-y-2 text-sm text-slate-300">Fornecedor<Input value={form.fornecedor} onChange={(event) => update("fornecedor", event.target.value)} maxLength={160} className={fieldClass} /></label>
              <label className="block space-y-2 text-sm text-slate-300 sm:col-span-2 lg:col-span-3">Observações<textarea value={form.observacoes} onChange={(event) => update("observacoes", event.target.value)} maxLength={4_000} rows={3} className="w-full resize-y rounded-md border border-white/10 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:border-blue-400" /></label>
            </div>
          </details>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="estoque-ghost"><X size={15} /> Cancelar</Button>
            <Button type="submit" disabled={pending || categories.length === 0} className="estoque-primary bg-blue-500 text-white hover:bg-blue-400">{pending ? "Salvando..." : item ? "Salvar alterações" : "Salvar item"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
