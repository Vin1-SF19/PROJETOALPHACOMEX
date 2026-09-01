-- Configuração aditiva para ocultar campos globais em uma etapa específica
-- sem apagar BpmCampo nem alterar sua disponibilidade nas demais etapas.
-- IF NOT EXISTS mantém a migration compatível com o Turso onde a tabela foi
-- criada manualmente durante o diagnóstico de 2026-09-01.
CREATE TABLE IF NOT EXISTS "BpmCampoOcultoEtapa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campoId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    CONSTRAINT "BpmCampoOcultoEtapa_campoId_fkey"
      FOREIGN KEY ("campoId") REFERENCES "BpmCampo" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmCampoOcultoEtapa_etapaId_fkey"
      FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "BpmCampoOcultoEtapa_campoId_etapaId_key"
  ON "BpmCampoOcultoEtapa"("campoId", "etapaId");

CREATE INDEX IF NOT EXISTS "BpmCampoOcultoEtapa_etapaId_idx"
  ON "BpmCampoOcultoEtapa"("etapaId");
