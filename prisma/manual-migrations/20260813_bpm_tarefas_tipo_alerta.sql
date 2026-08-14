-- Alpha CRM / BPM — tarefas por tipo e alerta interno
--
-- Migration MANUAL, aditiva, aplicada no Turso remoto em 2026-08-13 após
-- backup completo verificado. Não execute por `prisma db push`: o runtime
-- usa o adapter libsql remoto. Em outro ambiente, valide backup e PRAGMA.
--
-- As colunas são compatíveis com tarefas legadas: `tipo` recebe o default
-- TAREFA e os campos de alerta permanecem nulos até configurados.

ALTER TABLE "BpmTarefa" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'TAREFA';
ALTER TABLE "BpmTarefa" ADD COLUMN "alertaEm" DATETIME;
ALTER TABLE "BpmTarefa" ADD COLUMN "alertaDisparadoEm" DATETIME;
CREATE INDEX IF NOT EXISTS "BpmTarefa_status_alertaEm_idx"
ON "BpmTarefa"("status", "alertaEm");
