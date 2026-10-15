-- PREPARADO, NÃO APLICADO. Aplicação requer relatório Vault, backup <=48h
-- e consentimento humano específico conforme AGENTS.md.
-- Delta aditivo SQLite/Turso; sem rebuild, backfill ou remoção de legado.
CREATE TABLE "chamado_categoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "setorId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "chamado_categoria_setorId_fkey" FOREIGN KEY ("setorId") REFERENCES "setor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "chamado_categoria_setorId_nomeNormalizado_key" ON "chamado_categoria"("setorId", "nomeNormalizado");
CREATE INDEX "chamado_categoria_setorId_ativo_ordem_idx" ON "chamado_categoria"("setorId", "ativo", "ordem");
ALTER TABLE "chamados" ADD COLUMN "setorDestinoId" INTEGER REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chamados" ADD COLUMN "setorDestinoNome" TEXT;
ALTER TABLE "chamados" ADD COLUMN "categoriaId" INTEGER REFERENCES "chamado_categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "chamados_setorDestinoId_status_idx" ON "chamados"("setorDestinoId", "status");
CREATE INDEX "chamados_categoriaId_idx" ON "chamados"("categoriaId");
