-- RM-2026-DA0B7D — check-in diário de leads por closer (Alpha Leads).
-- Migration estritamente aditiva: cria somente tabela e índices novos.
-- NÃO APLICADA a nenhum ambiente por este agente: exige o fluxo do Vault
-- (relatório de impacto, backup verificado em database-backups/pre-change/
-- com no máximo 48h e confirmação explícita do usuário) antes do deploy,
-- conforme AGENTS.md e a Constitution do Bibble Squad.

CREATE TABLE "comercial_checkin_diario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER NOT NULL,
    "data" DATETIME NOT NULL,
    "confirmadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comercial_checkin_diario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "comercial_checkin_diario_usuarioId_data_key" ON "comercial_checkin_diario"("usuarioId", "data");
CREATE INDEX "comercial_checkin_diario_data_idx" ON "comercial_checkin_diario"("data");
