-- Links Externos — gaveta "Sistema Externo" na sidebar (Admin/CEO/TI cadastram, visibilidade por role).
-- Migration 100% aditiva: 1 CREATE TABLE (nova, sem dados existentes) + 1 CREATE INDEX.
-- Não altera nenhuma tabela existente além da relação inversa implícita em `usuarios` (sem coluna nova lá).

CREATE TABLE "LinkExterno" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "iconName" TEXT NOT NULL DEFAULT 'ExternalLink',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "visivelPara" TEXT NOT NULL DEFAULT 'TODOS',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LinkExterno_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "LinkExterno_ordem_idx" ON "LinkExterno" ("ordem");
