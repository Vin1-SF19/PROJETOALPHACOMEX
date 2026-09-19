-- Estoque Geral Alpha - foundation V1/V2
-- SQLite/Turso. Aplicacao remota proibida sem novo gate Vault.
-- Somente estruturas novas e colunas aditivas.

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME
);

-- CreateTable
CREATE TABLE "InventoryAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "produtoId" TEXT NOT NULL,
    "codigoInterno" TEXT,
    "patrimonio" TEXT,
    "serial" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DISPONIVEL',
    "currentLocationId" TEXT,
    "observacoes" TEXT,
    "dataAquisicao" DATETIME,
    "valorAquisicaoCentavos" INTEGER,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "fornecedor" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "InventoryAsset_value_check" CHECK ("valorAquisicaoCentavos" IS NULL OR "valorAquisicaoCentavos" >= 0),
    CONSTRAINT "InventoryAsset_version_check" CHECK ("version" > 0),
    CONSTRAINT "InventoryAsset_status_domain_check" CHECK ("status" IN ('DISPONIVEL','EM_USO','RESERVADO','EM_MANUTENCAO','DANIFICADO','BAIXADO','EXTRAVIADO','SEM_ESTOQUE','INATIVO')),
    CONSTRAINT "InventoryAsset_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "ProdutoEstoque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryAsset_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "InventoryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryStockBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "produtoId" TEXT NOT NULL,
    "locationId" TEXT,
    "bucket" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryStockBalance_quantity_check" CHECK ("quantity" >= 0),
    CONSTRAINT "InventoryStockBalance_version_check" CHECK ("version" > 0),
    CONSTRAINT "InventoryStockBalance_bucket_domain_check" CHECK ("bucket" IN ('DISPONIVEL','RESERVADO','EM_USO','MANUTENCAO','DANIFICADO')),
    CONSTRAINT "InventoryStockBalance_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "ProdutoEstoque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryStockBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "actorNameSnapshot" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "observacao" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryOperation_actor_check" CHECK (
      ("actorType" = 'USER' AND "actorUserId" IS NOT NULL) OR "actorType" = 'SYSTEM'
    ),
    CONSTRAINT "InventoryOperation_type_domain_check" CHECK ("type" IN ('ENTRADA','SAIDA','EM_USO','DEVOLUCAO','TRANSFERENCIA','AJUSTE','BAIXA','MANUTENCAO','RETORNO_MANUTENCAO','PERDA','DANO','OUTRO')),
    CONSTRAINT "InventoryOperation_actor_domain_check" CHECK ("actorType" IN ('USER','SYSTEM'))
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operationId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "assetId" TEXT,
    "assignmentId" TEXT,
    "maintenanceId" TEXT,
    "kitInstanceId" TEXT,
    "kitComponentId" TEXT,
    "quantity" INTEGER NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "fromBucket" TEXT,
    "toBucket" TEXT,
    "availableBefore" INTEGER NOT NULL,
    "availableAfter" INTEGER NOT NULL,
    "totalBefore" INTEGER NOT NULL,
    "totalAfter" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "InventoryMovement_asset_quantity_check" CHECK ("assetId" IS NULL OR "quantity" = 1),
    CONSTRAINT "InventoryMovement_balances_check" CHECK (
      "availableBefore" >= 0 AND "availableAfter" >= 0 AND "totalBefore" >= 0 AND "totalAfter" >= 0 AND
      "availableBefore" <= "totalBefore" AND "availableAfter" <= "totalAfter"
    ),
    CONSTRAINT "InventoryMovement_from_bucket_domain_check" CHECK ("fromBucket" IS NULL OR "fromBucket" IN ('DISPONIVEL','RESERVADO','EM_USO','MANUTENCAO','DANIFICADO')),
    CONSTRAINT "InventoryMovement_to_bucket_domain_check" CHECK ("toBucket" IS NULL OR "toBucket" IN ('DISPONIVEL','RESERVADO','EM_USO','MANUTENCAO','DANIFICADO')),
    CONSTRAINT "InventoryMovement_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "InventoryOperation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "ProdutoEstoque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "InventoryAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "InventoryMaintenance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_kitInstanceId_fkey" FOREIGN KEY ("kitInstanceId") REFERENCES "InventoryKitInstance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_kitComponentId_fkey" FOREIGN KEY ("kitComponentId") REFERENCES "InventoryKitComponent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "InventoryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "InventoryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "produtoId" TEXT,
    "assetId" TEXT,
    "kitInstanceId" TEXT,
    "responsibleUserId" INTEGER NOT NULL,
    "sectorId" INTEGER,
    "locationId" TEXT,
    "quantity" INTEGER NOT NULL,
    "deliveredAt" DATETIME NOT NULL,
    "expectedReturnAt" DATETIME,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "observacao" TEXT,
    "handedById" INTEGER NOT NULL,
    "operationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    CONSTRAINT "InventoryAssignment_target_check" CHECK (
      ("produtoId" IS NOT NULL AND "kitInstanceId" IS NULL) OR
      ("produtoId" IS NULL AND "assetId" IS NULL AND "kitInstanceId" IS NOT NULL)
    ),
    CONSTRAINT "InventoryAssignment_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "InventoryAssignment_asset_quantity_check" CHECK ("assetId" IS NULL OR "quantity" = 1),
    CONSTRAINT "InventoryAssignment_returned_check" CHECK ("returnedQuantity" >= 0 AND "returnedQuantity" <= "quantity"),
    CONSTRAINT "InventoryAssignment_version_check" CHECK ("version" > 0),
    CONSTRAINT "InventoryAssignment_status_domain_check" CHECK ("status" IN ('ATIVA','PARCIALMENTE_DEVOLVIDA','DEVOLVIDA','CANCELADA')),
    CONSTRAINT "InventoryAssignment_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "ProdutoEstoque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryAssignment_kitInstanceId_fkey" FOREIGN KEY ("kitInstanceId") REFERENCES "InventoryKitInstance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryAssignment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryAssignment_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "InventoryOperation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryReturnBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "receivedById" INTEGER NOT NULL,
    "returnedAt" DATETIME NOT NULL,
    "observacao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryReturnBatch_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "InventoryAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryReturnBatch_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "InventoryOperation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryReturnLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "assetId" TEXT,
    "kitComponentId" TEXT,
    "quantity" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "destinationLocationId" TEXT,
    "observacao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryReturnLine_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "InventoryReturnLine_asset_quantity_check" CHECK ("assetId" IS NULL OR "quantity" = 1),
    CONSTRAINT "InventoryReturnLine_condition_domain_check" CHECK ("condition" IN ('BOM','COM_AVARIA','NECESSITA_MANUTENCAO','DANIFICADO','NAO_DEVOLVIDO')),
    CONSTRAINT "InventoryReturnLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryReturnBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryReturnLine_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "ProdutoEstoque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryReturnLine_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryReturnLine_kitComponentId_fkey" FOREIGN KEY ("kitComponentId") REFERENCES "InventoryKitComponent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryReturnLine_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "InventoryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryMaintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "produtoId" TEXT NOT NULL,
    "assetId" TEXT,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "provider" TEXT,
    "sentAt" DATETIME NOT NULL,
    "expectedAt" DATETIME,
    "returnedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "observacao" TEXT,
    "openedById" INTEGER NOT NULL,
    "closedById" INTEGER,
    "sendOperationId" TEXT NOT NULL,
    "returnOperationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryMaintenance_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "InventoryMaintenance_asset_quantity_check" CHECK ("assetId" IS NULL OR "quantity" = 1),
    CONSTRAINT "InventoryMaintenance_status_domain_check" CHECK ("status" IN ('ABERTA','CONCLUIDA','CANCELADA')),
    CONSTRAINT "InventoryMaintenance_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "ProdutoEstoque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryMaintenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryMaintenance_sendOperationId_fkey" FOREIGN KEY ("sendOperationId") REFERENCES "InventoryOperation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryMaintenance_returnOperationId_fkey" FOREIGN KEY ("returnOperationId") REFERENCES "InventoryOperation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "produtoId" TEXT,
    "assetId" TEXT,
    "storageProvider" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "InventoryImage_target_check" CHECK (
      (CASE WHEN "produtoId" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "assetId" IS NOT NULL THEN 1 ELSE 0 END) = 1
    ),
    CONSTRAINT "InventoryImage_size_check" CHECK ("sizeBytes" > 0),
    CONSTRAINT "InventoryImage_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "ProdutoEstoque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'ETIQUETA',
    "nome" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "descricao" TEXT,
    "cor" TEXT NOT NULL DEFAULT '#2563eb',
    "icone" TEXT,
    "categoriaId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "InventoryTag_version_check" CHECK ("version" > 0),
    CONSTRAINT "InventoryTag_kind_domain_check" CHECK ("kind" IN ('ETIQUETA','KIT_MODELO')),
    CONSTRAINT "InventoryTag_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryItemTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tagId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryItemTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "InventoryTag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryItemTag_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "ProdutoEstoque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryTagRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tagId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantityRequired" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "observacao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryTagRequirement_quantity_check" CHECK ("quantityRequired" > 0),
    CONSTRAINT "InventoryTagRequirement_sort_check" CHECK ("sortOrder" >= 0),
    CONSTRAINT "InventoryTagRequirement_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "InventoryTag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryTagRequirement_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "ProdutoEstoque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryKitInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tagId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "responsibleUserId" INTEGER,
    "sectorId" INTEGER,
    "locationId" TEXT,
    "assembledById" INTEGER NOT NULL,
    "assembledAt" DATETIME,
    "assignedAt" DATETIME,
    "completedAt" DATETIME,
    "requiredQuantityCache" INTEGER NOT NULL DEFAULT 0,
    "fulfilledQuantityCache" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "observacao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "InventoryKitInstance_cache_check" CHECK (
      "requiredQuantityCache" >= 0 AND "fulfilledQuantityCache" >= 0
    ),
    CONSTRAINT "InventoryKitInstance_version_check" CHECK ("version" > 0),
    CONSTRAINT "InventoryKitInstance_status_domain_check" CHECK ("status" IN ('RASCUNHO','INCOMPLETO','COMPLETO','EM_USO','DEVOLUCAO_PENDENTE','DEVOLVIDO','ARQUIVADO')),
    CONSTRAINT "InventoryKitInstance_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "InventoryTag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryKitInstance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryKitComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kitInstanceId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "assetId" TEXT,
    "quantity" INTEGER NOT NULL,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SELECIONADO',
    "addedById" INTEGER NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryKitComponent_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "InventoryKitComponent_returned_check" CHECK ("returnedQuantity" >= 0 AND "returnedQuantity" <= "quantity"),
    CONSTRAINT "InventoryKitComponent_asset_quantity_check" CHECK ("assetId" IS NULL OR "quantity" = 1),
    CONSTRAINT "InventoryKitComponent_status_domain_check" CHECK ("status" IN ('SELECIONADO','EM_USO','CONSUMIDO','DEVOLVIDO','PARCIALMENTE_DEVOLVIDO','NAO_DEVOLVIDO','DANIFICADO','BAIXADO')),
    CONSTRAINT "InventoryKitComponent_kitInstanceId_fkey" FOREIGN KEY ("kitInstanceId") REFERENCES "InventoryKitInstance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryKitComponent_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "InventoryTagRequirement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryKitComponent_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "ProdutoEstoque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryKitComponent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "InventoryAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "operationId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "actorNameSnapshot" TEXT NOT NULL,
    "oldDataJson" TEXT,
    "newDataJson" TEXT,
    "requestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryAuditLog_actor_check" CHECK (
      ("actorType" = 'USER' AND "actorUserId" IS NOT NULL) OR "actorType" = 'SYSTEM'
    ),
    CONSTRAINT "InventoryAuditLog_actor_domain_check" CHECK ("actorType" IN ('USER','SYSTEM')),
    CONSTRAINT "InventoryAuditLog_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "InventoryOperation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);


