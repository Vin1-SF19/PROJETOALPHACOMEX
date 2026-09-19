import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { archiveInventoryItem, deleteInventoryItemPermanently, saveInventoryItem } from "@/lib/estoque/items-service";
import { deleteInventoryTagModelPermanently } from "@/lib/estoque/kits-service";
import { assignInventory, executeInventoryBatch, executeStockMovement, inventoryReconcileDryRun, listInventoryItems, recordInventoryPurchase, registerInventoryAsset, returnInventory } from "@/lib/estoque/movement-service";

const sandbox = mkdtempSync(join(tmpdir(), "inventory-ledger-"));
const databaseUrl = `file:${join(sandbox, "inventory.db")}`;
const actor = { actorType: "USER" as const, actorUserId: 1, actorName: "Operador Teste" };
let prisma: PrismaClient;

beforeAll(async () => {
  const setup = createClient({ url: databaseUrl });
  const baseline = readFileSync(resolve(process.cwd(), "prisma/manual-migrations/20260918_inventory_legacy_baseline.sql"), "utf8");
  const foundation = readFileSync(resolve(process.cwd(), "prisma/migrations/20260918193000_inventory_general_foundation/migration.sql"), "utf8");
  await setup.executeMultiple("PRAGMA foreign_keys=ON;" + baseline);
  await setup.executeMultiple(foundation);
  await setup.executeMultiple(`
    CREATE TABLE "usuarios" ("id" INTEGER PRIMARY KEY, "nome" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ATIVO');
    CREATE TABLE "Auditoria" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "userId" INTEGER NOT NULL, "acao" TEXT NOT NULL, "detalhes" TEXT, "ip" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("userId") REFERENCES "usuarios"("id") ON DELETE CASCADE);
    INSERT INTO "usuarios" ("id", "nome", "status") VALUES (1, 'Operador Teste', 'ATIVO'), (2, 'Colaborador Teste', 'ATIVO');
    INSERT INTO "Categoria" ("id", "nome", "createdAt", "ativo") VALUES ('cat-1', 'TESTE', CURRENT_TIMESTAMP, true);
    INSERT INTO "ProdutoEstoque" ("id", "nome", "quantidade", "estoqueMinimo", "unidade", "categoriaId", "createdAt", "updatedAt", "quantidadeTotal")
      VALUES ('item-1', 'Item Teste', 0, 0, 'unidade', 'cat-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);
  `);
  setup.close();
  prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: databaseUrl }) });
});

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(sandbox, { recursive: true, force: true });
});

