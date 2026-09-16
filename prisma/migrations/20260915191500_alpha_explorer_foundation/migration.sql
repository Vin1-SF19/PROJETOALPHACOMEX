-- Alpha Explorer: persistência aditiva de itens, uploads, ACLs e operações.
-- Vault: sem ALTER, DROP, seed ou backfill.

CREATE TABLE "AlphaExplorerItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "logicalPath" TEXT NOT NULL,
    "parentPath" TEXT NOT NULL,
    "objectKey" TEXT,
    "provider" TEXT,
    "bucketStore" TEXT,
    "sizeBytes" BIGINT,
    "declaredMime" TEXT,
    "validatedMime" TEXT,
    "checksum" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" INTEGER NOT NULL,
    "deletedById" INTEGER,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaExplorerItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AlphaExplorerItem_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AlphaExplorerUploadSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "itemId" TEXT,
    "destinationPath" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "bucketStore" TEXT NOT NULL,
    "uploadId" TEXT,
    "declaredSize" BIGINT NOT NULL,
    "finalSize" BIGINT,
    "declaredMime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "partSizeBytes" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "failureCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaExplorerUploadSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AlphaExplorerUploadSession_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AlphaExplorerItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AlphaExplorerAcl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "capabilitiesJson" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaExplorerAcl_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "AlphaExplorerOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "destinationPath" TEXT,
    "sourceObjectKey" TEXT,
    "destinationObjectKey" TEXT,
    "requestedById" INTEGER NOT NULL,
    "errorCode" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlphaExplorerOperation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AlphaExplorerItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AlphaExplorerOperation_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AlphaExplorerItem_objectKey_key" ON "AlphaExplorerItem"("objectKey");
CREATE INDEX "AlphaExplorerItem_parentPath_status_normalizedName_idx" ON "AlphaExplorerItem"("parentPath", "status", "normalizedName");
CREATE INDEX "AlphaExplorerItem_logicalPath_status_idx" ON "AlphaExplorerItem"("logicalPath", "status");
CREATE INDEX "AlphaExplorerItem_createdById_idx" ON "AlphaExplorerItem"("createdById");
CREATE INDEX "AlphaExplorerItem_deletedAt_idx" ON "AlphaExplorerItem"("deletedAt");
CREATE UNIQUE INDEX "AlphaExplorerUploadSession_objectKey_key" ON "AlphaExplorerUploadSession"("objectKey");
CREATE INDEX "AlphaExplorerUploadSession_userId_status_idx" ON "AlphaExplorerUploadSession"("userId", "status");
CREATE INDEX "AlphaExplorerUploadSession_status_expiresAt_idx" ON "AlphaExplorerUploadSession"("status", "expiresAt");
CREATE INDEX "AlphaExplorerUploadSession_destinationPath_normalizedName_status_idx" ON "AlphaExplorerUploadSession"("destinationPath", "normalizedName", "status");
CREATE INDEX "AlphaExplorerUploadSession_itemId_idx" ON "AlphaExplorerUploadSession"("itemId");
CREATE INDEX "AlphaExplorerAcl_prefix_idx" ON "AlphaExplorerAcl"("prefix");
CREATE INDEX "AlphaExplorerAcl_createdById_idx" ON "AlphaExplorerAcl"("createdById");
CREATE UNIQUE INDEX "AlphaExplorerAcl_subjectType_subjectId_prefix_key" ON "AlphaExplorerAcl"("subjectType", "subjectId", "prefix");
CREATE INDEX "AlphaExplorerOperation_itemId_status_idx" ON "AlphaExplorerOperation"("itemId", "status");
CREATE INDEX "AlphaExplorerOperation_status_createdAt_idx" ON "AlphaExplorerOperation"("status", "createdAt");
CREATE INDEX "AlphaExplorerOperation_requestedById_idx" ON "AlphaExplorerOperation"("requestedById");