-- V2: somente ADD COLUMN; nenhuma tabela legada e reconstruida.
ALTER TABLE "Categoria" ADD COLUMN "descricao" TEXT;
ALTER TABLE "Categoria" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Categoria" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Categoria" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "Categoria" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "descricao" TEXT;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "marca" TEXT;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "modelo" TEXT;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "codigoInterno" TEXT;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "trackingMode" TEXT NOT NULL DEFAULT 'QUANTIDADE';
ALTER TABLE "ProdutoEstoque" ADD COLUMN "usagePolicy" TEXT NOT NULL DEFAULT 'RETORNAVEL';
ALTER TABLE "ProdutoEstoque" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DISPONIVEL';
ALTER TABLE "ProdutoEstoque" ADD COLUMN "defaultLocationId" TEXT;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "observacoes" TEXT;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "dataAquisicao" DATETIME;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "valorAquisicaoCentavos" INTEGER;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "moeda" TEXT NOT NULL DEFAULT 'BRL';
ALTER TABLE "ProdutoEstoque" ADD COLUMN "fornecedor" TEXT;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "quantidadeEmUso" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "quantidadeReservada" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "quantidadeManutencao" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "quantidadeDanificada" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "quantidadeTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "searchText" TEXT;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "createdById" INTEGER;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "updatedById" INTEGER;
ALTER TABLE "ProdutoEstoque" ADD COLUMN "archivedAt" DATETIME;
CREATE UNIQUE INDEX "ProdutoEstoque_codigoInterno_key" ON "ProdutoEstoque"("codigoInterno");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_nome_key" ON "InventoryLocation"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAsset_codigoInterno_key" ON "InventoryAsset"("codigoInterno");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAsset_patrimonio_key" ON "InventoryAsset"("patrimonio");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAsset_serial_key" ON "InventoryAsset"("serial");

