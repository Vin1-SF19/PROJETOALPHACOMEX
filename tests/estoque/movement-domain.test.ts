import { describe, expect, it } from "vitest";
import { InventoryDomainError, inventoryStatusFromTotals, projectBucketTotals, returnDestination, transitionForMovement } from "@/lib/estoque/movement-domain";
import { assignInventoryCommandSchema, registerInventoryAssetCommandSchema, stockMovementCommandSchema } from "@/lib/estoque/movement-schemas";

const actor = { actorType: "USER" as const, actorUserId: 7, actorName: "Operador" };
const base = { idempotencyKey: "request-0001", produtoId: "produto-1", quantity: 1, actor };

describe("inventory movement domain", () => {
  it("mapeia entrada, saída, uso e dano sem alterar saldo de forma implícita", () => {
    expect(transitionForMovement({ type: "ENTRADA" })).toEqual({ fromBucket: null, toBucket: "DISPONIVEL" });
    expect(transitionForMovement({ type: "SAIDA" })).toEqual({ fromBucket: "DISPONIVEL", toBucket: null });
    expect(transitionForMovement({ type: "EM_USO" })).toEqual({ fromBucket: "DISPONIVEL", toBucket: "EM_USO" });
    expect(transitionForMovement({ type: "DANO" })).toEqual({ fromBucket: "DISPONIVEL", toBucket: "DANIFICADO" });
  });

  it("exige direção explícita em ajuste e transição explícita em OUTRO", () => {
    expect(() => transitionForMovement({ type: "AJUSTE" })).toThrow(InventoryDomainError);
    expect(() => transitionForMovement({ type: "OUTRO" })).toThrow(InventoryDomainError);
  });

  it("direciona devolução conforme condição", () => {
    expect(returnDestination("BOM")).toBe("DISPONIVEL");
    expect(returnDestination("COM_AVARIA")).toBe("DANIFICADO");
    expect(returnDestination("NECESSITA_MANUTENCAO")).toBe("MANUTENCAO");
  });

  it("calcula status somente a partir dos buckets reais", () => {
    expect(inventoryStatusFromTotals({ DISPONIVEL: 0, RESERVADO: 0, EM_USO: 2, MANUTENCAO: 0, DANIFICADO: 0 })).toBe("EM_USO");
    expect(inventoryStatusFromTotals({ DISPONIVEL: 0, RESERVADO: 0, EM_USO: 0, MANUTENCAO: 0, DANIFICADO: 0 })).toBe("SEM_ESTOQUE");
  });

  it("preserva o total em transferências internas e altera uma vez em entrada/saída", () => {
    const initial = { DISPONIVEL: 10, RESERVADO: 0, EM_USO: 0, MANUTENCAO: 0, DANIFICADO: 0 };
    const inUse = projectBucketTotals(initial, { fromBucket: "DISPONIVEL", toBucket: "EM_USO" }, 2);
    expect(Object.values(inUse).reduce((sum, value) => sum + value, 0)).toBe(10);
    const entered = projectBucketTotals(initial, { fromBucket: null, toBucket: "DISPONIVEL" }, 2);
    expect(Object.values(entered).reduce((sum, value) => sum + value, 0)).toBe(12);
    const exited = projectBucketTotals(initial, { fromBucket: "DISPONIVEL", toBucket: null }, 2);
    expect(Object.values(exited).reduce((sum, value) => sum + value, 0)).toBe(8);
  });
});

describe("inventory movement contracts", () => {
  it("rejeita transferência sem origem/destino e baixa sem justificativa", () => {
    expect(stockMovementCommandSchema.safeParse({ ...base, type: "TRANSFERENCIA" }).success).toBe(false);
    expect(stockMovementCommandSchema.safeParse({ ...base, type: "BAIXA" }).success).toBe(false);
    expect(stockMovementCommandSchema.safeParse({ ...base, type: "SAIDA" }).success).toBe(false);
    expect(stockMovementCommandSchema.safeParse({ ...base, type: "SAIDA", observacao: "Consumo interno" }).success).toBe(true);
  });

  it("bloqueia EM_USO no comando genérico e exige fluxo de atribuição", () => {
    expect(stockMovementCommandSchema.safeParse({ ...base, type: "EM_USO" }).success).toBe(false);
    expect(assignInventoryCommandSchema.safeParse({ ...base, responsibleUserId: 42 }).success).toBe(true);
    expect(assignInventoryCommandSchema.safeParse(base).success).toBe(false);
  });

  it("exige identificador único lógico no cadastro de unidade patrimonial", () => {
    expect(registerInventoryAssetCommandSchema.safeParse({ idempotencyKey: "asset-000001", produtoId: "p1", actor }).success).toBe(false);
    expect(registerInventoryAssetCommandSchema.safeParse({ idempotencyKey: "asset-000001", produtoId: "p1", serial: "SN-1", actor }).success).toBe(true);
  });

  it("aceita apenas quantidade inteira positiva", () => {
    expect(stockMovementCommandSchema.safeParse({ ...base, type: "ENTRADA", quantity: 0 }).success).toBe(false);
    expect(stockMovementCommandSchema.safeParse({ ...base, type: "ENTRADA", quantity: 1.5 }).success).toBe(false);
  });
});
