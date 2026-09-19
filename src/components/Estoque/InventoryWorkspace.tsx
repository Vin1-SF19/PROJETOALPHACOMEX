"use client";

import { useState } from "react";
import { ArrowDownUp, Boxes, History, PackageCheck, Tags, UserRoundCheck } from "lucide-react";
import { InventoryAssignmentsPanel } from "@/components/Estoque/InventoryAssignmentsPanel";
import { InventoryAssetModal } from "@/components/Estoque/InventoryAssetModal";
import { InventoryCategoryManager } from "@/components/Estoque/InventoryCategoryManager";
import { InventoryHeader } from "@/components/Estoque/InventoryHeader";
import { InventoryGettingStarted } from "@/components/Estoque/InventoryGettingStarted";
import { InventoryItemDetails } from "@/components/Estoque/InventoryItemDetails";
import { InventoryItemForm } from "@/components/Estoque/InventoryItemForm";
import { InventoryItemsBrowser } from "@/components/Estoque/InventoryItemsBrowser";
import { InventoryMovementModal, type MovementChoice } from "@/components/Estoque/InventoryMovementModal";
import { InventoryMaintenancePanel } from "@/components/Estoque/InventoryMaintenancePanel";
import { InventoryMovementsPanel } from "@/components/Estoque/InventoryMovementsPanel";
import { InventorySummaryCards } from "@/components/Estoque/InventorySummaryCards";
import { InventoryKitsPanel } from "@/components/Estoque/kits/InventoryKitsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InventoryCategory, InventoryItem, InventoryLocation, InventorySummary } from "@/lib/estoque/types";

interface InventoryWorkspaceProps {
  initialItems: InventoryItem[];
  categories: InventoryCategory[];
  locations: InventoryLocation[];
  summary: InventorySummary;
  access: {
    canManage: boolean;
    canConfirmReturns: boolean;
  };
}

