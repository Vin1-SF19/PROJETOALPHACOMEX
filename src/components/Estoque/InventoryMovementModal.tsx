"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, Boxes, Building2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { AtribuirItemEstoque, BuscarResponsaveisEstoque, EnviarItemManutencao, MovimentarEstoque } from "@/actions/EstoqueMovimentos";
import { carregarPainelKits } from "@/actions/EstoqueKits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { InventoryItem, InventoryLocation } from "@/lib/estoque/types";
import type { InventoryTagKitView } from "@/lib/estoque/kits-domain";

const INVENTORY_ORIGIN_COMPANY = "Alpha Comex & Compliance";
interface KitMovementOption { value: string; label: string; tagId: string; instanceId: string | null }

export type MovementChoice = "ENTRADA" | "SAIDA" | "EM_USO" | "TRANSFERENCIA" | "AJUSTE" | "BAIXA" | "MANUTENCAO" | "PERDA" | "DANO" | "OUTRO";

const movementLabels: Record<MovementChoice, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  EM_USO: "Colocar em uso",
  TRANSFERENCIA: "Transferência",
  AJUSTE: "Ajuste",
  BAIXA: "Baixa",
  MANUTENCAO: "Enviar para manutenção",
  PERDA: "Perda",
  DANO: "Dano",
  OUTRO: "Outro",
};

interface InventoryMovementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
  locations: InventoryLocation[];
  initialItem?: InventoryItem | null;
  initialType?: MovementChoice;
  onCompleted?: () => void;
  onRegisterAsset?: (item: InventoryItem) => void;
  onMoveKit?: (tagId: string, instanceId: string | null) => void;
}

