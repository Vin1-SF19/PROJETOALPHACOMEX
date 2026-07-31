-- Impede lançamentos duplicados para o mesmo colaborador dentro do mesmo evento.
-- Pré-condição validada no Turso de produção em 2026-07-30: zero pares duplicados.
CREATE UNIQUE INDEX "CommissionEntry_eventId_collaboratorId_key"
ON "CommissionEntry"("eventId", "collaboratorId");