describe("inventory movement transaction", () => {
  it("grava entrada, cache, ledger e auditoria atomicamente e repete de forma idempotente", async () => {
    const command = { idempotencyKey: "integration-entry-1", produtoId: "item-1", quantity: 3, type: "ENTRADA" as const, actor };
    const first = await executeStockMovement(command, prisma);
    const replay = await executeStockMovement(command, prisma);

    expect(first.idempotentReplay).toBe(false);
    expect(replay).toMatchObject({ operationId: first.operationId, idempotentReplay: true, availableAfter: 3, totalAfter: 3 });
    await expect(prisma.produtoEstoque.findUniqueOrThrow({ where: { id: "item-1" }, select: { quantidade: true, quantidadeTotal: true } })).resolves.toEqual({ quantidade: 3, quantidadeTotal: 3 });
    await expect(prisma.inventoryOperation.count()).resolves.toBe(1);
    await expect(prisma.inventoryMovement.count()).resolves.toBe(1);
    await expect(prisma.inventoryAuditLog.count()).resolves.toBe(1);
  });

  it("faz rollback completo quando o saldo é insuficiente", async () => {
    await expect(executeStockMovement({ idempotencyKey: "integration-exit-invalid", produtoId: "item-1", quantity: 99, type: "SAIDA", observacao: "Teste de saldo insuficiente", actor }, prisma)).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    await expect(prisma.inventoryOperation.count({ where: { idempotencyKey: "integration-exit-invalid" } })).resolves.toBe(0);
    await expect(prisma.produtoEstoque.findUniqueOrThrow({ where: { id: "item-1" }, select: { quantidade: true } })).resolves.toEqual({ quantidade: 3 });
  });

  it("exige responsável ativo, movimenta para uso e devolve com condição", async () => {
    const assigned = await assignInventory({ idempotencyKey: "integration-assign-1", produtoId: "item-1", quantity: 2, responsibleUserId: 2, actor }, prisma);
    expect(assigned.assignmentId).toBeTruthy();
    await expect(prisma.produtoEstoque.findUniqueOrThrow({ where: { id: "item-1" }, select: { quantidade: true, quantidadeEmUso: true } })).resolves.toEqual({ quantidade: 1, quantidadeEmUso: 2 });

    const returned = await returnInventory({ idempotencyKey: "integration-return-1", assignmentId: assigned.assignmentId!, quantity: 1, condition: "NECESSITA_MANUTENCAO", observacao: "Teclado com falha intermitente", actor }, prisma);
    expect(returned.maintenanceId).toBeTruthy();
    const maintenanceId = returned.maintenanceId!;
    await expect(prisma.produtoEstoque.findUniqueOrThrow({ where: { id: "item-1" }, select: { quantidadeEmUso: true, quantidadeManutencao: true, quantidadeTotal: true } })).resolves.toEqual({ quantidadeEmUso: 1, quantidadeManutencao: 1, quantidadeTotal: 3 });
    await expect(prisma.inventoryAssignment.findUniqueOrThrow({ where: { id: assigned.assignmentId }, select: { status: true, returnedQuantity: true } })).resolves.toEqual({ status: "PARCIALMENTE_DEVOLVIDA", returnedQuantity: 1 });
    await expect(prisma.inventoryMaintenance.findUniqueOrThrow({ where: { id: maintenanceId }, select: { produtoId: true, quantity: true, status: true, sendOperationId: true, reason: true } })).resolves.toMatchObject({ produtoId: "item-1", quantity: 1, status: "ABERTA", sendOperationId: returned.operationId, reason: "Devolução classificada como necessita manutenção" });
    await expect(prisma.inventoryMovement.findUniqueOrThrow({ where: { id: returned.movementId }, select: { maintenanceId: true, toBucket: true } })).resolves.toEqual({ maintenanceId, toBucket: "MANUTENCAO" });
  });

  it("serializa devoluções concorrentes sem duplicar retorno ou saldo", async () => {
    await prisma.produtoEstoque.create({ data: { id: "item-return-race", nome: "Item Devolução Concorrente", quantidade: 0, estoqueMinimo: 0, unidade: "unidade", categoriaId: "cat-1", quantidadeTotal: 0 } });
    await executeStockMovement({ idempotencyKey: "return-race-entry", produtoId: "item-return-race", quantity: 2, type: "ENTRADA", actor }, prisma);
    const assignment = await assignInventory({ idempotencyKey: "return-race-assignment", produtoId: "item-return-race", quantity: 2, responsibleUserId: 2, actor }, prisma);

    const attempts = await Promise.allSettled([
      returnInventory({ idempotencyKey: "return-race-a", assignmentId: assignment.assignmentId!, quantity: 2, condition: "BOM", actor }, prisma),
      returnInventory({ idempotencyKey: "return-race-b", assignmentId: assignment.assignmentId!, quantity: 2, condition: "BOM", actor }, prisma),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    await expect(prisma.inventoryAssignment.findUniqueOrThrow({ where: { id: assignment.assignmentId }, select: { returnedQuantity: true, status: true, version: true } })).resolves.toEqual({ returnedQuantity: 2, status: "DEVOLVIDA", version: 2 });
    await expect(prisma.produtoEstoque.findUniqueOrThrow({ where: { id: "item-return-race" }, select: { quantidade: true, quantidadeEmUso: true, quantidadeTotal: true } })).resolves.toEqual({ quantidade: 2, quantidadeEmUso: 0, quantidadeTotal: 2 });
    await expect(prisma.inventoryMovement.count({ where: { assignmentId: assignment.assignmentId, operation: { type: "DEVOLUCAO" } } })).resolves.toBe(1);
  });

  it("serializa saídas concorrentes sem permitir saldo negativo", async () => {
    const attempts = await Promise.allSettled([
      executeStockMovement({ idempotencyKey: "integration-race-a", produtoId: "item-1", quantity: 1, type: "SAIDA", observacao: "Saída concorrente A", actor }, prisma),
      executeStockMovement({ idempotencyKey: "integration-race-b", produtoId: "item-1", quantity: 1, type: "SAIDA", observacao: "Saída concorrente B", actor }, prisma),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    await expect(prisma.produtoEstoque.findUniqueOrThrow({ where: { id: "item-1" }, select: { quantidade: true } })).resolves.toEqual({ quantidade: 0 });
  });

  it("conclui somente a pendência de compra do item correspondente", async () => {
    await prisma.listaCompra.upsert({ where: { produtoId: "item-1" }, update: { status: "PENDENTE", quantidadeAtual: 0 }, create: { id: "purchase-item-1", produtoId: "item-1", nome: "Item Teste", quantidadeAtual: 0, minimoEsperado: 0, unidade: "unidade", status: "PENDENTE" } });
    await recordInventoryPurchase({ idempotencyKey: "integration-purchase-1", produtoId: "item-1", quantity: 2, actor }, prisma);
    await expect(prisma.listaCompra.findUnique({ where: { produtoId: "item-1" } })).resolves.toBeNull();
    await expect(prisma.produtoEstoque.findUniqueOrThrow({ where: { id: "item-1" }, select: { quantidade: true } })).resolves.toEqual({ quantidade: 2 });
  });

  it("cadastra unidade individual como entrada auditada de uma unidade", async () => {
    await prisma.produtoEstoque.create({ data: { id: "item-individual", nome: "Notebook Teste", quantidade: 0, estoqueMinimo: 0, unidade: "unidade", categoriaId: "cat-1", trackingMode: "INDIVIDUAL", quantidadeTotal: 0 } });
    const result = await registerInventoryAsset({ idempotencyKey: "integration-asset-1", produtoId: "item-individual", serial: "SERIAL-UNICO-1", patrimonio: "PAT-1", actor }, prisma);
    expect(result).toMatchObject({ availableAfter: 1, totalAfter: 1 });
    await expect(prisma.inventoryAsset.findUniqueOrThrow({ where: { id: result.assetId }, select: { serial: true, patrimonio: true, status: true } })).resolves.toEqual({ serial: "SERIAL-UNICO-1", patrimonio: "PAT-1", status: "DISPONIVEL" });
    await expect(prisma.inventoryMovement.findUniqueOrThrow({ where: { id: result.movementId }, select: { quantity: true, toBucket: true } })).resolves.toEqual({ quantity: 1, toBucket: "DISPONIVEL" });
  });

  it("entrega componentes de kit em um único lote com vínculos no ledger", async () => {
    await prisma.inventoryTag.create({ data: { id: "tag-kit-1", kind: "KIT_MODELO", nome: "Kit Teste", normalizedName: "kit teste", createdById: 1 } });
    await prisma.inventoryTagRequirement.create({ data: { id: "req-kit-1", tagId: "tag-kit-1", produtoId: "item-1", quantityRequired: 1 } });
    await prisma.inventoryKitInstance.create({ data: { id: "kit-1", tagId: "tag-kit-1", code: "KIT-TESTE-1", status: "COMPLETO", assembledById: 1 } });
    await prisma.inventoryKitComponent.create({ data: { id: "component-kit-1", kitInstanceId: "kit-1", requirementId: "req-kit-1", produtoId: "item-1", quantity: 1, addedById: 1 } });

    const input = { idempotencyKey: "batch-delivery-1", actor, kitInstanceId: "kit-1", commands: [{ kind: "ASSIGN" as const, kitComponentId: "component-kit-1", produtoId: "item-1", quantity: 1, responsibleUserId: 2 }] };
    const [delivered] = await executeInventoryBatch(input, prisma);
    const [replayed] = await executeInventoryBatch(input, prisma);
    expect(delivered.idempotentReplay).toBe(false);
    expect(replayed).toMatchObject({ operationId: delivered.operationId, assignmentId: delivered.assignmentId, idempotentReplay: true });
    await expect(prisma.inventoryMovement.findUniqueOrThrow({ where: { id: delivered.movementId }, select: { kitInstanceId: true, kitComponentId: true, assignmentId: true } })).resolves.toEqual({ kitInstanceId: "kit-1", kitComponentId: "component-kit-1", assignmentId: delivered.assignmentId });
  });

  it("permite entrada/saída de consumível e bloqueia atribuição EM_USO", async () => {
    await prisma.produtoEstoque.create({ data: { id: "item-consumivel", nome: "Consumível Teste", quantidade: 0, estoqueMinimo: 0, unidade: "unidade", categoriaId: "cat-1", usagePolicy: "CONSUMIVEL", quantidadeTotal: 0 } });
    await executeStockMovement({ idempotencyKey: "consumable-entry-1", produtoId: "item-consumivel", quantity: 2, type: "ENTRADA", actor }, prisma);
    await expect(assignInventory({ idempotencyKey: "consumable-assign-1", produtoId: "item-consumivel", quantity: 1, responsibleUserId: 2, actor }, prisma)).rejects.toMatchObject({ code: "CONSUMABLE_NOT_ASSIGNABLE" });
    await executeStockMovement({ idempotencyKey: "consumable-exit-1", produtoId: "item-consumivel", quantity: 1, type: "SAIDA", observacao: "Consumido em operação", actor }, prisma);
    await expect(prisma.produtoEstoque.findUniqueOrThrow({ where: { id: "item-consumivel" }, select: { quantidade: true, quantidadeTotal: true } })).resolves.toEqual({ quantidade: 1, quantidadeTotal: 1 });
  });

  it("pagina e pesquisa itens por patrimônio, tag e responsável sem carregar o catálogo inteiro", async () => {
    const byAsset = await listInventoryItems({ query: "SERIAL-UNICO-1", limit: 10 }, prisma);
    expect(byAsset.items.map((item) => item.id)).toEqual(["item-individual"]);

    const byTag = await listInventoryItems({ query: "Kit Teste", limit: 10 }, prisma);
    expect(byTag.items.some((item) => item.id === "item-1")).toBe(true);

    const byResponsible = await listInventoryItems({ query: "Colaborador Teste", responsibleUserId: 2, limit: 10 }, prisma);
    expect(byResponsible.items.some((item) => item.id === "item-1")).toBe(true);

    const firstPage = await listInventoryItems({ categoryId: "cat-1", stock: "WITH_STOCK", limit: 1 }, prisma);
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).toBeTruthy();
    const secondPage = await listInventoryItems({ categoryId: "cat-1", stock: "WITH_STOCK", limit: 1, cursor: firstPage.nextCursor! }, prisma);
    expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id);

    await prisma.produtoEstoque.update({ where: { id: "item-consumivel" }, data: { estoqueMinimo: 2 } });
    const lowStock = await listInventoryItems({ stock: "LOW_STOCK", limit: 50 }, prisma);
    expect(lowStock.items.length).toBeGreaterThan(0);
    expect(lowStock.items.every((item) => item.quantidade <= item.estoqueMinimo)).toBe(true);
  });

  it("compartilha criação, edição e arquivamento seguro de item com o CLI", async () => {
    const serviceActor = { userId: 1, name: "Operador Teste" };
    const created = await saveInventoryItem({ nome: "Item CLI", quantidade: 0, estoqueMinimo: 2, unidade: "unidade", categoriaId: "cat-1", codigoInterno: "CLI-ITEM-1", trackingMode: "QUANTIDADE", usagePolicy: "CONSUMIVEL" }, serviceActor, prisma);
    expect(created.created).toBe(true);
    const edited = await saveInventoryItem({ id: created.id, nome: "Item CLI Editado", quantidade: 0, estoqueMinimo: 3, unidade: "caixa", categoriaId: "cat-1", codigoInterno: "CLI-ITEM-1", trackingMode: "QUANTIDADE", usagePolicy: "CONSUMIVEL" }, serviceActor, prisma);
    expect(edited).toEqual({ id: created.id, created: false });
    await expect(prisma.produtoEstoque.findUniqueOrThrow({ where: { id: created.id }, select: { nome: true, unidade: true, estoqueMinimo: true } })).resolves.toEqual({ nome: "Item CLI Editado", unidade: "caixa", estoqueMinimo: 3 });
    await expect(archiveInventoryItem(created.id, serviceActor, prisma)).resolves.toEqual({ id: created.id, archived: true });
    await expect(prisma.inventoryAuditLog.count({ where: { entityId: created.id } })).resolves.toBe(3);
  });

  it("exclui definitivamente cadastro sem histórico e bloqueia item movimentado", async () => {
    const serviceActor = { userId: 1, name: "Operador Teste" };
    const created = await saveInventoryItem({ nome: "Item Descartável", quantidade: 0, estoqueMinimo: 0, unidade: "unidade", categoriaId: "cat-1", trackingMode: "QUANTIDADE", usagePolicy: "RETORNAVEL" }, serviceActor, prisma);
    await expect(deleteInventoryItemPermanently(created.id, serviceActor, prisma)).resolves.toMatchObject({ id: created.id, deleted: true });
    await expect(prisma.produtoEstoque.findUnique({ where: { id: created.id } })).resolves.toBeNull();
    await expect(prisma.inventoryAuditLog.findFirst({ where: { entityId: created.id, action: "ESTOQUE_ITEM_EXCLUIDO_DEFINITIVAMENTE" } })).resolves.toBeTruthy();
    await expect(deleteInventoryItemPermanently("item-1", serviceActor, prisma)).rejects.toThrow("possui movimentação");
  });

  it("exclui modelo e instâncias sem histórico e bloqueia Kit já movimentado", async () => {
    const serviceActor = { userId: 1, name: "Operador Teste" };
    await prisma.inventoryTag.create({ data: { id: "tag-delete", kind: "KIT_MODELO", nome: "Kit Excluir", normalizedName: "kit excluir", createdById: 1 } });
    await prisma.inventoryTagRequirement.create({ data: { id: "req-delete", tagId: "tag-delete", produtoId: "item-consumivel", quantityRequired: 1 } });
    await prisma.inventoryKitInstance.create({ data: { id: "kit-delete", tagId: "tag-delete", code: "KIT-DELETE", assembledById: 1 } });
    await prisma.inventoryKitComponent.create({ data: { id: "component-delete", kitInstanceId: "kit-delete", requirementId: "req-delete", produtoId: "item-consumivel", quantity: 1, addedById: 1 } });
    await expect(deleteInventoryTagModelPermanently("tag-delete", serviceActor, prisma)).resolves.toMatchObject({ deleted: true, deletedInstances: 1 });
    await expect(prisma.inventoryTag.findUnique({ where: { id: "tag-delete" } })).resolves.toBeNull();
    await expect(deleteInventoryTagModelPermanently("tag-kit-1", serviceActor, prisma)).rejects.toThrow("possui entrega");
  });

  it("reconcile permanece dry-run e relata cache divergente sem corrigi-lo", async () => {
    const before = await prisma.produtoEstoque.findUniqueOrThrow({ where: { id: "item-consumivel" }, select: { quantidade: true } });
    await prisma.produtoEstoque.update({ where: { id: "item-consumivel" }, data: { quantidade: 999 } });
    const report = await inventoryReconcileDryRun({ limit: 10 }, prisma);
    expect(report.dryRun).toBe(true);
    expect(report.divergences.some((entry) => entry.item.id === "item-consumivel")).toBe(true);
    await expect(prisma.produtoEstoque.findUniqueOrThrow({ where: { id: "item-consumivel" }, select: { quantidade: true } })).resolves.toEqual({ quantidade: 999 });
    await prisma.produtoEstoque.update({ where: { id: "item-consumivel" }, data: { quantidade: before.quantidade } });
  });
});
