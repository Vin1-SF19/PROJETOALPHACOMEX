CREATE TABLE "BpmCloserAtribuicao" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pipelineId" TEXT NOT NULL,
  "origemTipo" TEXT NOT NULL,
  "origemId" TEXT NOT NULL,
  "cardId" TEXT,
  "responsavelId" INTEGER,
  "onlineNaEscolha" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BpmCloserAtribuicao_pipelineId_fkey"
    FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BpmCloserAtribuicao_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BpmCloserAtribuicao_responsavelId_fkey"
    FOREIGN KEY ("responsavelId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BpmCloserAtribuicao_cardId_key"
  ON "BpmCloserAtribuicao"("cardId");
CREATE UNIQUE INDEX "BpmCloserAtribuicao_pipelineId_origemTipo_origemId_key"
  ON "BpmCloserAtribuicao"("pipelineId", "origemTipo", "origemId");
CREATE INDEX "BpmCloserAtribuicao_pipelineId_responsavelId_createdAt_idx"
  ON "BpmCloserAtribuicao"("pipelineId", "responsavelId", "createdAt");
CREATE INDEX "BpmCloserAtribuicao_responsavelId_idx"
  ON "BpmCloserAtribuicao"("responsavelId");
CREATE INDEX "BpmCloserAtribuicao_origemTipo_origemId_idx"
  ON "BpmCloserAtribuicao"("origemTipo", "origemId");
