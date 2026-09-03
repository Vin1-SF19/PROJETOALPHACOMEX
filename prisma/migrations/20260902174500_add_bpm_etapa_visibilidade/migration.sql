-- Allow-list opcional de visualização e ação por perfil em cada etapa do
-- Alpha CRM/BPM. A ausência de linhas preserva o comportamento anterior.
CREATE TABLE IF NOT EXISTS "BpmEtapaVisibilidade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "etapaId" TEXT NOT NULL,
    "perfil" TEXT NOT NULL,
    "podeVer" BOOLEAN NOT NULL DEFAULT true,
    "podeAgir" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BpmEtapaVisibilidade_etapaId_fkey"
      FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "BpmEtapaVisibilidade_etapaId_perfil_key"
  ON "BpmEtapaVisibilidade"("etapaId", "perfil");

CREATE INDEX IF NOT EXISTS "BpmEtapaVisibilidade_etapaId_idx"
  ON "BpmEtapaVisibilidade"("etapaId");
