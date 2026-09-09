-- RM-2026-EB2898 — contador simples para concorrência da configuração.
-- A coluna aditiva preserva todos os pipelines e inicializa os existentes em 1.
ALTER TABLE "BpmPipeline" ADD COLUMN "configVersion" INTEGER NOT NULL DEFAULT 1;
