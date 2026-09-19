-- V3 idempotente: materializa os saldos legados sem inventar ator, local ou datas historicas.
-- Precondicao de producao: 3 categorias, 3 produtos e soma quantidade=18.
UPDATE "ProdutoEstoque"
SET "trackingMode" = 'QUANTIDADE',
    "usagePolicy" = 'RETORNAVEL',
    "quantidadeEmUso" = 0,
    "quantidadeReservada" = 0,
    "quantidadeManutencao" = 0,
    "quantidadeDanificada" = 0,
    "quantidadeTotal" = "quantidade",
    "status" = CASE WHEN "quantidade" <= 0 THEN 'SEM_ESTOQUE' ELSE 'DISPONIVEL' END,
    "version" = CASE WHEN "version" < 1 THEN 1 ELSE "version" END;

INSERT OR IGNORE INTO "InventoryStockBalance"
  ("id", "produtoId", "locationId", "bucket", "quantity", "version", "createdAt", "updatedAt")
SELECT 'legacy-balance-' || "id", "id", NULL, 'DISPONIVEL', "quantidade", 1,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ProdutoEstoque";

UPDATE "InventoryStockBalance"
SET "quantity" = (SELECT p."quantidade" FROM "ProdutoEstoque" p WHERE p."id" = "InventoryStockBalance"."produtoId"),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" LIKE 'legacy-balance-%';

INSERT OR IGNORE INTO "InventoryOperation"
  ("id", "idempotencyKey", "requestHash", "type", "actorType", "actorUserId",
   "actorNameSnapshot", "occurredAt", "observacao", "metadataJson", "createdAt")
SELECT 'legacy-operation-' || "id", 'inventory-legacy-opening-' || "id",
       'legacy-opening-v1:' || "id" || ':' || CAST("quantidade" AS TEXT),
       'AJUSTE', 'SYSTEM', NULL, 'Migração de saldo legado', CURRENT_TIMESTAMP,
       'Saldo de abertura preservado do ProdutoEstoque.quantidade',
       '{"reason":"LEGACY_OPENING_BALANCE"}', CURRENT_TIMESTAMP
FROM "ProdutoEstoque";

INSERT OR IGNORE INTO "InventoryMovement"
  ("id", "operationId", "produtoId", "assetId", "assignmentId", "maintenanceId",
   "kitInstanceId", "kitComponentId", "quantity", "fromLocationId", "toLocationId",
   "fromBucket", "toBucket", "availableBefore", "availableAfter", "totalBefore",
   "totalAfter", "createdAt")
SELECT 'legacy-movement-' || "id", 'legacy-operation-' || "id", "id", NULL, NULL, NULL,
       NULL, NULL, "quantidade", NULL, NULL, NULL, 'DISPONIVEL', 0, "quantidade", 0,
       "quantidade", CURRENT_TIMESTAMP
FROM "ProdutoEstoque"
WHERE "quantidade" > 0;

INSERT OR IGNORE INTO "InventoryAuditLog"
  ("id", "entityType", "entityId", "action", "operationId", "actorType", "actorUserId",
   "actorNameSnapshot", "oldDataJson", "newDataJson", "requestId", "createdAt")
SELECT 'legacy-audit-' || "id", 'ProdutoEstoque', "id", 'LEGACY_BACKFILL',
       'legacy-operation-' || "id", 'SYSTEM', NULL, 'Migração de saldo legado', NULL,
       '{"source":"ProdutoEstoque.quantidade","quantity":' || CAST("quantidade" AS TEXT) || '}',
       'inventory-legacy-backfill-v1', CURRENT_TIMESTAMP
FROM "ProdutoEstoque";
