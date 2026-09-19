export interface InventoryCategory {
  id: string;
  nome: string;
  cor?: string | null;
  icone?: string | null;
  descricao?: string | null;
}

export interface InventoryItem {
  id: string;
  nome: string;
  imagem?: string | null;
  quantidade: number;
  estoqueMinimo: number;
  unidade: string;
  categoriaId: string;
  categoria: InventoryCategory;
  descricao?: string | null;
  marca?: string | null;
  modelo?: string | null;
  codigoInterno?: string | null;
  trackingMode?: "QUANTIDADE" | "INDIVIDUAL" | string;
  usagePolicy?: "RETORNAVEL" | "CONSUMIVEL" | string;
  status?: string;
  defaultLocationId?: string | null;
  defaultLocation?: InventoryLocation | null;
  observacoes?: string | null;
  dataAquisicao?: Date | string | null;
  valorAquisicaoCentavos?: number | null;
  moeda?: string;
  fornecedor?: string | null;
  quantidadeEmUso?: number;
  quantidadeReservada?: number;
  quantidadeManutencao?: number;
  quantidadeDanificada?: number;
  quantidadeTotal?: number;
  inventoryBalances?: InventoryStockBalance[];
  inventoryAssets?: InventoryAssetSummary[];
  inventoryImages?: InventoryDocumentSummary[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface InventoryDocumentSummary {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  objectKey?: string;
}

export interface InventoryLocation {
  id: string;
  nome: string;
  descricao?: string | null;
  tipo?: string | null;
}

export interface InventoryStockBalance {
  id: string;
  locationId?: string | null;
  bucket: string;
  quantity: number;
  location?: InventoryLocation | null;
}

export interface InventoryAssetSummary {
  id: string;
  codigoInterno?: string | null;
  patrimonio?: string | null;
  serial?: string | null;
  status: string;
  currentLocationId?: string | null;
}

export type InventoryStockFilter = "TODOS" | "COM_ESTOQUE" | "SEM_ESTOQUE" | "ESTOQUE_BAIXO";

export interface InventoryFilters {
  search: string;
  categoryId: string;
  stock: InventoryStockFilter;
  status?: string;
  locationId?: string;
}

export interface InventorySummary {
  itensCadastrados: number;
  disponiveis: number;
  emUso: number;
  estoqueBaixo: number;
}
