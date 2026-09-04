-- RM-2026-97CC60 — Fase 3 (ajuste): motivo de interrupção do vínculo card x
-- cadência, requisito explícito do markdown da fase ("estado, motivo de
-- interrupção e histórico suficiente para auditoria"). Coluna aditiva,
-- nullable, sem default.
ALTER TABLE "BpmCardCadencia" ADD COLUMN "motivoInterrupcao" TEXT;