-- CreateIndex
CREATE INDEX "InventoryAsset_produtoId_status_idx" ON "InventoryAsset"("produtoId", "status");

-- CreateIndex
CREATE INDEX "InventoryAsset_currentLocationId_status_idx" ON "InventoryAsset"("currentLocationId", "status");

-- CreateIndex
CREATE INDEX "InventoryStockBalance_produtoId_bucket_idx" ON "InventoryStockBalance"("produtoId", "bucket");

-- CreateIndex
CREATE INDEX "InventoryStockBalance_locationId_bucket_idx" ON "InventoryStockBalance"("locationId", "bucket");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryOperation_idempotencyKey_key" ON "InventoryOperation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "InventoryMovement_produtoId_createdAt_id_idx" ON "InventoryMovement"("produtoId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "InventoryMovement_assetId_createdAt_id_idx" ON "InventoryMovement"("assetId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "InventoryMovement_operationId_idx" ON "InventoryMovement"("operationId");

-- CreateIndex
CREATE INDEX "InventoryMovement_assignmentId_idx" ON "InventoryMovement"("assignmentId");

-- CreateIndex
CREATE INDEX "InventoryMovement_kitInstanceId_createdAt_idx" ON "InventoryMovement"("kitInstanceId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_id_idx" ON "InventoryMovement"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAssignment_operationId_key" ON "InventoryAssignment"("operationId");

-- CreateIndex
CREATE INDEX "InventoryAssignment_status_responsibleUserId_deliveredAt_idx" ON "InventoryAssignment"("status", "responsibleUserId", "deliveredAt");

-- CreateIndex
CREATE INDEX "InventoryAssignment_produtoId_status_idx" ON "InventoryAssignment"("produtoId", "status");

-- CreateIndex
CREATE INDEX "InventoryAssignment_kitInstanceId_status_idx" ON "InventoryAssignment"("kitInstanceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReturnBatch_operationId_key" ON "InventoryReturnBatch"("operationId");

-- CreateIndex
CREATE INDEX "InventoryReturnBatch_assignmentId_returnedAt_idx" ON "InventoryReturnBatch"("assignmentId", "returnedAt");

-- CreateIndex
CREATE INDEX "InventoryReturnLine_batchId_idx" ON "InventoryReturnLine"("batchId");

-- CreateIndex
CREATE INDEX "InventoryReturnLine_produtoId_createdAt_idx" ON "InventoryReturnLine"("produtoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMaintenance_sendOperationId_key" ON "InventoryMaintenance"("sendOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMaintenance_returnOperationId_key" ON "InventoryMaintenance"("returnOperationId");

-- CreateIndex
CREATE INDEX "InventoryMaintenance_status_sentAt_idx" ON "InventoryMaintenance"("status", "sentAt");

-- CreateIndex
CREATE INDEX "InventoryMaintenance_produtoId_status_idx" ON "InventoryMaintenance"("produtoId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryImage_objectKey_key" ON "InventoryImage"("objectKey");

-- CreateIndex
CREATE INDEX "InventoryImage_produtoId_deletedAt_idx" ON "InventoryImage"("produtoId", "deletedAt");

-- CreateIndex
CREATE INDEX "InventoryImage_assetId_deletedAt_idx" ON "InventoryImage"("assetId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTag_normalizedName_key" ON "InventoryTag"("normalizedName");

-- CreateIndex
CREATE INDEX "InventoryItemTag_produtoId_idx" ON "InventoryItemTag"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItemTag_tagId_produtoId_key" ON "InventoryItemTag"("tagId", "produtoId");

-- CreateIndex
CREATE INDEX "InventoryTagRequirement_tagId_required_sortOrder_idx" ON "InventoryTagRequirement"("tagId", "required", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTagRequirement_tagId_produtoId_key" ON "InventoryTagRequirement"("tagId", "produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryKitInstance_code_key" ON "InventoryKitInstance"("code");

-- CreateIndex
CREATE INDEX "InventoryKitInstance_tagId_status_createdAt_idx" ON "InventoryKitInstance"("tagId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryKitComponent_kitInstanceId_requirementId_idx" ON "InventoryKitComponent"("kitInstanceId", "requirementId");

-- CreateIndex
CREATE INDEX "InventoryKitComponent_assetId_status_idx" ON "InventoryKitComponent"("assetId", "status");

-- CreateIndex
CREATE INDEX "InventoryAuditLog_entityType_entityId_createdAt_idx" ON "InventoryAuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryAuditLog_actorUserId_createdAt_idx" ON "InventoryAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryAuditLog_operationId_idx" ON "InventoryAuditLog"("operationId");

CREATE UNIQUE INDEX "InventoryStockBalance_product_location_bucket_key" ON "InventoryStockBalance"("produtoId", COALESCE("locationId", ''), "bucket");
