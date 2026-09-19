import type {
  InventoryItem,
  InventoryFilters,
  InventorySummary,
} from "@/lib/estoque/types";

export function normalizeInventorySearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function isLowStock(item: InventoryItem): boolean {
  return item.quantidade <= item.estoqueMinimo;
}

export function getInventorySummary(items: readonly InventoryItem[]): InventorySummary {
  return {
    itensCadastrados: items.length,
    disponiveis: items.reduce((total, item) => total + Math.max(0, item.quantidade), 0),
    emUso: items.reduce((total, item) => total + Math.max(0, item.quantidadeEmUso ?? 0), 0),
    estoqueBaixo: items.filter(isLowStock).length,
  };
}

export function filterInventoryItems(
  items: readonly InventoryItem[],
  { search, categoryId, stock, status, locationId }: InventoryFilters,
): InventoryItem[] {
  const normalizedSearch = normalizeInventorySearch(search);

  return items.filter((item) => {
    const searchable = normalizeInventorySearch(
      [
        item.nome,
        item.categoria.nome,
        item.unidade,
        item.codigoInterno,
        item.marca,
        item.modelo,
        item.fornecedor,
        ...((item.inventoryAssets ?? []).flatMap((asset) => [asset.serial, asset.patrimonio, asset.codigoInterno])),
      ].filter(Boolean).join(" "),
    );
    if (normalizedSearch && !searchable.includes(normalizedSearch)) return false;
    if (categoryId && item.categoriaId !== categoryId) return false;
    if (stock === "COM_ESTOQUE" && item.quantidade <= 0) return false;
    if (stock === "SEM_ESTOQUE" && item.quantidade !== 0) return false;
    if (stock === "ESTOQUE_BAIXO" && !isLowStock(item)) return false;
    if (status && item.status !== status) return false;
    if (locationId && item.defaultLocationId !== locationId && !(item.inventoryBalances ?? []).some((balance) => balance.locationId === locationId)) return false;
    return true;
  });
}

export function getInventoryItemLocation(item: InventoryItem): string {
  return item.inventoryBalances?.find((balance) => balance.location)?.location?.nome
    ?? item.defaultLocation?.nome
    ?? "Não informada";
}

const STATUS_LABELS: Record<string, string> = {
  DISPONIVEL: "Disponível",
  EM_USO: "Em uso",
  RESERVADO: "Reservado",
  EM_MANUTENCAO: "Em manutenção",
  DANIFICADO: "Danificado",
  BAIXADO: "Baixado",
  EXTRAVIADO: "Extraviado",
  SEM_ESTOQUE: "Sem estoque",
};

export function inventoryStatusLabel(status: string | null | undefined): string {
  if (!status) return "Não informado";
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ").toLocaleLowerCase("pt-BR");
}
