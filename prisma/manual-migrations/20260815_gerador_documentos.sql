-- Gerador de Documentos — migration 100% aditiva (RM-2026-999766, Fase 2)
-- Padrão: prisma/manual-migrations/ (mesmo de 20260813_bpm_card_anexo_unique.sql)
--
-- Pré-requisitos (Vault):
--   1. Backup verificado (< 48h) em database-backups/pre-change/
--   2. Confirmação explícita do usuário
--   3. Executar em ambiente com acesso ao Turso
--
-- Pré-verificação (deve retornar zero linhas):
--   SELECT name FROM sqlite_master WHERE type='table' AND name IN (
--     'DocumentoTemplate','DocumentoClasula','DocumentoGerado','DocumentoClasulaGerada'
--   );
--
-- Verificação posterior:
--   SELECT name FROM sqlite_master WHERE type='table' AND name IN (
--     'DocumentoTemplate','DocumentoClasula','DocumentoGerado','DocumentoClasulaGerada'
--   );
--   -- Deve retornar 4 linhas.

-- 1. DocumentoTemplate
CREATE TABLE IF NOT EXISTS "DocumentoTemplate" (
    "id"            TEXT    NOT NULL PRIMARY KEY,
    "titulo"        TEXT    NOT NULL,
    "descricao"     TEXT,
    "categoria"     TEXT,
    "variaveisJson" TEXT    NOT NULL,
    "status"        TEXT    NOT NULL DEFAULT 'ATIVO',
    "criadoPorId"   INTEGER NOT NULL,
    "criadoEm"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"  DATETIME NOT NULL,
    CONSTRAINT "DocumentoTemplate_criadoPorId_fkey"
        FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DocumentoTemplate_criadoPorId_idx" ON "DocumentoTemplate"("criadoPorId");
CREATE INDEX IF NOT EXISTS "DocumentoTemplate_status_idx"      ON "DocumentoTemplate"("status");

-- 2. DocumentoClasula
CREATE TABLE IF NOT EXISTS "DocumentoClasula" (
    "id"         TEXT    NOT NULL PRIMARY KEY,
    "templateId" TEXT    NOT NULL,
    "ordem"      INTEGER NOT NULL,
    "titulo"     TEXT    NOT NULL,
    "conteudo"   TEXT    NOT NULL,
    "tipo"       TEXT    NOT NULL DEFAULT 'TEXTO',
    "editavel"   INTEGER NOT NULL DEFAULT 1,
    "criadoEm"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "DocumentoClasula_templateId_fkey"
        FOREIGN KEY ("templateId") REFERENCES "DocumentoTemplate" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentoClasula_templateId_ordem_key" ON "DocumentoClasula"("templateId", "ordem");
CREATE INDEX IF NOT EXISTS "DocumentoClasula_templateId_idx"              ON "DocumentoClasula"("templateId");

-- 3. DocumentoGerado
CREATE TABLE IF NOT EXISTS "DocumentoGerado" (
    "id"             TEXT    NOT NULL PRIMARY KEY,
    "templateId"     TEXT    NOT NULL,
    "titulo"         TEXT    NOT NULL,
    "variaveisJson"  TEXT    NOT NULL,
    "status"         TEXT    NOT NULL DEFAULT 'RASCUNHO',
    "tokenAcesso"    TEXT    NOT NULL,
    "criadoPorId"    INTEGER NOT NULL,
    "criadoEm"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"   DATETIME NOT NULL,
    "finalizadoEm"   DATETIME,
    CONSTRAINT "DocumentoGerado_templateId_fkey"
        FOREIGN KEY ("templateId") REFERENCES "DocumentoTemplate" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DocumentoGerado_criadoPorId_fkey"
        FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentoGerado_tokenAcesso_key" ON "DocumentoGerado"("tokenAcesso");
CREATE INDEX IF NOT EXISTS "DocumentoGerado_criadoPorId_idx"       ON "DocumentoGerado"("criadoPorId");
CREATE INDEX IF NOT EXISTS "DocumentoGerado_status_idx"            ON "DocumentoGerado"("status");
CREATE INDEX IF NOT EXISTS "DocumentoGerado_templateId_idx"        ON "DocumentoGerado"("templateId");

-- 4. DocumentoClasulaGerada
CREATE TABLE IF NOT EXISTS "DocumentoClasulaGerada" (
    "id"               TEXT    NOT NULL PRIMARY KEY,
    "documentoId"      TEXT    NOT NULL,
    "ordem"            INTEGER NOT NULL,
    "titulo"           TEXT    NOT NULL,
    "conteudo"         TEXT    NOT NULL,
    "conteudoOriginal" TEXT    NOT NULL,
    "reescritoPorIA"   INTEGER NOT NULL DEFAULT 0,
    "instrucaoIA"      TEXT,
    "criadoEm"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"     DATETIME NOT NULL,
    CONSTRAINT "DocumentoClasulaGerada_documentoId_fkey"
        FOREIGN KEY ("documentoId") REFERENCES "DocumentoGerado" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentoClasulaGerada_documentoId_ordem_key" ON "DocumentoClasulaGerada"("documentoId", "ordem");
CREATE INDEX IF NOT EXISTS "DocumentoClasulaGerada_documentoId_idx"              ON "DocumentoClasulaGerada"("documentoId");

-- ROLLBACK (executar em ordem inversa):
-- DROP TABLE IF EXISTS "DocumentoClasulaGerada";
-- DROP TABLE IF EXISTS "DocumentoGerado";
-- DROP TABLE IF EXISTS "DocumentoClasula";
-- DROP TABLE IF EXISTS "DocumentoTemplate";
