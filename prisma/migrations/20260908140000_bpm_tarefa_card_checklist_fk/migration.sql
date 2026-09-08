-- RM-2026-0FC47A: vínculo opcional e 1:1 entre a tarefa derivada e o
-- checklist materializado que continua sendo a fonte de verdade.
-- Migration estritamente aditiva: nenhuma linha existente é alterada.

ALTER TABLE "BpmTarefa"
ADD COLUMN "cardChecklistId" TEXT
REFERENCES "BpmCardChecklist" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "BpmTarefa_cardChecklistId_key"
ON "BpmTarefa"("cardChecklistId");
