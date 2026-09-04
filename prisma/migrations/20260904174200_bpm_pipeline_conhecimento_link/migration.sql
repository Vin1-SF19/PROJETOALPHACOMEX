-- RM-2026-D6D970 — Base de Conhecimento aplicada ao processo: link de
-- documentos/materiais relevantes por pipeline, exibido no painel do card.
-- Migration estritamente aditiva: cria somente tabela e índice novos.

CREATE TABLE "BpmPipelineConhecimentoLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pipelineId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoPorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmPipelineConhecimentoLink_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmPipelineConhecimentoLink_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "BpmPipelineConhecimentoLink_pipelineId_ordem_idx" ON "BpmPipelineConhecimentoLink"("pipelineId", "ordem");
