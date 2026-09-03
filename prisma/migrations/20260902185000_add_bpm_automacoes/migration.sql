-- RM-2026-35A772 — automações configuráveis por coluna do CRM/BPM.
-- Migration estritamente aditiva: cria somente tabelas e índices novos.

CREATE TABLE "BpmAutomacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "pipelineId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "gatilhoTipo" TEXT NOT NULL,
    "tempoMinutos" INTEGER,
    "acaoTipo" TEXT NOT NULL,
    "parametrosJson" TEXT NOT NULL DEFAULT '{}',
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmAutomacao_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "BpmPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmAutomacao_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmAutomacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BpmAutomacaoExecucao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "automacaoId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "eventoChave" TEXT NOT NULL,
    "gatilhoTipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "mensagemErro" TEXT,
    "resultadoJson" TEXT,
    "disponivelEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iniciadoEm" DATETIME,
    "executadoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmAutomacaoExecucao_automacaoId_fkey" FOREIGN KEY ("automacaoId") REFERENCES "BpmAutomacao" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmAutomacaoExecucao_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BpmCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BpmAutomacao_pipelineId_etapaId_ativa_idx" ON "BpmAutomacao"("pipelineId", "etapaId", "ativa");
CREATE INDEX "BpmAutomacao_etapaId_gatilhoTipo_ativa_idx" ON "BpmAutomacao"("etapaId", "gatilhoTipo", "ativa");
CREATE INDEX "BpmAutomacao_criadoPorId_idx" ON "BpmAutomacao"("criadoPorId");
CREATE UNIQUE INDEX "BpmAutomacaoExecucao_automacaoId_eventoChave_key" ON "BpmAutomacaoExecucao"("automacaoId", "eventoChave");
CREATE INDEX "BpmAutomacaoExecucao_status_disponivelEm_idx" ON "BpmAutomacaoExecucao"("status", "disponivelEm");
CREATE INDEX "BpmAutomacaoExecucao_automacaoId_idx" ON "BpmAutomacaoExecucao"("automacaoId");
CREATE INDEX "BpmAutomacaoExecucao_cardId_idx" ON "BpmAutomacaoExecucao"("cardId");