export function InventoryMovementModal({ open, onOpenChange, items, locations, initialItem, initialType = "ENTRADA", onCompleted, onRegisterAsset, onMoveKit }: InventoryMovementModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<MovementChoice>(initialType);
  const [itemId, setItemId] = useState(initialItem?.id ?? items[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [fromLocationId, setFromLocationId] = useState(initialItem?.defaultLocationId ?? "");
  const [toLocationId, setToLocationId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [adjustmentDirection, setAdjustmentDirection] = useState<"INCREASE" | "DECREASE">("INCREASE");
  const [customDirection, setCustomDirection] = useState<"IN" | "OUT">("IN");
  const [observation, setObservation] = useState("");
  const [provider, setProvider] = useState("");
  const [entityType, setEntityType] = useState<"ITEM" | "KIT">("ITEM");
  const [destinationLabel, setDestinationLabel] = useState("");
  const [kitSelection, setKitSelection] = useState("");
  const [kitModels, setKitModels] = useState<InventoryTagKitView[]>([]);
  const [responsibles, setResponsibles] = useState<Array<{ id: number; nome: string; role: string }>>([]);

  const item = useMemo(() => items.find((candidate) => candidate.id === itemId) ?? null, [itemId, items]);
  const availableAssets = item?.inventoryAssets?.filter((asset) => asset.status === "DISPONIVEL") ?? [];
  const individualEntry = type === "ENTRADA" && item?.trackingMode === "INDIVIDUAL";
  const needsReason = ["SAIDA", "AJUSTE", "BAIXA", "MANUTENCAO", "PERDA", "DANO", "OUTRO"].includes(type);

  useEffect(() => {
    if (!open || type !== "EM_USO" || responsibles.length > 0) return;
    void BuscarResponsaveisEstoque({ limit: 100 }).then(setResponsibles).catch(() => toast.error("Não foi possível carregar os responsáveis."));
  }, [open, responsibles.length, type]);

  useEffect(() => {
    if (!open || entityType !== "KIT" || kitModels.length > 0) return;
    void carregarPainelKits({ tagLimit: 50 }).then((result) => {
      if (result.success) setKitModels(result.data.tags.filter((tag) => tag.kind === "KIT_MODELO"));
      else toast.error(result.error);
    });
  }, [entityType, kitModels.length, open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    if (individualEntry) {
      toast.info("Cadastre a unidade patrimonial para registrar esta entrada.");
      return;
    }
    startTransition(async () => {
      const common = {
        idempotencyKey: crypto.randomUUID(),
        produtoId: item.id,
        quantity: Number(quantity),
        fromLocationId: fromLocationId || undefined,
        toLocationId: toLocationId || undefined,
        assetId: assetId || undefined,
        observacao: observation.trim() || undefined,
      };
      const movementMetadata = { originCompany: INVENTORY_ORIGIN_COMPANY, destinationLabel: destinationLabel.trim() || null };
      let result;
      if (type === "EM_USO") {
        result = await AtribuirItemEstoque({ ...common, responsibleUserId: Number(responsibleUserId), metadata: movementMetadata });
      } else if (type === "MANUTENCAO") {
        result = await EnviarItemManutencao({ ...common, reason: observation, provider: provider.trim() || undefined });
      } else {
        result = await MovimentarEstoque({
          ...common,
          type,
          adjustmentDirection: type === "AJUSTE" ? adjustmentDirection : undefined,
          sourceBucket: type === "OUTRO" && customDirection === "OUT" ? "DISPONIVEL" : undefined,
          destinationBucket: type === "OUTRO" && customDirection === "IN" ? "DISPONIVEL" : undefined,
          metadata: movementMetadata,
        });
      }
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${movementLabels[type]} registrada com histórico.`);
      onOpenChange(false);
      onCompleted?.();
      router.refresh();
    });
  }

  const kitOptions = kitModels.flatMap<KitMovementOption>((tag) => tag.kitInstances.length > 0
    ? tag.kitInstances.map((instance) => ({ value: `${tag.id}:${instance.id}`, label: `${instance.code} · ${tag.nome}`, tagId: tag.id, instanceId: instance.id }))
    : [{ value: `${tag.id}:new`, label: `${tag.nome} · montar novo kit`, tagId: tag.id, instanceId: null }]);

  function continueWithKit() {
    const option = kitOptions.find((candidate) => candidate.value === kitSelection);
    if (!option || !onMoveKit) { toast.error("Selecione um kit para continuar."); return; }
    onOpenChange(false);
    onMoveKit(option.tagId, option.instanceId);
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="estoque-dialog estoque-scroll max-h-[92vh] overflow-y-auto border-white/10 bg-[#071226] text-white sm:max-w-xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowDownUp size={18} /> Movimentar estoque</DialogTitle><DialogDescription>Escolha se deseja movimentar um item ou um kit completo. Toda operação gera histórico e auditoria.</DialogDescription></DialogHeader>
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950/50 p-1"><button type="button" onClick={() => setEntityType("ITEM")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition ${entityType === "ITEM" ? "bg-blue-500 text-white" : "text-slate-400 hover:text-white"}`}><Boxes size={15} /> Item</button><button type="button" onClick={() => setEntityType("KIT")} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition ${entityType === "KIT" ? "bg-blue-500 text-white" : "text-slate-400 hover:text-white"}`}><PackageCheck size={15} /> Kit</button></div>
    {entityType === "KIT" ? <div className="space-y-4"><div className="rounded-xl border border-blue-400/15 bg-blue-400/[0.06] p-3 text-xs leading-5 text-blue-100">A entrega ou devolução de um kit movimenta cada componente conforme sua natureza, sem duplicar saldo.</div><label className="block space-y-2 text-sm text-slate-300">Kit<select value={kitSelection} onChange={(event) => setKitSelection(event.target.value)} className="estoque-select h-10 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="">Selecione um kit</option>{kitOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="flex items-center gap-2 text-xs text-slate-500"><Building2 size={14} /> Origem fixa</p><p className="mt-1 text-sm font-medium">{INVENTORY_ORIGIN_COMPANY}</p></div><DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="estoque-ghost">Cancelar</Button><Button type="button" onClick={continueWithKit} disabled={!kitSelection} className="estoque-primary">Continuar com o kit</Button></DialogFooter></div> : <form onSubmit={submit} className="space-y-4">
    <label className="block space-y-2 text-sm text-slate-300">Operação<select value={type} onChange={(event) => setType(event.target.value as MovementChoice)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="ENTRADA">Entrada</option><option value="SAIDA">Saída</option><option value="EM_USO">Colocar em uso</option><option value="TRANSFERENCIA">Transferência</option><option value="AJUSTE">Ajuste</option><option value="BAIXA">Baixa</option><option value="MANUTENCAO">Manutenção</option><option value="PERDA">Perda</option><option value="DANO">Dano</option><option value="OUTRO">Outro</option></select></label>
    <label className="block space-y-2 text-sm text-slate-300">Item<select value={itemId} onChange={(event) => { const next = items.find((candidate) => candidate.id === event.target.value); setItemId(event.target.value); setFromLocationId(next?.defaultLocationId ?? ""); setAssetId(""); setQuantity("1"); }} required disabled={Boolean(initialItem)} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="">Selecione</option>{items.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.nome}</option>)}</select></label>
    {individualEntry ? <div className="rounded-2xl border border-blue-400/20 bg-blue-400/[0.08] p-4 text-sm leading-6 text-blue-100"><p className="font-semibold">Entrada individual exige identificação da unidade.</p><p className="mt-1 text-blue-200/80">Cadastre patrimônio, serial ou código interno. O cadastro cria a entrada rastreável automaticamente.</p>{onRegisterAsset && <Button type="button" className="estoque-primary mt-3" onClick={() => { onOpenChange(false); onRegisterAsset(item); }}>Cadastrar unidade patrimonial</Button>}</div> : <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm text-slate-300">Quantidade<Input type="number" min={1} max={1_000_000} value={quantity} onChange={(event) => setQuantity(event.target.value)} required className="estoque-input border-white/10 bg-slate-950/70" /></label>{item?.trackingMode === "INDIVIDUAL" && <label className="block space-y-2 text-sm text-slate-300">Unidade patrimonial<select value={assetId} onChange={(event) => setAssetId(event.target.value)} required className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="">Selecione</option>{availableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.patrimonio || asset.serial || asset.codigoInterno}</option>)}</select></label>}</div>}
    {type === "AJUSTE" && <label className="block space-y-2 text-sm text-slate-300">Direção do ajuste<select value={adjustmentDirection} onChange={(event) => setAdjustmentDirection(event.target.value as "INCREASE" | "DECREASE")} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="INCREASE">Aumentar saldo</option><option value="DECREASE">Reduzir saldo</option></select></label>}
    {type === "OUTRO" && <label className="block space-y-2 text-sm text-slate-300">Efeito no saldo<select value={customDirection} onChange={(event) => setCustomDirection(event.target.value as "IN" | "OUT")} className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="IN">Entrada em disponível</option><option value="OUT">Saída de disponível</option></select></label>}
    <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm text-slate-300">Origem<Input value={INVENTORY_ORIGIN_COMPANY} readOnly className="estoque-input border-white/10 bg-slate-900/60 text-slate-400" /></label><label className="block space-y-2 text-sm text-slate-300">Destino<Input value={destinationLabel} onChange={(event) => setDestinationLabel(event.target.value)} maxLength={160} placeholder="Ex.: Cliente, evento ou endereço" className="estoque-input border-white/10 bg-slate-950/70" /></label></div>
    {type === "TRANSFERENCIA" ? <details className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><summary className="cursor-pointer text-xs font-medium text-slate-400">Localização interna do estoque</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs text-slate-500">Local atual<select value={fromLocationId} onChange={(event) => setFromLocationId(event.target.value)} required className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="">Selecione</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.nome}</option>)}</select></label><label className="space-y-1 text-xs text-slate-500">Novo local interno<select value={toLocationId} onChange={(event) => setToLocationId(event.target.value)} required className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="">Selecione</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.nome}</option>)}</select></label></div></details> : null}
    {type === "EM_USO" && <label className="block space-y-2 text-sm text-slate-300">Responsável<select value={responsibleUserId} onChange={(event) => setResponsibleUserId(event.target.value)} required className="estoque-select h-9 w-full rounded-md border border-white/10 bg-slate-950/70 px-3"><option value="">Selecione</option>{responsibles.map((responsible) => <option key={responsible.id} value={responsible.id}>{responsible.nome} · {responsible.role}</option>)}</select></label>}
    {type === "MANUTENCAO" && <label className="block space-y-2 text-sm text-slate-300">Fornecedor da manutenção (opcional)<Input value={provider} onChange={(event) => setProvider(event.target.value)} maxLength={200} className="estoque-input border-white/10 bg-slate-950/70" /></label>}
    <label className="block space-y-2 text-sm text-slate-300">{needsReason ? "Motivo / observação" : "Observação (opcional)"}<textarea value={observation} onChange={(event) => setObservation(event.target.value)} required={needsReason} maxLength={2_000} rows={3} className="estoque-textarea w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-2 outline-none focus:border-blue-400" /></label>
    <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="estoque-ghost">Cancelar</Button><Button type="submit" disabled={pending || !item || individualEntry} className="estoque-primary">{pending ? "Registrando..." : individualEntry ? "Cadastre a unidade para continuar" : "Confirmar movimentação"}</Button></DialogFooter>
  </form>}</DialogContent></Dialog>;
}