export function InventoryWorkspace({ initialItems, categories, locations, summary, access }: InventoryWorkspaceProps) {
  const [availableCategories, setAvailableCategories] = useState(categories);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [activeTab, setActiveTab] = useState("items");
  const [movement, setMovement] = useState<{ item: InventoryItem | null; type: MovementChoice } | null>(null);
  const [assetItem, setAssetItem] = useState<InventoryItem | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [operationsRefreshKey, setOperationsRefreshKey] = useState(0);
  const [kitMovementRequest, setKitMovementRequest] = useState<{ tagId: string; instanceId: string | null; token: number } | null>(null);
  function focusKitsPanel() {
    setActiveTab("kits");
    window.setTimeout(() => document.getElementById("inventory-kits-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function openMovement(item: InventoryItem | null = null, type: MovementChoice = "ENTRADA") {
    setSelectedItem(null);
    setMovement({ item, type });
  }

  if (!access.canManage) {
    return (
      <main className="estoque-alpha min-h-screen text-slate-100">
        <div className="estoque-enter mx-auto w-full max-w-[1400px] space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
          <header className="estoque-panel overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-950/40 p-6 shadow-2xl shadow-black/20 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="estoque-card-icon grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-500/15 text-blue-300"><PackageCheck size={23} /></div>
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Estoque Alpha</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Itens em sua posse</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Veja os itens e kits disponibilizados para você e acompanhe todo o histórico dessas movimentações.</p></div>
            </div>
          </header>
          <section className="space-y-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><UserRoundCheck size={18} className="text-blue-300" /> Meus itens e kits</h2><p className="mt-1 text-sm text-slate-500">A confirmação de devolução é feita exclusivamente pelo setor TI.</p></div><InventoryAssignmentsPanel locations={[]} mineOnly canReturn={false} /></section>
          <section className="space-y-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><History size={18} className="text-blue-300" /> Meu histórico</h2><p className="mt-1 text-sm text-slate-500">Registro completo das entregas, devoluções e movimentações vinculadas a você.</p></div><InventoryMovementsPanel mineOnly /></section>
        </div>
      </main>
    );
  }

  return (
    <main className="estoque-alpha min-h-screen text-slate-100">
      <div className="estoque-enter mx-auto w-full max-w-[1680px] space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
        <InventoryHeader onNewItem={() => setNewItemOpen(true)} onNewKit={focusKitsPanel} onMove={() => openMovement()} />
        <InventoryGettingStarted onNewItem={() => setNewItemOpen(true)} onMove={() => openMovement()} onKits={focusKitsPanel} />
        <InventorySummaryCards summary={summary} />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
          <div className="estoque-scroll flex max-w-full overflow-x-auto pb-1"><TabsList className="estoque-tabs min-w-max">
            <TabsTrigger value="items" className="estoque-tab"><Boxes size={15} /> Itens</TabsTrigger>
            <TabsTrigger value="kits" className="estoque-tab"><Tags size={15} /> Tags / Kits</TabsTrigger>
            <TabsTrigger value="assignments" className="estoque-tab"><UserRoundCheck size={15} /> Em uso</TabsTrigger>
            <TabsTrigger value="mine" className="estoque-tab"><PackageCheck size={15} /> Minha posse</TabsTrigger>
            <TabsTrigger value="movements" className="estoque-tab"><ArrowDownUp size={15} /> Movimentações</TabsTrigger>
          </TabsList></div>
          <TabsContent value="items" className="space-y-4">
            <InventoryItemsBrowser initialItems={initialItems} categories={availableCategories} locations={locations} onSelect={setSelectedItem} onManageCategories={() => setCategoriesOpen(true)} />
          </TabsContent>
          <TabsContent value="kits"><div id="inventory-kits-panel" className="scroll-mt-6"><InventoryKitsPanel categories={availableCategories} canConfirmReturns={access.canConfirmReturns} movementRequest={kitMovementRequest} onMovementRequestHandled={() => setKitMovementRequest(null)} /></div></TabsContent>
          <TabsContent value="assignments"><InventoryAssignmentsPanel locations={locations} refreshKey={operationsRefreshKey} canReturn={access.canConfirmReturns} /></TabsContent>
          <TabsContent value="mine" className="space-y-7"><section className="space-y-3"><div><h2 className="text-lg font-semibold">Meus itens e kits</h2><p className="text-sm text-slate-500">Itens disponibilizados diretamente para você.</p></div><InventoryAssignmentsPanel locations={locations} refreshKey={operationsRefreshKey} mineOnly canReturn={access.canConfirmReturns} /></section><section className="space-y-3"><div><h2 className="text-lg font-semibold">Meu histórico</h2><p className="text-sm text-slate-500">Movimentações vinculadas às suas atribuições.</p></div><InventoryMovementsPanel refreshKey={operationsRefreshKey} mineOnly /></section></TabsContent>
          <TabsContent value="movements" className="space-y-7"><InventoryMaintenancePanel locations={locations} refreshKey={operationsRefreshKey} onCompleted={() => setOperationsRefreshKey((value) => value + 1)} /><InventoryMovementsPanel refreshKey={operationsRefreshKey} /></TabsContent>
        </Tabs>
      </div>
      {(newItemOpen || editingItem) && <InventoryItemForm open onOpenChange={(open) => { if (!open) { setNewItemOpen(false); setEditingItem(null); } }} categories={availableCategories} locations={locations} item={editingItem} onSaved={() => setEditingItem(null)} />}
      <InventoryItemDetails item={selectedItem} onClose={() => setSelectedItem(null)} onEdit={(item) => { setSelectedItem(null); setEditingItem(item); }} onMove={openMovement} onRegisterAsset={(item) => { setSelectedItem(null); setAssetItem(item); }} />
      {movement && <InventoryMovementModal open onOpenChange={(open) => !open && setMovement(null)} items={initialItems} locations={locations} initialItem={movement.item} initialType={movement.type} onCompleted={() => setOperationsRefreshKey((value) => value + 1)} onRegisterAsset={setAssetItem} onMoveKit={(tagId, instanceId) => { setActiveTab("kits"); setKitMovementRequest({ tagId, instanceId, token: Date.now() }); }} />}
      {assetItem && <InventoryAssetModal item={assetItem} locations={locations} onOpenChange={(open) => !open && setAssetItem(null)} onCompleted={() => setOperationsRefreshKey((value) => value + 1)} />}
      <InventoryCategoryManager open={categoriesOpen} onOpenChange={setCategoriesOpen} categories={availableCategories} onCategoriesChange={setAvailableCategories} />
    </main>
  );
}
