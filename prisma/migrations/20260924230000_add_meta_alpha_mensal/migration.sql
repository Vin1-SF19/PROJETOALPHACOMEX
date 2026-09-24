-- Meta Alpha: alvo do termômetro "Total geral" (closers + líderes comerciais).
-- Coluna aditiva com default constante; SQLite/Turso não reconstrói a tabela.
ALTER TABLE "meta_equipe" ADD COLUMN "metaAlphaMensal" INTEGER NOT NULL DEFAULT 0;
