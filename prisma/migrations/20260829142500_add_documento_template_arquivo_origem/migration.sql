-- RM-2026-93645F — Upload de template no Gerador de Documentos.
-- Migration 100% aditiva: 2 colunas nullable em DocumentoTemplate, sem default,
-- sem impacto em linhas existentes (templates criados manualmente ficam NULL).

ALTER TABLE "DocumentoTemplate" ADD COLUMN "arquivoOrigemUrl" TEXT;
ALTER TABLE "DocumentoTemplate" ADD COLUMN "arquivoOrigemNome" TEXT;
