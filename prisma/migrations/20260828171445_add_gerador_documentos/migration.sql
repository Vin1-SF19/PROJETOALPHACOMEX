-- Módulo Gerador de Documentos (RM-2026-999766) — templates com variáveis dinâmicas
-- e cláusulas separadas, geração sob demanda, conferência com reescrita por cláusula via IA.
-- Migration 100% aditiva: 4 CREATE TABLE novas (sem dados existentes) + índices.
-- Não altera nenhuma tabela existente além da relação inversa implícita em `usuarios`
-- (sem coluna nova lá, mesmo padrão de LinkExterno/migration 20260828140000).

CREATE TABLE "DocumentoTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT,
    "variaveisJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "criadoPorId" INTEGER NOT NULL,
    "criadoEm" DATETIME NOT NULL,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "DocumentoTemplate_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "DocumentoTemplate_criadoPorId_criadoEm_idx" ON "DocumentoTemplate" ("criadoPorId", "criadoEm");
CREATE INDEX "DocumentoTemplate_status_criadoEm_idx" ON "DocumentoTemplate" ("status", "criadoEm");

CREATE TABLE "DocumentoClasula" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'TEXTO',
    "editavel" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "DocumentoClasula_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentoTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DocumentoClasula_templateId_ordem_key" ON "DocumentoClasula" ("templateId", "ordem");
CREATE INDEX "DocumentoClasula_templateId_idx" ON "DocumentoClasula" ("templateId");

CREATE TABLE "DocumentoGerado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "variaveisJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "tokenAcesso" TEXT NOT NULL,
    "criadoPorId" INTEGER NOT NULL,
    "criadoEm" DATETIME NOT NULL,
    "atualizadoEm" DATETIME NOT NULL,
    "finalizadoEm" DATETIME,
    CONSTRAINT "DocumentoGerado_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentoTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DocumentoGerado_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DocumentoGerado_tokenAcesso_key" ON "DocumentoGerado" ("tokenAcesso");
CREATE INDEX "DocumentoGerado_criadoPorId_criadoEm_idx" ON "DocumentoGerado" ("criadoPorId", "criadoEm");
CREATE INDEX "DocumentoGerado_status_criadoEm_idx" ON "DocumentoGerado" ("status", "criadoEm");
CREATE INDEX "DocumentoGerado_templateId_idx" ON "DocumentoGerado" ("templateId");
CREATE INDEX "DocumentoGerado_tokenAcesso_idx" ON "DocumentoGerado" ("tokenAcesso");

CREATE TABLE "DocumentoClasulaGerada" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "conteudoOriginal" TEXT NOT NULL,
    "reescritoPorIA" BOOLEAN NOT NULL DEFAULT false,
    "instrucaoIA" TEXT,
    "criadoEm" DATETIME NOT NULL,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "DocumentoClasulaGerada_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoGerado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DocumentoClasulaGerada_documentoId_ordem_key" ON "DocumentoClasulaGerada" ("documentoId", "ordem");
CREATE INDEX "DocumentoClasulaGerada_documentoId_idx" ON "DocumentoClasulaGerada" ("documentoId");
