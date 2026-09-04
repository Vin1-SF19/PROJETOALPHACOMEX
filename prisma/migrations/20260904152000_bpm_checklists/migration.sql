-- AlterTable
ALTER TABLE "BpmCard" ADD COLUMN "tipoProcesso" TEXT;

-- CreateTable
CREATE TABLE "BpmChecklistTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "pipelineId" TEXT,
    "etapaId" TEXT,
    "servico" TEXT,
    "tipoProcesso" TEXT,
    "cardId" TEXT,
    "criadoPorId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmChecklistTemplate_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BpmChecklistTemplate_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BpmChecklistTemplate_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BpmChecklistTemplate_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BpmChecklistTemplateItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmChecklistTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BpmChecklistTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BpmCardChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateNome" TEXT NOT NULL,
    "templateDescricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "concluidoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmCardChecklist_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmCardChecklist_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BpmChecklistTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BpmCardChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardChecklistId" TEXT NOT NULL,
    "templateItemId" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "obrigatorio" BOOLEAN NOT NULL,
    "ordem" INTEGER NOT NULL,
    "exclusivoCard" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "responsavelId" INTEGER,
    "concluidoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmCardChecklistItem_cardChecklistId_fkey" FOREIGN KEY ("cardChecklistId") REFERENCES "BpmCardChecklist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmCardChecklistItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "BpmChecklistTemplateItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BpmCardChecklistItem_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BpmChecklistTemplate_ativo_idx" ON "BpmChecklistTemplate"("ativo");

-- CreateIndex
CREATE INDEX "BpmChecklistTemplate_pipelineId_idx" ON "BpmChecklistTemplate"("pipelineId");

-- CreateIndex
CREATE INDEX "BpmChecklistTemplate_etapaId_idx" ON "BpmChecklistTemplate"("etapaId");

-- CreateIndex
CREATE INDEX "BpmChecklistTemplate_servico_idx" ON "BpmChecklistTemplate"("servico");

-- CreateIndex
CREATE INDEX "BpmChecklistTemplate_tipoProcesso_idx" ON "BpmChecklistTemplate"("tipoProcesso");

-- CreateIndex
CREATE INDEX "BpmChecklistTemplate_cardId_idx" ON "BpmChecklistTemplate"("cardId");

-- CreateIndex
CREATE INDEX "BpmChecklistTemplate_criadoPorId_idx" ON "BpmChecklistTemplate"("criadoPorId");

-- CreateIndex
CREATE INDEX "BpmChecklistTemplateItem_templateId_ordem_idx" ON "BpmChecklistTemplateItem"("templateId", "ordem");

-- CreateIndex
CREATE INDEX "BpmCardChecklist_cardId_status_idx" ON "BpmCardChecklist"("cardId", "status");

-- CreateIndex
CREATE INDEX "BpmCardChecklist_templateId_idx" ON "BpmCardChecklist"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "BpmCardChecklist_cardId_templateId_key" ON "BpmCardChecklist"("cardId", "templateId");

-- CreateIndex
CREATE INDEX "BpmCardChecklistItem_cardChecklistId_ordem_idx" ON "BpmCardChecklistItem"("cardChecklistId", "ordem");

-- CreateIndex
CREATE INDEX "BpmCardChecklistItem_cardChecklistId_status_obrigatorio_idx" ON "BpmCardChecklistItem"("cardChecklistId", "status", "obrigatorio");

-- CreateIndex
CREATE INDEX "BpmCardChecklistItem_responsavelId_idx" ON "BpmCardChecklistItem"("responsavelId");

-- CreateIndex
CREATE UNIQUE INDEX "BpmCardChecklistItem_cardChecklistId_templateItemId_key" ON "BpmCardChecklistItem"("cardChecklistId", "templateItemId");
