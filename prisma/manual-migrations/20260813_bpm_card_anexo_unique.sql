-- Alpha CRM / BPM — idempotência de anexos
--
-- Migration MANUAL, aditiva e já aplicada no ambiente remoto em 2026-08-13.
-- Não execute por `prisma db push`: registre a execução no procedimento
-- operacional do ambiente antes de aplicá-la em outro banco.
--
-- Pré-verificação (deve retornar zero linhas):
-- SELECT "cardId", "url", COUNT(*) AS quantidade
-- FROM "BpmCardAnexo"
-- GROUP BY "cardId", "url"
-- HAVING COUNT(*) > 1;
--
-- Verificação posterior:
-- SELECT name FROM sqlite_master
-- WHERE type = 'index' AND name = 'BpmCardAnexo_cardId_url_key';

CREATE UNIQUE INDEX IF NOT EXISTS "BpmCardAnexo_cardId_url_key"
ON "BpmCardAnexo"("cardId", "url");
