import { redirect } from "next/navigation";
import { buscarCategorias, buscarLocalizacoes, buscarProdutos, buscarResumoEstoque } from "@/actions/Estoque";
import { InventoryWorkspace } from "@/components/Estoque/InventoryWorkspace";
import { getInventoryActor } from "@/lib/estoque/authorization";
import "./estoque.css";

export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  const actor = await getInventoryActor();
  if (!actor) redirect("/PainelAlpha");
  const [items, categories, locations, summary] = actor.canManage
    ? await Promise.all([
        buscarProdutos({ limit: 30 }),
        buscarCategorias(),
        buscarLocalizacoes(),
        buscarResumoEstoque(),
      ])
    : [[], [], [], { itensCadastrados: 0, disponiveis: 0, emUso: 0, estoqueBaixo: 0 }];
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const itemsWithLocation = items.map((item) => ({
    ...item,
    defaultLocation: item.defaultLocationId ? locationById.get(item.defaultLocationId) ?? null : null,
  }));
  return <InventoryWorkspace initialItems={itemsWithLocation} categories={categories} locations={locations} summary={summary} access={{ canManage: actor.canManage, canConfirmReturns: actor.canConfirmReturns }} />;
}
