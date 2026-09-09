-- RM-2026-457A31: associação aditiva para escopo multietapa de checklists.
-- O campo legado BpmChecklistTemplate.etapaId é preservado para rollback.
CREATE TABLE IF NOT EXISTS "BpmChecklistTemplateEtapa" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "templateId" TEXT NOT NULL,
  "etapaId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BpmChecklistTemplateEtapa_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "BpmChecklistTemplate" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BpmChecklistTemplateEtapa_etapaId_fkey"
    FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "BpmChecklistTemplateEtapa_templateId_etapaId_key"
  ON "BpmChecklistTemplateEtapa"("templateId", "etapaId");
CREATE INDEX IF NOT EXISTS "BpmChecklistTemplateEtapa_templateId_idx"
  ON "BpmChecklistTemplateEtapa"("templateId");
CREATE INDEX IF NOT EXISTS "BpmChecklistTemplateEtapa_etapaId_idx"
  ON "BpmChecklistTemplateEtapa"("etapaId");

-- Compatibilidade: cada vínculo singular legado torna-se uma associação.
INSERT OR IGNORE INTO "BpmChecklistTemplateEtapa" ("id", "templateId", "etapaId")
SELECT 'legacy:' || "id" || ':' || "etapaId", "id", "etapaId"
FROM "BpmChecklistTemplate"
WHERE "etapaId" IS NOT NULL;
