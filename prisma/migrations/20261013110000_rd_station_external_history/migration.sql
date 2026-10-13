-- Migração aditiva RD Station. Aplicar este arquivo isoladamente; o diff Prisma
-- completo possui drift preexistente e contém comandos destrutivos.
CREATE TABLE IF NOT EXISTS "BpmImportacaoExterna" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "resumoJson" TEXT NOT NULL,
  "iniciadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluidoEm" DATETIME
);
CREATE UNIQUE INDEX IF NOT EXISTS "BpmImportacaoExterna_provider_fingerprint_key"
  ON "BpmImportacaoExterna"("provider", "fingerprint");
CREATE INDEX IF NOT EXISTS "BpmImportacaoExterna_provider_iniciadoEm_idx"
  ON "BpmImportacaoExterna"("provider", "iniciadoEm");
CREATE INDEX IF NOT EXISTS "BpmImportacaoExterna_status_idx"
  ON "BpmImportacaoExterna"("status");

CREATE TABLE IF NOT EXISTS "BpmCardOrigemExterna" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "sourceDealId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "importacaoId" TEXT NOT NULL,
  "sourcePipelineId" TEXT NOT NULL,
  "sourcePipelineName" TEXT NOT NULL,
  "sourceStageId" TEXT NOT NULL,
  "sourceStageName" TEXT NOT NULL,
  "sourceOwnerId" TEXT,
  "sourceOwnerName" TEXT,
  "sourceDealName" TEXT NOT NULL,
  "rawJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BpmCardOrigemExterna_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BpmCardOrigemExterna_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "BpmImportacaoExterna"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BpmCardOrigemExterna_cardId_key" ON "BpmCardOrigemExterna"("cardId");
CREATE UNIQUE INDEX IF NOT EXISTS "BpmCardOrigemExterna_provider_sourceDealId_key" ON "BpmCardOrigemExterna"("provider", "sourceDealId");
CREATE INDEX IF NOT EXISTS "BpmCardOrigemExterna_importacaoId_idx" ON "BpmCardOrigemExterna"("importacaoId");
CREATE INDEX IF NOT EXISTS "BpmCardOrigemExterna_provider_sourcePipelineId_sourceStageId_idx" ON "BpmCardOrigemExterna"("provider", "sourcePipelineId", "sourceStageId");

CREATE TABLE IF NOT EXISTS "BpmEventoExternoCard" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "origemId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "sourceEventId" TEXT,
  "eventType" TEXT NOT NULL,
  "occurredAt" TEXT,
  "rawJson" TEXT NOT NULL,
  "projectedJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BpmEventoExternoCard_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES "BpmCardOrigemExterna"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BpmEventoExternoCard_origemId_sourceKey_key" ON "BpmEventoExternoCard"("origemId", "sourceKey");
CREATE INDEX IF NOT EXISTS "BpmEventoExternoCard_origemId_occurredAt_idx" ON "BpmEventoExternoCard"("origemId", "occurredAt");
CREATE INDEX IF NOT EXISTS "BpmEventoExternoCard_eventType_idx" ON "BpmEventoExternoCard"("eventType");

CREATE TABLE IF NOT EXISTS "BpmEventoExternoCorrecao" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventoId" TEXT NOT NULL,
  "versao" INTEGER NOT NULL,
  "camposAlteradosJson" TEXT NOT NULL,
  "projecaoAnteriorJson" TEXT NOT NULL,
  "projecaoNovaJson" TEXT NOT NULL,
  "autorId" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BpmEventoExternoCorrecao_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "BpmEventoExternoCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BpmEventoExternoCorrecao_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BpmEventoExternoCorrecao_eventoId_versao_key" ON "BpmEventoExternoCorrecao"("eventoId", "versao");
CREATE INDEX IF NOT EXISTS "BpmEventoExternoCorrecao_autorId_createdAt_idx" ON "BpmEventoExternoCorrecao"("autorId", "createdAt");
