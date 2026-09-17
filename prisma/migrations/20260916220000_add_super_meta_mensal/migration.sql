-- Persist the stretch target for each commercial user and for the team.
-- SQLite/Turso supports additive columns with a constant default without rebuilding the table.
ALTER TABLE "meta_usuario" ADD COLUMN "superMetaMensal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "meta_equipe" ADD COLUMN "superMetaMensal" INTEGER NOT NULL DEFAULT 0;
