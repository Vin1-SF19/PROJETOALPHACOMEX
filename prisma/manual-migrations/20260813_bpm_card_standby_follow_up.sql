-- Alpha CRM / BPM — estado persistente do Standby Follow Up
--
-- Migration MANUAL, aditiva e já aplicada no Turso remoto em 2026-08-13.
-- Não execute por `prisma db push`: valide backup e PRAGMA antes de aplicá-la
-- em qualquer outro ambiente.
--
-- Pré-verificação:
-- PRAGMA table_info("BpmCard");
--
-- Verificação posterior: devem existir as duas colunas nullable abaixo e a
-- contagem de BpmCard deve permanecer inalterada.

ALTER TABLE "BpmCard" ADD COLUMN "standbyFollowUpUltimoEm" DATETIME;
ALTER TABLE "BpmCard" ADD COLUMN "standbyFollowUpInterrompidoEm" DATETIME;
