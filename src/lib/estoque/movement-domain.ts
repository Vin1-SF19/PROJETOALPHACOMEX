export const INVENTORY_MOVEMENT_TYPES = [
  "ENTRADA",
  "SAIDA",
  "EM_USO",
  "DEVOLUCAO",
  "TRANSFERENCIA",
  "AJUSTE",
  "BAIXA",
  "MANUTENCAO",
  "RETORNO_MANUTENCAO",
  "PERDA",
  "DANO",
  "OUTRO",
] as const;

export const INVENTORY_BUCKETS = [
  "DISPONIVEL",
  "RESERVADO",
  "EM_USO",
  "MANUTENCAO",
  "DANIFICADO",
] as const;

export const INVENTORY_RETURN_CONDITIONS = [
  "BOM",
  "COM_AVARIA",
  "NECESSITA_MANUTENCAO",
  "DANIFICADO",
] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];
export type InventoryBucket = (typeof INVENTORY_BUCKETS)[number];
export type InventoryReturnCondition = (typeof INVENTORY_RETURN_CONDITIONS)[number];

export class InventoryDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "InventoryDomainError";
  }
}

export interface BucketTransition {
  fromBucket: InventoryBucket | null;
  toBucket: InventoryBucket | null;
}

export function transitionForMovement(input: {
  type: InventoryMovementType;
  adjustmentDirection?: "INCREASE" | "DECREASE";
  sourceBucket?: InventoryBucket;
  destinationBucket?: InventoryBucket;
}): BucketTransition {
  switch (input.type) {
    case "ENTRADA":
      return { fromBucket: null, toBucket: "DISPONIVEL" };
    case "SAIDA":
    case "BAIXA":
    case "PERDA":
      return { fromBucket: input.sourceBucket ?? "DISPONIVEL", toBucket: null };
    case "TRANSFERENCIA":
      return { fromBucket: input.sourceBucket ?? "DISPONIVEL", toBucket: input.sourceBucket ?? "DISPONIVEL" };
    case "AJUSTE":
      if (input.adjustmentDirection === "INCREASE") {
        return { fromBucket: null, toBucket: input.destinationBucket ?? "DISPONIVEL" };
      }
      if (input.adjustmentDirection === "DECREASE") {
        return { fromBucket: input.sourceBucket ?? "DISPONIVEL", toBucket: null };
      }
      throw new InventoryDomainError("ADJUSTMENT_DIRECTION_REQUIRED", "Informe se o ajuste aumenta ou reduz o saldo.");
    case "DANO":
      return { fromBucket: input.sourceBucket ?? "DISPONIVEL", toBucket: "DANIFICADO" };
    case "OUTRO":
      if (!input.sourceBucket && !input.destinationBucket) {
        throw new InventoryDomainError("TRANSITION_REQUIRED", "O movimento OUTRO exige uma origem ou um destino de saldo.");
      }
      return { fromBucket: input.sourceBucket ?? null, toBucket: input.destinationBucket ?? null };
    case "EM_USO":
      return { fromBucket: "DISPONIVEL", toBucket: "EM_USO" };
    case "DEVOLUCAO":
      return { fromBucket: "EM_USO", toBucket: input.destinationBucket ?? "DISPONIVEL" };
    case "MANUTENCAO":
      return { fromBucket: input.sourceBucket ?? "DISPONIVEL", toBucket: "MANUTENCAO" };
    case "RETORNO_MANUTENCAO":
      return { fromBucket: "MANUTENCAO", toBucket: input.destinationBucket ?? "DISPONIVEL" };
  }
}

export function returnDestination(condition: InventoryReturnCondition): InventoryBucket {
  if (condition === "BOM") return "DISPONIVEL";
  if (condition === "NECESSITA_MANUTENCAO") return "MANUTENCAO";
  return "DANIFICADO";
}

export interface InventoryBucketTotals {
  DISPONIVEL: number;
  RESERVADO: number;
  EM_USO: number;
  MANUTENCAO: number;
  DANIFICADO: number;
}

export function emptyBucketTotals(): InventoryBucketTotals {
  return { DISPONIVEL: 0, RESERVADO: 0, EM_USO: 0, MANUTENCAO: 0, DANIFICADO: 0 };
}

export function projectBucketTotals(
  current: InventoryBucketTotals,
  transition: BucketTransition,
  quantity: number,
): InventoryBucketTotals {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new InventoryDomainError("INVALID_QUANTITY", "A quantidade deve ser um inteiro positivo.");
  }
  const projected = { ...current };
  if (transition.fromBucket) {
    if (projected[transition.fromBucket] < quantity) {
      throw new InventoryDomainError("INSUFFICIENT_STOCK", "Saldo insuficiente para concluir a operação.");
    }
    projected[transition.fromBucket] -= quantity;
  }
  if (transition.toBucket) projected[transition.toBucket] += quantity;
  return projected;
}

export function inventoryStatusFromTotals(totals: InventoryBucketTotals): string {
  if (totals.DISPONIVEL > 0) return "DISPONIVEL";
  if (totals.EM_USO > 0) return "EM_USO";
  if (totals.MANUTENCAO > 0) return "EM_MANUTENCAO";
  if (totals.DANIFICADO > 0) return "DANIFICADO";
  if (totals.RESERVADO > 0) return "RESERVADO";
  return "SEM_ESTOQUE";
}
