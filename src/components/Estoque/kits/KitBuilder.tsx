"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { criarInstanciaKit, devolverKit, entregarKit, obterInstanciaKit, salvarComponentesKit } from "@/actions/EstoqueKits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { InventoryKitCatalogProduct, InventoryTagKitView, KitValidationResult } from "@/lib/estoque/kits-domain";

interface KitBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: InventoryTagKitView | null;
  instanceId?: string | null;
  products: InventoryKitCatalogProduct[];
  collaborators: Array<{ id: number; nome: string }>;
  locations: Array<{ id: string; nome: string }>;
  canConfirmReturns?: boolean;
  onSaved: () => void;
}

interface ReturnableComponentView {
  id: string;
  name: string;
  quantity: number;
  returnedQuantity: number;
  usagePolicy: string;
}

export function KitBuilder({ open, onOpenChange, tag, instanceId, products, collaborators, locations, canConfirmReturns = false, onSaved }: KitBuilderProps) {
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(Boolean(instanceId));
  const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(instanceId ?? null);
  const [code, setCode] = useState("");
  const [version, setVersion] = useState(1);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [assetIds, setAssetIds] = useState<Record<string, string[]>>({});
  const [validation, setValidation] = useState<KitValidationResult | null>(null);
  const [kitStatus, setKitStatus] = useState("RASCUNHO");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [returnableComponents, setReturnableComponents] = useState<ReturnableComponentView[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnConditions, setReturnConditions] = useState<Record<string, "BOM" | "COM_AVARIA" | "NECESSITA_MANUTENCAO" | "DANIFICADO">>({});
  const [deliveryIdempotencyKey] = useState(() => `kit-delivery-${crypto.randomUUID()}`);
  const [returnIdempotencyKey] = useState(() => `kit-return-${crypto.randomUUID()}`);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  useEffect(() => {
    if (!open || !tag || !instanceId) return;
    let active = true;
    void obterInstanciaKit(instanceId).then((result) => {
      if (!active) return;
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setCode(result.data.kit.code);
      setVersion(result.data.kit.version);
      setKitStatus(result.data.kit.status);
      setResponsibleUserId(result.data.kit.responsibleUserId ? String(result.data.kit.responsibleUserId) : "");
      setLocationId(result.data.kit.locationId ?? "");
      setReturnableComponents(result.data.kit.components.map((component) => ({
        id: component.id,
        name: component.produto.nome,
        quantity: component.quantity,
        returnedQuantity: component.returnedQuantity,
        usagePolicy: component.produto.usagePolicy,
      })));
      const nextQuantities: Record<string, number> = {};
      const nextAssets: Record<string, string[]> = {};
      for (const component of result.data.kit.components) {
        if (component.assetId) nextAssets[component.requirementId] = [...(nextAssets[component.requirementId] ?? []), component.assetId];
        else nextQuantities[component.requirementId] = (nextQuantities[component.requirementId] ?? 0) + component.quantity;
      }
      setQuantities(nextQuantities);
      setAssetIds(nextAssets);
      setValidation(result.data.validation);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, tag, instanceId]);

  if (!tag) return null;

  function toggleAsset(requirementId: string, assetId: string, maximum: number) {
    setAssetIds((current) => {
      const selected = current[requirementId] ?? [];
      if (selected.includes(assetId)) return { ...current, [requirementId]: selected.filter((id) => id !== assetId) };
      if (selected.length >= maximum) {
        toast.error(`Selecione no máximo ${maximum} patrimônio(s) para este requisito.`);
        return current;
      }
      return { ...current, [requirementId]: [...selected, assetId] };
    });
  }

  function submit() {
    const activeTag = tag;
    if (!activeTag) return;
    startTransition(async () => {
      let kitId = currentInstanceId;
      let kitVersion = version;
      if (!kitId) {
        const created = await criarInstanciaKit({ tagId: activeTag.id, code: code || undefined });
        if (!created.success) {
          toast.error(created.error);
          return;
        }
        kitId = created.data.id;
        kitVersion = created.data.version;
        setCurrentInstanceId(kitId);
        setCode(created.data.code);
      }
      const components: Array<{ requirementId: string; produtoId: string; assetId: string | null; quantity: number }> = [];
      for (const requirement of activeTag.requirements) {
        const product = productById.get(requirement.produtoId);
        if (product?.trackingMode === "INDIVIDUAL") {
          components.push(...(assetIds[requirement.id] ?? []).map((assetId) => ({ requirementId: requirement.id, produtoId: requirement.produtoId, assetId, quantity: 1 })));
          continue;
        }
        const quantity = quantities[requirement.id] ?? 0;
        if (quantity > 0) components.push({ requirementId: requirement.id, produtoId: requirement.produtoId, assetId: null, quantity });
      }
      const saved = await salvarComponentesKit({ kitInstanceId: kitId, version: kitVersion, components });
      if (!saved.success) {
        toast.error(saved.error);
        return;
      }
      setVersion(saved.data.version);
      setValidation(saved.data);
      setKitStatus(saved.data.complete ? "COMPLETO" : "INCOMPLETO");
      toast.success(saved.data.complete ? "Kit completo e validado." : "Kit salvo como incompleto.");
      onSaved();
    });
  }

  function deliver() {
    if (!currentInstanceId || !responsibleUserId) {
      toast.error("Selecione o colaborador responsável.");
      return;
    }
    startTransition(async () => {
      const result = await entregarKit({
        kitInstanceId: currentInstanceId,
        version,
        responsibleUserId: Number(responsibleUserId),
        locationId,
        idempotencyKey: deliveryIdempotencyKey,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setVersion(result.data.version);
      setKitStatus(result.data.status);
      toast.success("Kit entregue e componentes movimentados.");
      onSaved();
    });
  }

  function returnSelected() {
    if (!currentInstanceId) return;
    const lines = returnableComponents.flatMap((component) => {
      const quantity = returnQuantities[component.id] ?? 0;
      return quantity > 0 ? [{
        kitComponentId: component.id,
        quantity,
        condition: returnConditions[component.id] ?? "BOM" as const,
        destinationLocationId: locationId,
      }] : [];
    });
    if (lines.length === 0) {
      toast.error("Selecione ao menos um componente para devolver.");
      return;
    }
    startTransition(async () => {
      const result = await devolverKit({ kitInstanceId: currentInstanceId, version, idempotencyKey: returnIdempotencyKey, lines });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setVersion(result.data.version);
      setKitStatus(result.data.status);
      setReturnableComponents((current) => current.map((component) => ({
        ...component,
        returnedQuantity: component.returnedQuantity + (returnQuantities[component.id] ?? 0),
      })));
      setReturnQuantities({});
      toast.success(result.data.status === "DEVOLVIDO" ? "Kit devolvido por completo." : "Devolução parcial registrada.");
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="estoque-dialog estoque-scroll max-h-[92vh] overflow-y-auto border-white/10 bg-[#071226] text-white sm:max-w-3xl">
        <DialogHeader><DialogTitle>Montar {tag.nome}</DialogTitle><DialogDescription>Selecione patrimônio por patrimônio ou informe a quantidade dos itens quantitativos.</DialogDescription></DialogHeader>
        {loading ? <p className="py-12 text-center text-sm text-slate-400">Carregando composição...</p> : <div className="space-y-5">
          <label className="block space-y-2 text-sm text-slate-300">Código da instância<Input value={code} onChange={(event) => setCode(event.target.value)} disabled={Boolean(currentInstanceId)} placeholder="Gerado automaticamente se vazio" className="estoque-input border-white/10 bg-slate-950/70" /></label>
          <div className="space-y-3">{tag.requirements.map((requirement) => {
            const product = productById.get(requirement.produtoId);
            const status = validation?.requirements.find((item) => item.id === requirement.id);
            const individual = product?.trackingMode === "INDIVIDUAL";
            return <section key={requirement.id} className="estoque-section rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-medium">{requirement.produto.nome}</h4><p className="text-xs text-slate-500">{individual ? "Patrimônio individual" : `${product?.quantidade ?? 0} ${product?.unidade ?? "un"} em estoque`}</p></div><div className="flex items-center gap-2"><Badge variant="outline" className={`estoque-badge ${requirement.required ? "border-blue-400/30 text-blue-200" : "border-slate-600 text-slate-400"}`}>{requirement.required ? "Obrigatório" : "Opcional"}</Badge><span className="text-sm font-semibold">{status?.selectedQuantity ?? (individual ? assetIds[requirement.id]?.length ?? 0 : quantities[requirement.id] ?? 0)}/{requirement.quantityRequired}</span></div></div>
              {individual ? <div className="grid gap-2 sm:grid-cols-2">{product?.assets.length ? product.assets.map((asset) => { const checked = assetIds[requirement.id]?.includes(asset.id) ?? false; return <label key={asset.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate-950/50 p-2 text-sm"><input type="checkbox" checked={checked} onChange={() => toggleAsset(requirement.id, asset.id, requirement.quantityRequired)} /><span>{asset.patrimonio || asset.serial || asset.codigoInterno || asset.id}</span><span className="ml-auto text-[10px] text-slate-500">{asset.status}</span></label>; }) : <p className="text-sm text-amber-300">Nenhum patrimônio cadastrado para este item.</p>}</div> : <Input type="number" min={0} max={requirement.quantityRequired} value={quantities[requirement.id] ?? 0} onChange={(event) => setQuantities((current) => ({ ...current, [requirement.id]: Number(event.target.value) }))} className="estoque-input max-w-36 border-white/10 bg-slate-950/70" />}
            </section>;
          })}</div>
          {validation ? <section className={`estoque-section rounded-xl border p-4 ${validation.complete ? "border-emerald-400/25 bg-emerald-500/10" : "border-amber-400/25 bg-amber-500/10"}`}><div className="flex items-center gap-2 font-semibold">{validation.complete ? <CheckCircle2 className="text-emerald-400" size={19} /> : <CircleAlert className="text-amber-400" size={19} />}{validation.complete ? "KIT COMPLETO" : "KIT INCOMPLETO"}<span className="ml-auto">{validation.percentage}%</span></div><div className="estoque-progress mt-3 h-2 overflow-hidden rounded-full bg-slate-950/60"><div className="estoque-progress-fill h-full bg-blue-400 transition-all" style={{ width: `${validation.percentage}%` }} /></div><p className="mt-2 text-sm text-slate-300">{validation.requiredFulfilled}/{validation.requiredTotal} itens obrigatórios</p>{validation.missing.length > 0 ? <p className="mt-1 text-xs text-amber-200">Falta: {validation.missing.map((item) => `${item.quantity}x ${item.productName}`).join(", ")}</p> : null}</section> : null}
          {kitStatus === "COMPLETO" ? <section className="estoque-section space-y-3 rounded-xl border border-blue-400/20 bg-blue-500/[0.06] p-4"><h4 className="font-semibold">Entregar kit</h4><div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1 text-xs text-slate-400">Quantidade<Input value="1" readOnly aria-label="Quantidade de kits" className="estoque-input border-white/10 bg-slate-900/60 text-slate-400" /></label><select value={responsibleUserId} onChange={(event) => setResponsibleUserId(event.target.value)} className="estoque-select h-9 self-end rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm"><option value="">Selecione o responsável</option>{collaborators.map((person) => <option key={person.id} value={person.id}>{person.nome}</option>)}</select><select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="estoque-select h-9 self-end rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm"><option value="">Sem local específico</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.nome}</option>)}</select></div><p className="text-xs text-slate-500">Cada instância representa 1 kit. Para entregar mais, monte e atribua novas instâncias.</p><Button type="button" onClick={deliver} disabled={pending || !responsibleUserId} className="estoque-primary">Entregar 1 kit e movimentar componentes</Button></section> : null}
          {["EM_USO", "DEVOLUCAO_PENDENTE"].includes(kitStatus) ? canConfirmReturns ? <section className="estoque-section space-y-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-4"><div><h4 className="font-semibold">Devolver componentes</h4><p className="text-xs text-slate-500">Consumíveis já baixados não entram na devolução.</p></div>{returnableComponents.filter((component) => component.usagePolicy !== "CONSUMIVEL" && component.returnedQuantity < component.quantity).map((component) => <div key={component.id} className="grid gap-2 rounded-lg bg-slate-950/40 p-3 sm:grid-cols-[1fr_100px_180px]"><div><p className="text-sm font-medium">{component.name}</p><p className="text-xs text-slate-500">Pendente: {component.quantity - component.returnedQuantity}</p></div><Input type="number" min={0} max={component.quantity - component.returnedQuantity} value={returnQuantities[component.id] ?? 0} onChange={(event) => setReturnQuantities((current) => ({ ...current, [component.id]: Number(event.target.value) }))} className="estoque-input border-white/10 bg-slate-950/70" /><select value={returnConditions[component.id] ?? "BOM"} onChange={(event) => setReturnConditions((current) => ({ ...current, [component.id]: event.target.value as typeof returnConditions[string] }))} className="estoque-select h-9 rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm"><option value="BOM">Bom</option><option value="COM_AVARIA">Com avaria</option><option value="NECESSITA_MANUTENCAO">Necessita manutenção</option><option value="DANIFICADO">Danificado</option></select></div>)}<select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 text-sm"><option value="">Local original da atribuição</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.nome}</option>)}</select><Button type="button" onClick={returnSelected} disabled={pending} className="estoque-primary">Registrar devolução selecionada</Button></section> : <section className="estoque-section rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-4"><h4 className="font-semibold">Devolução aguardando confirmação</h4><p className="mt-1 text-sm text-slate-400">Somente usuários do setor TI podem confirmar a devolução dos componentes.</p></section> : null}
        </div>}
        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="estoque-ghost">Fechar</Button>{["RASCUNHO", "INCOMPLETO", "COMPLETO"].includes(kitStatus) ? <Button type="button" onClick={submit} disabled={pending || loading || tag.requirements.length === 0} className="estoque-primary">{pending ? "Validando..." : "Salvar e validar kit"}</Button> : null}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
