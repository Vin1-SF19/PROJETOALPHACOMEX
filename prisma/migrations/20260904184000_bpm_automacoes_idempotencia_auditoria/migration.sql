-- RM-2026-D100EB — correção de idempotência e preservação de auditoria.
-- Pré-condição validada no backup específico: não existem pares duplicados
-- (automacaoVersaoId, eventoId) quando ambos são não nulos.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- SQLite não altera a ação de uma FK in-place. A reconstrução preserva todas as
-- colunas e linhas e troca somente BpmAutomacaoVersao.automacaoId para RESTRICT.
CREATE TABLE "new_BpmAutomacaoVersao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "automacaoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "gatilhoTipo" TEXT NOT NULL,
    "gatilhoConfigJson" TEXT NOT NULL DEFAULT '{}',
    "condicaoJson" TEXT,
    "grafoJson" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "criadoPorId" INTEGER NOT NULL,
    "ativadaEm" DATETIME,
    "arquivadaEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmAutomacaoVersao_automacaoId_fkey" FOREIGN KEY ("automacaoId") REFERENCES "BpmAutomacao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BpmAutomacaoVersao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_BpmAutomacaoVersao" (
    "id", "automacaoId", "versao", "status", "gatilhoTipo",
    "gatilhoConfigJson", "condicaoJson", "grafoJson", "timezone",
    "criadoPorId", "ativadaEm", "arquivadaEm", "createdAt"
)
SELECT
    "id", "automacaoId", "versao", "status", "gatilhoTipo",
    "gatilhoConfigJson", "condicaoJson", "grafoJson", "timezone",
    "criadoPorId", "ativadaEm", "arquivadaEm", "createdAt"
FROM "BpmAutomacaoVersao";

DROP TABLE "BpmAutomacaoVersao";
ALTER TABLE "new_BpmAutomacaoVersao" RENAME TO "BpmAutomacaoVersao";

CREATE UNIQUE INDEX "BpmAutomacaoVersao_automacaoId_versao_key"
ON "BpmAutomacaoVersao"("automacaoId", "versao");
CREATE INDEX "BpmAutomacaoVersao_automacaoId_status_idx"
ON "BpmAutomacaoVersao"("automacaoId", "status");

CREATE UNIQUE INDEX "BpmAutomacaoExecucao_automacaoVersaoId_eventoId_key"
ON "BpmAutomacaoExecucao"("automacaoVersaoId", "eventoId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
