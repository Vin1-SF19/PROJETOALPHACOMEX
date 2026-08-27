-- Callix por colaborador: migration exclusivamente aditiva, aprovada pelo Vault.
ALTER TABLE "usuarios" ADD COLUMN "callixHabilitado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "usuarios" ADD COLUMN "callixUserId" TEXT;
