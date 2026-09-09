-- RM-2026-6F3C54 — relação aditiva entre cadência e múltiplas etapas.
-- BpmCadencia.etapaId é preservado como shadow legado para rollback seguro.

CREATE TABLE "BpmCadenciaEtapa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cadenciaId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BpmCadenciaEtapa_cadenciaId_fkey" FOREIGN KEY ("cadenciaId") REFERENCES "BpmCadencia" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BpmCadenciaEtapa_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BpmCadenciaEtapa_etapaId_key" ON "BpmCadenciaEtapa"("etapaId");
CREATE INDEX "BpmCadenciaEtapa_cadenciaId_idx" ON "BpmCadenciaEtapa"("cadenciaId");

INSERT OR IGNORE INTO "BpmCadenciaEtapa" ("id", "cadenciaId", "etapaId")
SELECT 'legacy:' || c."id" || ':' || c."etapaId", c."id", c."etapaId"
FROM "BpmCadencia" c
JOIN "BpmEtapa" e ON e."id" = c."etapaId" AND e."pipelineId" = c."pipelineId"
WHERE c."etapaId" IS NOT NULL;
