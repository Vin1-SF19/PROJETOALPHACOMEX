CREATE TABLE "BpmEtapaCardViewConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pipelineId" TEXT NOT NULL,
  "etapaId" TEXT NOT NULL,
  "camposJson" TEXT NOT NULL,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BpmEtapaCardViewConfig_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BpmEtapaCardViewConfig_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BpmEtapaCardViewConfig_pipelineId_etapaId_key" ON "BpmEtapaCardViewConfig"("pipelineId", "etapaId");
