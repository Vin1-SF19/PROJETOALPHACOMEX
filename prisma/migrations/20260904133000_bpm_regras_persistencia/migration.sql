-- RM-2026-19631A — Motor de Regras e Validações (Fase 2): persistência das
-- regras/versões avaliadas pelo núcleo determinístico já existente em
-- src/lib/bpm/regras (Fase 1, sem banco). Migration estritamente aditiva:
-- cria somente tabelas e índices novos.

CREATE TABLE "BpmRegra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "prioridade" INTEGER NOT NULL DEFAULT 0,
    "pipelineId" TEXT,
    "etapasJson" TEXT,
    "versaoAtualNum" INTEGER NOT NULL DEFAULT 1,
    "criadoPorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmRegra_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BpmRegra_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BpmRegraVersao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "regraId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1',
    "condicaoJson" TEXT NOT NULL,
    "resultadoJson" TEXT NOT NULL,
    "criadoPorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmRegraVersao_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "BpmRegra" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmRegraVersao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "BpmRegra_ativa_prioridade_idx" ON "BpmRegra"("ativa", "prioridade");
CREATE INDEX "BpmRegra_pipelineId_idx" ON "BpmRegra"("pipelineId");
CREATE INDEX "BpmRegra_criadoPorId_idx" ON "BpmRegra"("criadoPorId");
CREATE UNIQUE INDEX "BpmRegraVersao_regraId_versao_key" ON "BpmRegraVersao"("regraId", "versao");
CREATE INDEX "BpmRegraVersao_regraId_idx" ON "BpmRegraVersao"("regraId");
