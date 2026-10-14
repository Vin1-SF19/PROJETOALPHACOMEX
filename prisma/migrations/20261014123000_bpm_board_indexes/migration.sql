-- Reconcilia índices declarados e acrescenta acesso por coluna. Não altera registros.
CREATE INDEX IF NOT EXISTS "BpmCard_board_empresaId_idx" ON "BpmCard"("empresaId");
CREATE INDEX IF NOT EXISTS "BpmCard_board_pipelineId_idx" ON "BpmCard"("pipelineId");
CREATE INDEX IF NOT EXISTS "BpmCard_board_etapaId_idx" ON "BpmCard"("etapaId");
CREATE INDEX IF NOT EXISTS "BpmCard_board_responsavelId_idx" ON "BpmCard"("responsavelId");
CREATE INDEX IF NOT EXISTS "BpmCard_board_status_idx" ON "BpmCard"("status");
CREATE INDEX IF NOT EXISTS "BpmCard_quadro_pagina_idx" ON "BpmCard"("pipelineId", "status", "etapaId", "createdAt", "id");
